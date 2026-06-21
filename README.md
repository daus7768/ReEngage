# ReEngage — Student Winback for Tuition Centres

> Manual-first MVP. A tuition centre owner imports their student list, the app identifies who's lapsed/dropped, drafts a personalised winback message per student (AI), and the owner sends it from their **own WhatsApp** via a one-tap `wa.me` deep link — then tracks who re-enrolled and the revenue recovered.
>
> **No WhatsApp Business API, no Meta approval needed in v1.** This is deliberate: it ships in days and validates the core question (do owners want this?) before we invest in send automation.

---

## 1. Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (owner's laptop)                                    │
│  Next.js App Router · React Server Components · TS strict     │
└───────────────┬──────────────────────────────┬──────────────┘
                │ Server Actions (mutations)    │ RSC (reads)
                ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js server (Vercel — stateless, edge-cached, scales      │
│  horizontally). Auth session via @supabase/ssr cookies.       │
│   ├── src/server/actions/*   business logic + zod validation  │
│   ├── src/lib/ai/*           Anthropic API (message drafting)  │
│   └── src/lib/domain/*       pure logic (segmentation) — tested │
└───────────────┬──────────────────────────────┬──────────────┘
                │ Postgres (RLS-enforced)       │ HTTPS
                ▼                                ▼
┌──────────────────────────────┐   ┌──────────────────────────┐
│  Supabase Postgres            │   │  Anthropic API           │
│   · Multi-tenant via org_id   │   │  claude-sonnet-4-6        │
│   · Row-Level Security on      │   │  (winback drafting)       │
│     EVERY table               │   └──────────────────────────┘
│   · Supabase Auth (users)     │
│   · Supavisor pooling          │   WhatsApp send = wa.me deep
└──────────────────────────────┘   link → owner's own WhatsApp
```

**Why this scales to millions without a rewrite:**
- **Stateless app tier.** Next.js on Vercel holds no session state in memory — every request authenticates via cookie + Supabase. Add instances infinitely.
- **Multi-tenant isolation at the database layer.** Every row carries `org_id`; Row-Level Security makes cross-tenant data access *impossible* even if application code has a bug. This is the single most important decision for a B2B SaaS — bolted on later it's a nightmare; here it's the foundation.
- **The expensive part (WhatsApp send) is offloaded to the user's own device in v1.** Zero per-message infra cost while validating. When we add the WhatsApp Business API later, it slots in behind the same `campaign_messages` table — the data model already models "a message to a student with a status," independent of *how* it's sent.
- **Pure domain logic is isolated and testable** (`src/lib/domain/segments.ts`) — the lifecycle classification that decides who's "lapsed" is framework-free, so it never has to change when the UI or DB does.

---

## 2. File structure

```
reengage/
├── README.md
├── .env.example
├── package.json
├── tsconfig.json                      # strict mode, @/* → src/*
├── next.config.ts
├── middleware.ts                      # refreshes auth session, guards /app routes
├── supabase/
│   └── migrations/
│       └── 0001_initial_schema.sql    # tables + enums + RLS + indexes + RPC
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx                    # marketing/redirect
    │   ├── (auth)/
    │   │   └── login/page.tsx          # Supabase email auth
    │   ├── onboarding/page.tsx         # create the centre (organization)
    │   └── (app)/
    │       ├── layout.tsx              # authed shell + nav
    │       ├── dashboard/page.tsx      # recovered RM, at-risk pool, recent
    │       ├── students/
    │       │   ├── page.tsx            # list + filters
    │       │   └── _components/        # add form, csv import, table
    │       └── campaigns/
    │           ├── page.tsx            # list campaigns
    │           ├── new/page.tsx        # pick segment → generate drafts
    │           └── [id]/page.tsx       # message cards + WhatsApp send + outcomes
    ├── server/
    │   └── actions/
    │       ├── organizations.ts        # create org (onboarding)
    │       ├── students.ts             # add, bulk import, update status
    │       └── campaigns.ts            # create campaign, redraft, mark outcome
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts               # browser client
    │   │   ├── server.ts               # RSC/action client (cookies)
    │   │   └── middleware.ts           # session refresh helper
    │   ├── ai/
    │   │   └── draft-message.ts        # Anthropic winback drafting
    │   ├── domain/
    │   │   └── segments.ts             # PURE lifecycle classification (unit-tested)
    │   ├── types/
    │   │   ├── database.types.ts        # DB row types (regen via supabase gen types)
    │   │   └── domain.ts               # enums + app-level types
    │   ├── validation.ts               # zod schemas (shared client/server)
    │   └── utils/
    │       ├── whatsapp.ts             # wa.me deep-link builder (MY phone normalize)
    │       └── format.ts               # RM currency, dates
    └── components/
        └── ui/                         # small shared primitives (Button, Card, …)
```

---

## 3. Database schema

Six tables. Everything tenant-scoped by `org_id`. Full DDL in `supabase/migrations/0001_initial_schema.sql`.

| Table | Purpose | Key columns |
|---|---|---|
| `organizations` | The tuition centre (the tenant) | `id`, `name` |
| `profiles` | Extends `auth.users`; links a user → org | `id` (=auth uid), `org_id`, `role` |
| `students` | The student roster | `org_id`, `full_name`, `parent_name`, `parent_phone`, `subject`, `monthly_fee`, `status`, `last_attended_on` |
| `campaigns` | A winback batch targeting a segment | `org_id`, `name`, `segment`, `status` |
| `campaign_messages` | One drafted message → one student | `org_id`, `campaign_id`, `student_id`, `body`, `status`, `outcome_value`, `sent_at`, `responded_at` |
| `activity_events` | Lightweight audit/analytics | `org_id`, `actor_id`, `kind`, `meta` |

**Enums:** `user_role` (owner/admin), `student_status` (active/lapsed/dropped/recovered), `campaign_segment` (lapsed/dropped/all_inactive), `campaign_status` (draft/active/completed/archived), `message_status` (draft/sent/replied/reenrolled/declined/no_response).

**Security model (the important part):**
- RLS is **enabled and forced** on every table.
- A `SECURITY DEFINER` function `current_org_id()` resolves the caller's org once (avoids recursive RLS on `profiles`).
- Every policy is `org_id = current_org_id()` — a user can only ever touch their own centre's rows.
- Onboarding uses an RPC `create_organization()` (SECURITY DEFINER) to atomically create the org and attach the user as `owner`, sidestepping the insert chicken-and-egg.

**Performance:** composite indexes on `(org_id, status)` for students and messages, plus `(org_id, last_attended_on)` for fast segment queries. These are the access patterns the product actually hits.

---

## 4. "API" surface (Server Actions, not REST)

We use **typed Server Actions** instead of REST endpoints — fewer moving parts, end-to-end type safety, no client-side fetch boilerplate. Each action validates input with zod, enforces auth via the Supabase server client (RLS does the tenant check), mutates, then `revalidatePath`.

| Action | File | Does |
|---|---|---|
| `createOrganization(name)` | `organizations.ts` | Onboarding: create centre, attach owner |
| `addStudent(input)` | `students.ts` | Add one student |
| `importStudents(rows)` | `students.ts` | Bulk CSV import (validated, deduped) |
| `updateStudentStatus(id, status)` | `students.ts` | Manual status override |
| `createCampaign({segment})` | `campaigns.ts` | Snapshot matching students → draft a message for each via AI |
| `redraftMessage(messageId)` | `campaigns.ts` | Regenerate one draft |
| `updateMessageBody(messageId, body)` | `campaigns.ts` | Save owner's edit |
| `markMessageOutcome(messageId, outcome, value?)` | `campaigns.ts` | sent / replied / reenrolled(+RM) |

If you later need a public REST/webhook surface (e.g. WhatsApp delivery receipts), add `src/app/api/*/route.ts` handlers — the action layer stays unchanged.

---

## 5. UI architecture

- **Server Components by default** — pages fetch directly from Supabase server-side (fast, no loading spinners for first paint, no API layer).
- **Client Components only where interaction lives** — the add-student form, the message editor, the "Open in WhatsApp" button. Marked `'use client'`, they call Server Actions.
- **Three screens that map to the owner's mental model** (not the data model): *Dashboard* (am I making money back?), *Students* (who do I have / who left?), *Campaigns* (draft and send the winback, track who came back).
- The campaign detail page is the heart: each lapsed student is a card with the AI draft (editable) and a one-tap **Open in WhatsApp** button (`wa.me` deep link, message pre-filled). Owner sends from their own number, taps **Mark sent**, and later **Re-enrolled (+RM)**.

---

## 6. Setup (Cursor → GitHub → Vercel)

```bash
# 1. Install
npm install

# 2. Supabase: create a project, then run the migration
#    (Supabase Dashboard → SQL Editor → paste 0001_initial_schema.sql → run)
#    or with the CLI:
supabase link --project-ref <your-ref>
supabase db push

# 3. Env
cp .env.example .env.local
#   fill: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#         ANTHROPIC_API_KEY

# 4. Generate DB types (keeps types/database.types.ts in sync)
npx supabase gen types typescript --project-id <ref> > src/lib/types/database.types.ts

# 5. Dev
npm run dev

# 6. Ship: push to GitHub, import the repo in Vercel,
#    add the same env vars in Vercel project settings. Done.
```

**Env vars** (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`. The anon key is safe in the browser *because RLS enforces access* — never ship the service-role key to the client.

---

## 7. What v1 deliberately leaves out (and where it slots in)

| Later | Where it plugs into this architecture |
|---|---|
| WhatsApp Business API auto-send | Behind `campaign_messages` — add a `send_jobs` table + worker; status flow already exists |
| Scheduled / triggered sequences | A `sequences` table + cron (Supabase scheduled functions / Vercel cron) reading the same students |
| Attendance import → auto-lapse detection | Feed `last_attended_on`; `segments.ts` already classifies from it |
| Team seats | `role` enum + per-org invites already modelled |
| Billing (Stripe) | New `subscriptions` table keyed by `org_id`; gate actions on plan |

The point: none of these require touching the core schema or breaking tenant isolation. The bones are built for it.
```
```

-- ============================================================================
-- ReEngage — initial schema
-- Multi-tenant (org_id on every table) with forced Row-Level Security.
-- Run in Supabase SQL Editor, or `supabase db push`.
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- Enums ---------------------------------------------------------------------
create type public.user_role        as enum ('owner', 'admin');
create type public.student_status   as enum ('active', 'lapsed', 'dropped', 'recovered');
create type public.campaign_segment as enum ('lapsed', 'dropped', 'all_inactive');
create type public.campaign_status  as enum ('draft', 'active', 'completed', 'archived');
create type public.message_status   as enum ('draft', 'sent', 'replied', 'reenrolled', 'declined', 'no_response');

-- ============================================================================
-- Tables
-- ============================================================================

-- organizations = the tuition centre (the tenant) ---------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  created_at  timestamptz not null default now()
);

-- profiles extends auth.users and binds a user to one org -------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  org_id      uuid references public.organizations (id) on delete set null,
  full_name   text,
  role        public.user_role not null default 'owner',
  created_at  timestamptz not null default now()
);

-- students = the roster -----------------------------------------------------
create table public.students (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  full_name        text not null check (char_length(full_name) between 1 and 160),
  parent_name      text,
  parent_phone     text not null,                       -- stored raw; normalised at send time
  subject          text,
  monthly_fee      numeric(10,2) not null default 0 check (monthly_fee >= 0),
  status           public.student_status not null default 'active',
  enrolled_on      date,
  last_attended_on date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- campaigns = a winback batch over a segment --------------------------------
create table public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  segment     public.campaign_segment not null,
  status      public.campaign_status not null default 'draft',
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- campaign_messages = one drafted message → one student ---------------------
-- org_id is denormalised here so RLS is a single-column check (fast, simple).
create table public.campaign_messages (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  student_id    uuid not null references public.students (id) on delete cascade,
  body          text not null default '',
  channel       text not null default 'whatsapp_manual',
  status        public.message_status not null default 'draft',
  outcome_value numeric(10,2) check (outcome_value is null or outcome_value >= 0),
  sent_at       timestamptz,
  responded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (campaign_id, student_id)                      -- one message per student per campaign
);

-- activity_events = lightweight audit / analytics ---------------------------
create table public.activity_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  kind        text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- Indexes — tuned to the product's real access patterns
-- ============================================================================
create index idx_profiles_org              on public.profiles (org_id);
create index idx_students_org_status       on public.students (org_id, status);
create index idx_students_org_lastattended on public.students (org_id, last_attended_on);
create index idx_campaigns_org_status      on public.campaigns (org_id, status);
create index idx_messages_org_status       on public.campaign_messages (org_id, status);
create index idx_messages_campaign         on public.campaign_messages (campaign_id);
create index idx_messages_student          on public.campaign_messages (student_id);
create index idx_events_org_created        on public.activity_events (org_id, created_at desc);

-- ============================================================================
-- updated_at trigger
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_students_updated
  before update on public.students
  for each row execute function public.touch_updated_at();

create trigger trg_messages_updated
  before update on public.campaign_messages
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- New auth user → create a profile automatically
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', null));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- RLS helper: resolve the caller's org_id ONCE.
-- SECURITY DEFINER so it bypasses RLS on profiles (prevents recursive policy).
-- ============================================================================
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- ============================================================================
-- Onboarding RPC: atomically create an org and attach the caller as owner.
-- ============================================================================
create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if (select org_id from public.profiles where id = auth.uid()) is not null then
    raise exception 'user already belongs to an organization';
  end if;

  insert into public.organizations (name) values (p_name) returning id into v_org_id;
  update public.profiles set org_id = v_org_id, role = 'owner' where id = auth.uid();
  return v_org_id;
end;
$$;

-- ============================================================================
-- Row-Level Security — enabled + FORCED on every table.
-- Rule of thumb: a user can only ever touch rows where org_id = their org.
-- ============================================================================
alter table public.organizations     enable row level security;
alter table public.profiles           enable row level security;
alter table public.students           enable row level security;
alter table public.campaigns          enable row level security;
alter table public.campaign_messages  enable row level security;
alter table public.activity_events    enable row level security;

alter table public.organizations     force row level security;
alter table public.profiles           force row level security;
alter table public.students           force row level security;
alter table public.campaigns          force row level security;
alter table public.campaign_messages  force row level security;
alter table public.activity_events    force row level security;

-- organizations: members can read their own org; updates by owners ----------
create policy org_select on public.organizations
  for select using (id = public.current_org_id());
create policy org_update on public.organizations
  for update using (id = public.current_org_id());

-- profiles: see members of your org; update only your own row ---------------
create policy profiles_select on public.profiles
  for select using (org_id = public.current_org_id() or id = auth.uid());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());

-- students: full CRUD within your org ---------------------------------------
create policy students_select on public.students
  for select using (org_id = public.current_org_id());
create policy students_insert on public.students
  for insert with check (org_id = public.current_org_id());
create policy students_update on public.students
  for update using (org_id = public.current_org_id());
create policy students_delete on public.students
  for delete using (org_id = public.current_org_id());

-- campaigns -----------------------------------------------------------------
create policy campaigns_select on public.campaigns
  for select using (org_id = public.current_org_id());
create policy campaigns_insert on public.campaigns
  for insert with check (org_id = public.current_org_id());
create policy campaigns_update on public.campaigns
  for update using (org_id = public.current_org_id());
create policy campaigns_delete on public.campaigns
  for delete using (org_id = public.current_org_id());

-- campaign_messages ---------------------------------------------------------
create policy messages_select on public.campaign_messages
  for select using (org_id = public.current_org_id());
create policy messages_insert on public.campaign_messages
  for insert with check (org_id = public.current_org_id());
create policy messages_update on public.campaign_messages
  for update using (org_id = public.current_org_id());
create policy messages_delete on public.campaign_messages
  for delete using (org_id = public.current_org_id());

-- activity_events: read + insert within your org ----------------------------
create policy events_select on public.activity_events
  for select using (org_id = public.current_org_id());
create policy events_insert on public.activity_events
  for insert with check (org_id = public.current_org_id());

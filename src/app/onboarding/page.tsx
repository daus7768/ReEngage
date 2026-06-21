"use client";

import { useActionState } from "react";
import { createOrganization, type ActionResult } from "@/server/actions/organizations";

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createOrganization,
    null,
  );

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-sm font-medium text-[var(--accent)]">One quick step</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">
          Name your centre
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          This is how your messages will be signed.
        </p>

        <form action={formAction} className="mt-6 space-y-3">
          <input
            name="name"
            required
            placeholder="e.g. Cemerlang Tuition Centre"
            className="w-full rounded-lg border bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          {state && "error" in state && (
            <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Creating…" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}

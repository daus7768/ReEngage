"use client";

import { useState, useTransition } from "react";
import { addStudent } from "@/server/actions/students";
import type { StudentInput } from "@/lib/validation";

const EMPTY: StudentInput = {
  full_name: "",
  parent_name: "",
  parent_phone: "",
  subject: "",
  monthly_fee: 0,
  status: "active",
  enrolled_on: "",
  last_attended_on: "",
  notes: "",
};

export function AddStudentForm() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StudentInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set<K extends keyof StudentInput>(key: K, value: StudentInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await addStudent(form);
      if ("error" in res) return setError(res.error);
      setForm(EMPTY);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
      >
        Add student
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-6">
      <div className="w-full max-w-md rounded-2xl border bg-[var(--surface)] p-5">
        <h2 className="text-lg font-medium">Add student</h2>
        <div className="mt-4 space-y-3">
          <Field label="Student name" required>
            <input
              className={input}
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Parent name">
              <input
                className={input}
                value={form.parent_name}
                onChange={(e) => set("parent_name", e.target.value)}
              />
            </Field>
            <Field label="Parent WhatsApp" required>
              <input
                className={input}
                placeholder="012-345 6789"
                value={form.parent_phone}
                onChange={(e) => set("parent_phone", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject">
              <input
                className={input}
                value={form.subject}
                onChange={(e) => set("subject", e.target.value)}
              />
            </Field>
            <Field label="Monthly fee (RM)">
              <input
                type="number"
                className={input}
                value={form.monthly_fee}
                onChange={(e) => set("monthly_fee", Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Last attended">
            <input
              type="date"
              className={input}
              value={form.last_attended_on}
              onChange={(e) => set("last_attended_on", e.target.value)}
            />
          </Field>
          {error && (
            <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save student"}
          </button>
        </div>
      </div>
    </div>
  );
}

const input =
  "w-full rounded-lg border bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--ink-soft)]">
        {label}
        {required && <span className="text-[var(--danger)]"> *</span>}
      </span>
      {children}
    </label>
  );
}

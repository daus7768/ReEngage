"use client";

import { useState, useTransition } from "react";
import {
  markMessageOutcome,
  redraftMessage,
  updateMessageBody,
} from "@/server/actions/campaigns";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";
import { formatRM } from "@/lib/utils/format";
import type { MessageStatus } from "@/lib/types/domain";

export interface MessageCardData {
  id: string;
  body: string;
  status: MessageStatus;
  outcome_value: number | null;
  students: {
    full_name: string;
    parent_name: string | null;
    parent_phone: string;
    subject: string | null;
    monthly_fee: number;
  };
}

export function MessageCard({ data }: { data: MessageCardData }) {
  const s = data.students;
  const [body, setBody] = useState(data.body);
  const [status, setStatus] = useState<MessageStatus>(data.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [savedHint, setSavedHint] = useState(false);

  const waLink = buildWhatsAppLink(s.parent_phone, body);

  function saveEdit() {
    start(async () => {
      const res = await updateMessageBody(data.id, body);
      if ("error" in res) return setError(res.error);
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 1500);
    });
  }

  function redraft() {
    setError(null);
    start(async () => {
      const res = await redraftMessage(data.id);
      if ("error" in res) setError(res.error);
      // body refreshes on server revalidation; reflect optimistically via reload-free hint
    });
  }

  function setOutcome(next: MessageStatus, value?: number) {
    setError(null);
    setStatus(next); // optimistic
    start(async () => {
      const res = await markMessageOutcome({
        messageId: data.id,
        status: next,
        outcome_value: value,
      });
      if ("error" in res) setError(res.error);
    });
  }

  function markReenrolled() {
    // default the recovered value to ~6 months of fees; owner can adjust later
    const suggested = Math.round(s.monthly_fee * 6);
    setOutcome("reenrolled", suggested);
  }

  return (
    <div className="rounded-xl border bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{s.full_name}</div>
          <div className="text-xs text-[var(--ink-soft)]">
            {s.parent_name ? `${s.parent_name} · ` : ""}
            {s.subject ?? "—"} · {formatRM(s.monthly_fee)}/mo
          </div>
        </div>
        <StatusPill status={status} value={data.outcome_value} />
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={saveEdit}
        rows={3}
        className="mt-3 w-full resize-none rounded-lg border bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        placeholder="Write a message, or click Redraft to generate one…"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            if (status === "draft") setOutcome("sent");
          }}
          className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
        >
          Open in WhatsApp
        </a>
        <button
          onClick={redraft}
          disabled={pending}
          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
        >
          Redraft
        </button>

        <span className="mx-1 h-5 w-px bg-[var(--line)]" />

        <button
          onClick={() => setOutcome("replied")}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          Replied
        </button>
        <button
          onClick={markReenrolled}
          className="rounded-lg border border-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent)]"
        >
          Re-enrolled
        </button>
        <button
          onClick={() => setOutcome("no_response")}
          className="rounded-lg border px-3 py-2 text-sm text-[var(--ink-soft)]"
        >
          No response
        </button>

        {savedHint && (
          <span className="text-xs text-[var(--ink-soft)]">Saved</span>
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

function StatusPill({
  status,
  value,
}: {
  status: MessageStatus;
  value: number | null;
}) {
  const map: Record<MessageStatus, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-[var(--bg)] text-[var(--ink-soft)]" },
    sent: { label: "Sent", cls: "bg-[#E6F1FB] text-[#185FA5]" },
    replied: { label: "Replied", cls: "bg-[#FAEEDA] text-[#854F0B]" },
    reenrolled: {
      label: value ? `Back · ${formatRM(value)}` : "Back",
      cls: "bg-[var(--accent-soft)] text-[var(--accent)]",
    },
    declined: { label: "Declined", cls: "bg-[var(--danger-soft)] text-[var(--danger)]" },
    no_response: { label: "No reply", cls: "bg-[var(--bg)] text-[var(--ink-soft)]" },
  };
  const v = map[status];
  return (
    <span className={`whitespace-nowrap rounded-md px-2 py-1 text-xs ${v.cls}`}>
      {v.label}
    </span>
  );
}

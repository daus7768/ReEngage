"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "@/server/actions/campaigns";
import { CAMPAIGN_SEGMENT, SEGMENT_LABEL, type CampaignSegment } from "@/lib/types/domain";

const SEGMENT_HELP: Record<CampaignSegment, string> = {
  lapsed: "Haven't attended in 30+ days",
  dropped: "Haven't attended in 90+ days",
  all_inactive: "Everyone who's drifted away",
};

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [segment, setSegment] = useState<CampaignSegment>("lapsed");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await createCampaign(name || "Winback", segment);
      if ("error" in res) return setError(res.error);
      if (res.campaignId) router.push(`/campaigns/${res.campaignId}`);
    });
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-medium tracking-tight">New winback</h1>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Pick who to reach. We&apos;ll draft a personal message for each student —
        you review and send from your own WhatsApp.
      </p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--ink-soft)]">
            Campaign name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Term 3 winback"
            className="w-full rounded-lg border bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>

        <div>
          <span className="mb-2 block text-xs text-[var(--ink-soft)]">
            Who to reach
          </span>
          <div className="space-y-2">
            {CAMPAIGN_SEGMENT.map((seg) => (
              <button
                key={seg}
                onClick={() => setSegment(seg)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm ${
                  segment === seg
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "bg-[var(--surface)]"
                }`}
              >
                <span className="font-medium">{SEGMENT_LABEL[seg]}</span>
                <span className="text-xs text-[var(--ink-soft)]">
                  {SEGMENT_HELP[seg]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={pending}
          className="w-full rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Drafting messages…" : "Generate drafts"}
        </button>
        {pending && (
          <p className="text-center text-xs text-[var(--ink-soft)]">
            Writing a personal message for each student — this takes a few seconds.
          </p>
        )}
      </div>
    </div>
  );
}

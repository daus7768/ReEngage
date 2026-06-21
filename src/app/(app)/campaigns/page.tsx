import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";
import { SEGMENT_LABEL } from "@/lib/types/domain";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, segment, status, created_at")
    .order("created_at", { ascending: false });

  const list = campaigns ?? [];

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Winback batches you&apos;ve run.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
        >
          New winback
        </Link>
      </div>

      <div className="mt-6 space-y-2">
        {list.map((c) => (
          <Link
            key={c.id}
            href={`/campaigns/${c.id}`}
            className="flex items-center justify-between rounded-xl border bg-[var(--surface)] px-4 py-3 hover:border-[var(--accent)]"
          >
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-[var(--ink-soft)]">
                {SEGMENT_LABEL[c.segment]} · {formatDate(c.created_at)}
              </div>
            </div>
            <span className="text-xs capitalize text-[var(--ink-soft)]">
              {c.status}
            </span>
          </Link>
        ))}
        {list.length === 0 && (
          <div className="rounded-xl border border-dashed bg-[var(--surface)] p-8 text-center">
            <p className="text-sm font-medium">No campaigns yet</p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Start a winback to draft messages for your lapsed students.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

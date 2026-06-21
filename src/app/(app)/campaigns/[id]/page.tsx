import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SEGMENT_LABEL } from "@/lib/types/domain";
import { MessageCard, type MessageCardData } from "./_components/message-card";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, segment")
    .eq("id", id)
    .single();

  if (!campaign) notFound();

  const { data: messages } = await supabase
    .from("campaign_messages")
    .select(
      "id, body, status, outcome_value, students(full_name, parent_name, parent_phone, subject, monthly_fee)",
    )
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  const rows = (messages ?? []) as unknown as MessageCardData[];
  const sent = rows.filter((m) => m.status !== "draft").length;
  const back = rows.filter((m) => m.status === "reenrolled").length;

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">{campaign.name}</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {SEGMENT_LABEL[campaign.segment]} · {rows.length} students · {sent} sent ·{" "}
            <span className="text-[var(--accent)]">{back} back</span>
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {rows.map((m) => (
          <MessageCard key={m.id} data={m} />
        ))}
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed bg-[var(--surface)] p-8 text-center text-sm text-[var(--ink-soft)]">
            No messages in this campaign.
          </div>
        )}
      </div>
    </div>
  );
}

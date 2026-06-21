"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/server/auth";
import { draftWinbackMessage } from "@/lib/ai/draft-message";
import { statusesForSegment } from "@/lib/domain/segments";
import {
  createCampaignSchema,
  messageOutcomeSchema,
  updateMessageBodySchema,
} from "@/lib/validation";
import type { CampaignSegment } from "@/lib/types/domain";

export type CampaignActionResult =
  | { error: string }
  | { ok: true; campaignId?: string; count?: number };

// Cap drafts per campaign so a Server Action stays well within timeout.
const MAX_DRAFTS_PER_CAMPAIGN = 50;

/** Run async tasks with bounded concurrency (avoids hammering the AI API). */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return out;
}

function humanMonth(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

/**
 * Create a winback campaign over a segment:
 *  1. find inactive students matching the segment
 *  2. create the campaign row
 *  3. draft a personalised message per student (AI), bounded concurrency
 *  4. insert one campaign_message per student
 */
export async function createCampaign(
  name: string,
  segment: CampaignSegment,
): Promise<CampaignActionResult> {
  const parsed = createCampaignSchema.safeParse({ name, segment });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid campaign" };
  }

  const { orgId, userId } = await requireOrg();
  const supabase = await createClient();

  // Load org name (for message personalisation) + matching students.
  const [{ data: org }, { data: students, error: studentsErr }] =
    await Promise.all([
      supabase.from("organizations").select("name").eq("id", orgId).single(),
      supabase
        .from("students")
        .select("id, full_name, parent_name, subject, last_attended_on")
        .eq("org_id", orgId)
        .in("status", statusesForSegment(parsed.data.segment))
        .limit(MAX_DRAFTS_PER_CAMPAIGN),
    ]);

  if (studentsErr) return { error: studentsErr.message };
  if (!students || students.length === 0) {
    return { error: "No students match this segment yet" };
  }

  const { data: campaign, error: campaignErr } = await supabase
    .from("campaigns")
    .insert({
      org_id: orgId,
      name: parsed.data.name,
      segment: parsed.data.segment,
      status: "active",
      created_by: userId,
    })
    .select("id")
    .single();

  if (campaignErr || !campaign) {
    return { error: campaignErr?.message ?? "Could not create campaign" };
  }

  const centreName = org?.name ?? "our centre";

  // Draft messages. A failed draft falls back to empty body (owner can redraft).
  const drafted = await mapLimit(students, 4, async (s) => {
    let body = "";
    try {
      body = await draftWinbackMessage({
        centreName,
        studentName: s.full_name,
        parentName: s.parent_name,
        subject: s.subject,
        lastAttended: humanMonth(s.last_attended_on),
        language: "mix",
      });
    } catch {
      body = "";
    }
    return {
      org_id: orgId,
      campaign_id: campaign.id,
      student_id: s.id,
      body,
      status: "draft" as const,
    };
  });

  const { error: msgErr, count } = await supabase
    .from("campaign_messages")
    .insert(drafted, { count: "exact" });

  if (msgErr) return { error: msgErr.message };

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaign.id}`);
  return { ok: true, campaignId: campaign.id, count: count ?? drafted.length };
}

/** Regenerate the AI draft for one message. */
export async function redraftMessage(
  messageId: string,
): Promise<CampaignActionResult> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const { data: msg, error } = await supabase
    .from("campaign_messages")
    .select(
      "id, campaign_id, students(full_name, parent_name, subject, last_attended_on), organizations:org_id(name)",
    )
    .eq("id", messageId)
    .eq("org_id", orgId)
    .single();

  if (error || !msg) return { error: "Message not found" };

  // Supabase returns embedded relations; narrow defensively.
  const student = (msg as unknown as {
    students: {
      full_name: string;
      parent_name: string | null;
      subject: string | null;
      last_attended_on: string | null;
    } | null;
  }).students;
  if (!student) return { error: "Student not found" };

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  try {
    const body = await draftWinbackMessage({
      centreName: org?.name ?? "our centre",
      studentName: student.full_name,
      parentName: student.parent_name,
      subject: student.subject,
      lastAttended: humanMonth(student.last_attended_on),
      language: "mix",
    });
    const { error: upErr } = await supabase
      .from("campaign_messages")
      .update({ body })
      .eq("id", messageId)
      .eq("org_id", orgId);
    if (upErr) return { error: upErr.message };
  } catch {
    return { error: "Could not generate a message — try again" };
  }

  revalidatePath(`/campaigns/${msg.campaign_id}`);
  return { ok: true };
}

/** Save the owner's manual edit to a message body. */
export async function updateMessageBody(
  messageId: string,
  body: string,
): Promise<CampaignActionResult> {
  const parsed = updateMessageBodySchema.safeParse({ messageId, body });
  if (!parsed.success) return { error: "Message can't be empty" };

  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase
    .from("campaign_messages")
    .update({ body: parsed.data.body })
    .eq("id", parsed.data.messageId)
    .eq("org_id", orgId);

  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Record an outcome for a message. When marked 'reenrolled' with a value,
 * we also flip the student to 'recovered' and stamp the recovered revenue.
 */
export async function markMessageOutcome(
  input: unknown,
): Promise<CampaignActionResult> {
  const parsed = messageOutcomeSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid outcome" };

  const { orgId } = await requireOrg();
  const supabase = await createClient();
  const { messageId, status, outcome_value } = parsed.data;

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "sent") patch.sent_at = now;
  if (status === "replied" || status === "reenrolled" || status === "declined") {
    patch.responded_at = now;
  }
  if (status === "reenrolled") patch.outcome_value = outcome_value ?? 0;

  const { data: msg, error } = await supabase
    .from("campaign_messages")
    .update(patch)
    .eq("id", messageId)
    .eq("org_id", orgId)
    .select("campaign_id, student_id")
    .single();

  if (error || !msg) return { error: error?.message ?? "Could not update" };

  // Reflect a win on the student record too.
  if (status === "reenrolled") {
    await supabase
      .from("students")
      .update({ status: "recovered" })
      .eq("id", msg.student_id)
      .eq("org_id", orgId);
  }

  revalidatePath(`/campaigns/${msg.campaign_id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

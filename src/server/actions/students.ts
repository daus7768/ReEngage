"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/server/auth";
import {
  importPayloadSchema,
  studentSchema,
  type StudentInput,
} from "@/lib/validation";
import type { StudentStatus } from "@/lib/types/domain";

export type ActionResult =
  | { error: string }
  | { ok: true; count?: number };

function emptyToNull(v: string | undefined | null): string | null {
  return v && v.length > 0 ? v : null;
}

/** Add a single student. */
export async function addStudent(input: StudentInput): Promise<ActionResult> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid student" };
  }

  const { orgId } = await requireOrg();
  const supabase = await createClient();
  const s = parsed.data;

  const { error } = await supabase.from("students").insert({
    org_id: orgId,
    full_name: s.full_name,
    parent_name: emptyToNull(s.parent_name),
    parent_phone: s.parent_phone,
    subject: emptyToNull(s.subject),
    monthly_fee: s.monthly_fee,
    status: s.status,
    enrolled_on: emptyToNull(s.enrolled_on),
    last_attended_on: emptyToNull(s.last_attended_on),
    notes: emptyToNull(s.notes),
  });

  if (error) return { error: error.message };
  revalidatePath("/students");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Bulk import students from parsed CSV rows. Skips invalid rows. */
export async function importStudents(
  rows: unknown,
): Promise<ActionResult> {
  const parsed = importPayloadSchema.safeParse(rows);
  if (!parsed.success) {
    return { error: "CSV format is invalid — check the column headers" };
  }

  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const records = parsed.data.map((r) => ({
    org_id: orgId,
    full_name: r.full_name,
    parent_phone: r.parent_phone,
    parent_name: emptyToNull(r.parent_name),
    subject: emptyToNull(r.subject),
    monthly_fee: r.monthly_fee ?? 0,
    last_attended_on: emptyToNull(r.last_attended_on),
    status: "active" as StudentStatus,
  }));

  const { error, count } = await supabase
    .from("students")
    .insert(records, { count: "exact" });

  if (error) return { error: error.message };
  revalidatePath("/students");
  revalidatePath("/dashboard");
  return { ok: true, count: count ?? records.length };
}

/** Manually override a student's status (e.g. mark recovered). */
export async function updateStudentStatus(
  studentId: string,
  status: StudentStatus,
): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  // org scoping is enforced by RLS; the explicit filter is belt-and-braces.
  const { error } = await supabase
    .from("students")
    .update({ status })
    .eq("id", studentId)
    .eq("org_id", orgId);

  if (error) return { error: error.message };
  revalidatePath("/students");
  return { ok: true };
}

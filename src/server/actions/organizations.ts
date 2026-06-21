"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { organizationNameSchema } from "@/lib/validation";

export type ActionResult = { error: string } | { ok: true };

/** Create the tuition centre and attach the current user as owner. */
export async function createOrganization(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = organizationNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Atomic create-org + attach-owner, enforced server-side in Postgres.
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data,
  });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

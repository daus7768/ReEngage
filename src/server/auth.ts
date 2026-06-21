import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AuthedContext {
  userId: string;
  orgId: string;
}

/**
 * Resolve the current user and their org for a Server Action / RSC.
 * Throws if unauthenticated or not yet onboarded — callers should have
 * already been guarded by middleware, this is defence in depth.
 */
export async function requireOrg(): Promise<AuthedContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (error) throw new Error("Could not load profile");
  if (!profile?.org_id) throw new Error("NO_ORG"); // caller should redirect to /onboarding

  return { userId: user.id, orgId: profile.org_id };
}

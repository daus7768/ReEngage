"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type SignUpResult = { ok: true } | { error: string };

/**
 * Creates a confirmed user via the Admin API — no confirmation email is sent,
 * so Supabase email rate limits do not apply.
 */
export async function signUpAccount(
  email: string,
  password: string,
): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Settings → API → service_role).",
    };
  }

  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return { error: "An account with this email already exists. Try signing in." };
    }
    return { error: error.message };
  }

  return { ok: true };
}

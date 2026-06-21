import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, organizations(name)")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) redirect("/onboarding");
  const centreName =
    (profile as unknown as { organizations: { name: string } | null })
      .organizations?.name ?? "Your centre";

  return (
    <div className="min-h-screen">
      <header className="border-b bg-[var(--surface)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-medium text-[var(--accent)]">
              ReEngage
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
                Dashboard
              </Link>
              <Link href="/students" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
                Students
              </Link>
              <Link href="/campaigns" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
                Campaigns
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[var(--ink-soft)] sm:inline">
              {centreName}
            </span>
            <form action={signOut}>
              <button className="text-sm text-[var(--ink-soft)] underline underline-offset-4">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}

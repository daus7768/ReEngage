import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRM } from "@/lib/utils/format";

export default async function DashboardPage() {
  const supabase = await createClient();

  // All reads are RLS-scoped to the caller's org automatically.
  const [{ data: students }, { data: recovered }] = await Promise.all([
    supabase.from("students").select("status, monthly_fee"),
    supabase
      .from("campaign_messages")
      .select("outcome_value")
      .eq("status", "reenrolled"),
  ]);

  const roster = students ?? [];
  const inactive = roster.filter(
    (s) => s.status === "lapsed" || s.status === "dropped",
  );
  // Recoverable pool ≈ 6 months of fees for each inactive student.
  const atRiskPool = inactive.reduce((sum, s) => sum + s.monthly_fee * 6, 0);
  const recoveredRevenue = (recovered ?? []).reduce(
    (sum, m) => sum + (m.outcome_value ?? 0),
    0,
  );
  const recoveredCount = (recovered ?? []).length;

  const stats = [
    { label: "Recovered this period", value: formatRM(recoveredRevenue), accent: true },
    { label: "Students brought back", value: String(recoveredCount) },
    { label: "Inactive students", value: String(inactive.length) },
    { label: "Recoverable revenue", value: `≈ ${formatRM(atRiskPool)}` },
  ];

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Your seats, and the money you&apos;ve brought back.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
        >
          Start a winback
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border bg-[var(--surface)] p-4"
          >
            <p className="text-xs text-[var(--ink-soft)]">{s.label}</p>
            <p
              className={`mt-1 text-2xl font-medium ${
                s.accent ? "text-[var(--accent)]" : ""
              }`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {roster.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed bg-[var(--surface)] p-8 text-center">
          <p className="text-sm font-medium">No students yet</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Add your roster to see who&apos;s lapsed and start bringing them back.
          </p>
          <Link
            href="/students"
            className="mt-4 inline-block rounded-lg border px-3 py-2 text-sm font-medium"
          >
            Add students
          </Link>
        </div>
      )}
    </div>
  );
}

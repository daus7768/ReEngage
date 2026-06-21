import { createClient } from "@/lib/supabase/server";
import { formatDate, formatRM } from "@/lib/utils/format";
import { STUDENT_STATUS_LABEL, type StudentStatus } from "@/lib/types/domain";
import { AddStudentForm } from "./_components/add-student-form";

const BADGE: Record<StudentStatus, string> = {
  active: "bg-[var(--accent-soft)] text-[var(--accent)]",
  lapsed: "bg-[#FAEEDA] text-[#854F0B]",
  dropped: "bg-[var(--danger-soft)] text-[var(--danger)]",
  recovered: "bg-[var(--accent-soft)] text-[var(--accent)]",
};

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: students } = await supabase
    .from("students")
    .select(
      "id, full_name, parent_name, parent_phone, subject, monthly_fee, status, last_attended_on",
    )
    .order("created_at", { ascending: false });

  const roster = students ?? [];

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {roster.length} student{roster.length === 1 ? "" : "s"}
          </p>
        </div>
        <AddStudentForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-[var(--ink-soft)]">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Last attended</th>
              <th className="px-4 py-3 font-medium">Fee</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-[var(--ink-soft)]">
                    {s.parent_name ? `${s.parent_name} · ` : ""}
                    {s.parent_phone}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--ink-soft)]">
                  {s.subject ?? "—"}
                </td>
                <td className="px-4 py-3 text-[var(--ink-soft)]">
                  {formatDate(s.last_attended_on)}
                </td>
                <td className="px-4 py-3 text-[var(--ink-soft)]">
                  {formatRM(s.monthly_fee)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs ${BADGE[s.status]}`}
                  >
                    {STUDENT_STATUS_LABEL[s.status]}
                  </span>
                </td>
              </tr>
            ))}
            {roster.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[var(--ink-soft)]">
                  No students yet — add your first one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

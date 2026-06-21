import type { CampaignSegment, StudentStatus } from "@/lib/types/domain";

/**
 * Lifecycle thresholds (days since last attendance).
 * Centralised so a future "settings per centre" feature changes one place.
 */
export const LAPSED_AFTER_DAYS = 30;
export const DROPPED_AFTER_DAYS = 90;

/** Minimal shape the classifier needs — keeps it decoupled from the DB row. */
export interface LifecycleInput {
  status: StudentStatus;
  lastAttendedOn: string | null; // ISO date (YYYY-MM-DD) or null
}

/** Whole days between two dates (b - a), floored. */
function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86_400_000);
}

/**
 * Derive a lifecycle status purely from attendance recency.
 * An explicit 'dropped' or 'recovered' status always wins (it's a human decision);
 * otherwise we infer active/lapsed/dropped from how long since they attended.
 */
export function deriveStatus(
  input: LifecycleInput,
  today: Date = new Date(),
): StudentStatus {
  if (input.status === "dropped" || input.status === "recovered") {
    return input.status;
  }
  if (!input.lastAttendedOn) return input.status; // no data → trust stored value

  const last = new Date(`${input.lastAttendedOn}T00:00:00Z`);
  if (Number.isNaN(last.getTime())) return input.status;

  const gap = daysBetween(last, today);
  if (gap >= DROPPED_AFTER_DAYS) return "dropped";
  if (gap >= LAPSED_AFTER_DAYS) return "lapsed";
  return "active";
}

/** Does a student belong in a given campaign segment? */
export function matchesSegment(
  input: LifecycleInput,
  segment: CampaignSegment,
  today: Date = new Date(),
): boolean {
  const derived = deriveStatus(input, today);
  switch (segment) {
    case "lapsed":
      return derived === "lapsed";
    case "dropped":
      return derived === "dropped";
    case "all_inactive":
      return derived === "lapsed" || derived === "dropped";
  }
}

/** Map a campaign segment to the concrete statuses it targets (for DB queries). */
export function statusesForSegment(segment: CampaignSegment): StudentStatus[] {
  switch (segment) {
    case "lapsed":
      return ["lapsed"];
    case "dropped":
      return ["dropped"];
    case "all_inactive":
      return ["lapsed", "dropped"];
  }
}

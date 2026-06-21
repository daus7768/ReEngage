/** App-level enums — mirror the Postgres enums in 0001_initial_schema.sql. */

export const STUDENT_STATUS = ["active", "lapsed", "dropped", "recovered"] as const;
export type StudentStatus = (typeof STUDENT_STATUS)[number];

export const CAMPAIGN_SEGMENT = ["lapsed", "dropped", "all_inactive"] as const;
export type CampaignSegment = (typeof CAMPAIGN_SEGMENT)[number];

export const CAMPAIGN_STATUS = ["draft", "active", "completed", "archived"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUS)[number];

export const MESSAGE_STATUS = [
  "draft",
  "sent",
  "replied",
  "reenrolled",
  "declined",
  "no_response",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUS)[number];

export const USER_ROLE = ["owner", "admin"] as const;
export type UserRole = (typeof USER_ROLE)[number];

/** Human labels for UI (sentence case, owner-facing language). */
export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  active: "Active",
  lapsed: "Lapsed",
  dropped: "Dropped",
  recovered: "Recovered",
};

export const SEGMENT_LABEL: Record<CampaignSegment, string> = {
  lapsed: "Lapsed students",
  dropped: "Dropped students",
  all_inactive: "All inactive students",
};

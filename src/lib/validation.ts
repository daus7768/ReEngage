import { z } from "zod";
import {
  CAMPAIGN_SEGMENT,
  MESSAGE_STATUS,
  STUDENT_STATUS,
} from "@/lib/types/domain";

export const organizationNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your centre's name")
  .max(120);

export const studentSchema = z.object({
  full_name: z.string().trim().min(1, "Student name is required").max(160),
  parent_name: z.string().trim().max(160).optional().or(z.literal("")),
  parent_phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20),
  subject: z.string().trim().max(80).optional().or(z.literal("")),
  monthly_fee: z.coerce.number().min(0).max(100_000).default(0),
  status: z.enum(STUDENT_STATUS).default("active"),
  enrolled_on: z.string().optional().or(z.literal("")),
  last_attended_on: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type StudentInput = z.infer<typeof studentSchema>;

/** One row from a CSV import. */
export const importRowSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  parent_phone: z.string().trim().min(7).max(20),
  parent_name: z.string().trim().max(160).optional(),
  subject: z.string().trim().max(80).optional(),
  monthly_fee: z.coerce.number().min(0).max(100_000).optional(),
  last_attended_on: z.string().optional(),
});
export const importPayloadSchema = z.array(importRowSchema).min(1).max(2000);

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  segment: z.enum(CAMPAIGN_SEGMENT),
});

export const messageOutcomeSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(MESSAGE_STATUS),
  outcome_value: z.coerce.number().min(0).max(100_000).optional(),
});

export const updateMessageBodySchema = z.object({
  messageId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

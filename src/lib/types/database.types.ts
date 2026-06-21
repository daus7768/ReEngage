// Hand-written to match 0001_initial_schema.sql so the app type-checks
// immediately. Regenerate the authoritative version anytime with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/types/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type UserRole = "owner" | "admin";
type StudentStatus = "active" | "lapsed" | "dropped" | "recovered";
type CampaignSegment = "lapsed" | "dropped" | "all_inactive";
type CampaignStatus = "draft" | "active" | "completed" | "archived";
type MessageStatus =
  | "draft"
  | "sent"
  | "replied"
  | "reenrolled"
  | "declined"
  | "no_response";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          org_id: string | null;
          full_name: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          org_id?: string | null;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          org_id: string;
          full_name: string;
          parent_name: string | null;
          parent_phone: string;
          subject: string | null;
          monthly_fee: number;
          status: StudentStatus;
          enrolled_on: string | null;
          last_attended_on: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          full_name: string;
          parent_name?: string | null;
          parent_phone: string;
          subject?: string | null;
          monthly_fee?: number;
          status?: StudentStatus;
          enrolled_on?: string | null;
          last_attended_on?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Insert"]>;
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          segment: CampaignSegment;
          status: CampaignStatus;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          segment: CampaignSegment;
          status?: CampaignStatus;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
        Relationships: [];
      };
      campaign_messages: {
        Row: {
          id: string;
          org_id: string;
          campaign_id: string;
          student_id: string;
          body: string;
          channel: string;
          status: MessageStatus;
          outcome_value: number | null;
          sent_at: string | null;
          responded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          campaign_id: string;
          student_id: string;
          body?: string;
          channel?: string;
          status?: MessageStatus;
          outcome_value?: number | null;
          sent_at?: string | null;
          responded_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["campaign_messages"]["Insert"]
        >;
        Relationships: [];
      };
      activity_events: {
        Row: {
          id: string;
          org_id: string;
          actor_id: string | null;
          kind: string;
          meta: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          actor_id?: string | null;
          kind: string;
          meta?: Json;
        };
        Update: Partial<
          Database["public"]["Tables"]["activity_events"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Functions: {
      current_org_id: { Args: Record<string, never>; Returns: string };
      create_organization: { Args: { p_name: string }; Returns: string };
    };
    Enums: {
      user_role: UserRole;
      student_status: StudentStatus;
      campaign_segment: CampaignSegment;
      campaign_status: CampaignStatus;
      message_status: MessageStatus;
    };
  };
}

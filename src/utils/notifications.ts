import { supabase } from "@/integrations/supabase/client";

export interface CreateNotificationParams {
  recipientUserId?: string | null;
  recipientRole?: string | null;
  type: "course_enrollment" | "project_graded" | "chat_message" | "activity_submitted" | "badge_awarded" | "lesson_announcement" | string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

/**
 * Creates a notification in the database for a student or staff member.
 */
export async function createNotification(params: CreateNotificationParams): Promise<boolean> {
  try {
    const payload: any = {
      type: params.type,
      title: params.title,
      message: params.message,
      read: false,
      data: params.data || null,
    };

    if (params.recipientUserId) {
      payload.recipient_user_id = params.recipientUserId;
    }

    if (params.recipientRole) {
      payload.recipient_role = params.recipientRole;
    }

    const { error } = await supabase.from("notifications").insert([payload]);
    if (error) {
      console.error("Error creating notification in DB:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to dispatch notification:", err);
    return false;
  }
}

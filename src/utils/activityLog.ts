import { supabase } from "@/integrations/supabase/client";

/**
 * Records a platform activity in `audit_logs` and refreshes the user's
 * `last_login` / `last_access` stamps so admins can see when a student was
 * first and last on the platform.
 */
export async function logUserActivity(
  actionType: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const authUserId = data.user?.id;
    if (!authUserId) return;

    const now = new Date().toISOString();

    await supabase.from("audit_logs").insert({
      action_type: actionType,
      performed_by: authUserId,
      target_id: authUserId,
      target_type: "user",
      status: "success",
      details: { path: window.location.pathname, ...(details || {}) },
    });

    await supabase
      .from("users")
      .update(actionType === "login" ? { last_login: now, last_access: now } : { last_access: now })
      .eq("auth_user_id", authUserId);
  } catch (error) {
    console.warn("Failed to record activity:", error);
  }
}

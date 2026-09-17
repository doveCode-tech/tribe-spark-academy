import { supabase } from "@/integrations/supabase/client";

export interface StudentIdentity {
  dbId: string;
  authUserId: string;
}

// In-memory cache for fast lookups
const identityCache = new Map<string, StudentIdentity>();

/**
 * Resolves both public.users.id (dbId) and auth.users.id (authUserId)
 * given either identifier.
 */
export async function resolveStudentIdentity(id: string): Promise<StudentIdentity | null> {
  if (!id) return null;

  if (identityCache.has(id)) {
    return identityCache.get(id)!;
  }

  // Query users table by either id or auth_user_id
  const { data, error } = await supabase
    .from("users")
    .select("id, auth_user_id")
    .or(`id.eq.${id},auth_user_id.eq.${id}`)
    .maybeSingle();

  if (error || !data) {
    console.warn("Could not resolve student identity for id:", id, error);
    return null;
  }

  const identity: StudentIdentity = {
    dbId: data.id,
    authUserId: data.auth_user_id || data.id,
  };

  identityCache.set(data.id, identity);
  if (data.auth_user_id) {
    identityCache.set(data.auth_user_id, identity);
  }

  return identity;
}

/**
 * Helper to build an .or() filter string for Supabase queries
 * that ensures matching whether the table stored users.id or auth_user_id.
 * Example: `student_id.eq.${ids.dbId},student_id.eq.${ids.authUserId}`
 */
export function buildDualIdFilter(
  columnName: string,
  userProfile?: { id?: string; auth_user_id?: string | null } | null
): string {
  const ids = new Set<string>();
  if (userProfile?.id) ids.add(userProfile.id);
  if (userProfile?.auth_user_id) ids.add(userProfile.auth_user_id);

  if (ids.size === 0) return "";
  return Array.from(ids)
    .map((id) => `${columnName}.eq.${id}`)
    .join(",");
}

/**
 * Returns array of both IDs [dbId, authUserId] for in() queries.
 */
export function getDualIdArray(
  userProfile?: { id?: string; auth_user_id?: string | null } | null
): string[] {
  const ids = new Set<string>();
  if (userProfile?.id) ids.add(userProfile.id);
  if (userProfile?.auth_user_id) ids.add(userProfile.auth_user_id);
  return Array.from(ids);
}

import { supabase } from "@/integrations/supabase/client";

export interface DirectoryUser {
  id: string;
  auth_user_id: string | null;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  approved?: boolean | null;
  suspended?: boolean | null;
  created_at?: string | null;
  last_login?: string | null;
  last_access?: string | null;
}

const USER_COLUMNS =
  "id, auth_user_id, name, first_name, last_name, email, phone, avatar_url, role, approved, suspended, created_at, last_login, last_access";

export const buildDisplayName = (u: {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) => {
  const combined = [u.first_name?.trim(), u.last_name?.trim()].filter(Boolean).join(" ");
  return combined || u.name?.trim() || u.email?.split("@")[0] || "";
};

interface RawUserRow {
  id: string;
  auth_user_id?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  approved?: boolean | null;
  suspended?: boolean | null;
  created_at?: string | null;
  last_login?: string | null;
  last_access?: string | null;
}

const normalize = (u: RawUserRow): DirectoryUser => ({
  id: u.id,
  auth_user_id: u.auth_user_id ?? null,
  name: buildDisplayName(u),
  first_name: u.first_name ?? null,
  last_name: u.last_name ?? null,
  email: u.email ?? "",
  phone: u.phone ?? null,
  avatar_url: u.avatar_url ?? null,
  role: u.role ?? null,
  approved: u.approved ?? null,
  suspended: u.suspended ?? null,
  created_at: u.created_at ?? null,
  last_login: u.last_login ?? null,
  last_access: u.last_access ?? null,
});

/**
 * Directory of platform users keyed by BOTH `users.id` and `users.auth_user_id`,
 * so records referencing either identifier resolve to the same person.
 *
 * Admins read through the `admin_list_users` RPC (bypasses row level security the
 * same way the admin user management screen does); everyone else falls back to a
 * direct select limited by RLS.
 */
export async function fetchUserDirectory(ids?: string[]): Promise<Record<string, DirectoryUser>> {
  const map: Record<string, DirectoryUser> = {};

  const add = (rows: RawUserRow[] | null | undefined) => {
    (rows || []).forEach((u) => {
      const item = normalize(u);
      if (item.id) map[item.id] = item;
      if (item.auth_user_id) map[item.auth_user_id] = item;
    });
  };

  const { data: rpcData } = await supabase.rpc("admin_list_users");
  add(rpcData as RawUserRow[] | null);

  const missing = (ids || []).filter((id) => id && !map[id]);
  if (!rpcData || (ids && missing.length > 0)) {
    const targets = missing.length > 0 ? missing : ids || [];

    if (targets.length > 0) {
      const [{ data: byId }, { data: byAuth }] = await Promise.all([
        supabase.from("users").select(USER_COLUMNS).in("id", targets),
        supabase.from("users").select(USER_COLUMNS).in("auth_user_id", targets),
      ]);
      add(byId);
      add(byAuth);
    } else {
      const { data } = await supabase.from("users").select(USER_COLUMNS).limit(500);
      add(data);
    }
  }

  return map;
}

export async function fetchDirectoryUser(id: string): Promise<DirectoryUser | null> {
  const map = await fetchUserDirectory([id]);
  return map[id] || null;
}

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const DEFAULT_DOMAIN = "https://dealergrowth.solutions";

/**
 * Resolve the branded domain for a store group.
 * Accepts either a storeGroupId or a storeId (falls back to looking up the group from the store).
 */
export async function getDomainForGroup(
  supabaseAdmin: SupabaseClient,
  storeGroupId: string | null | undefined,
  storeId?: string | null
): Promise<string> {
  let groupId = storeGroupId || null;

  // If no group ID, try to resolve it from the store
  if (!groupId && storeId) {
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("group_id")
      .eq("id", storeId)
      .single();
    if (store?.group_id) groupId = store.group_id;
  }

  if (!groupId) return DEFAULT_DOMAIN;

  const { data } = await supabaseAdmin
    .from("store_groups")
    .select("domain")
    .eq("id", groupId)
    .single();

  return data?.domain || DEFAULT_DOMAIN;
}

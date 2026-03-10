import { supabase } from "@/integrations/supabase/client";

const DEFAULT_DOMAIN = "https://dealergrowth.solutions";
const cache = new Map<string, string>();

export async function getDomainForStoreGroup(
  storeGroupId: string | null | undefined,
  storeId?: string | null
): Promise<string> {
  let groupId = storeGroupId || null;

  // If no group ID, try to resolve it from the store
  if (!groupId && storeId) {
    const { data: store } = await supabase
      .from("stores")
      .select("group_id")
      .eq("id", storeId)
      .single();
    if (store?.group_id) groupId = store.group_id;
  }

  if (!groupId) return DEFAULT_DOMAIN;
  if (cache.has(groupId)) return cache.get(groupId)!;

  const { data } = await supabase
    .from("store_groups")
    .select("domain")
    .eq("id", groupId)
    .single();

  const domain = data?.domain || DEFAULT_DOMAIN;
  cache.set(groupId, domain);
  return domain;
}

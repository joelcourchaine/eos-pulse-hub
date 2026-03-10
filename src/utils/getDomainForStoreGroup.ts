import { supabase } from "@/integrations/supabase/client";

const DEFAULT_DOMAIN = "https://dealergrowth.solutions";
const cache = new Map<string, string>();

export async function getDomainForStoreGroup(
  storeGroupId: string | null | undefined
): Promise<string> {
  if (!storeGroupId) return DEFAULT_DOMAIN;
  if (cache.has(storeGroupId)) return cache.get(storeGroupId)!;

  const { data } = await supabase
    .from("store_groups")
    .select("domain")
    .eq("id", storeGroupId)
    .single();

  const domain = data?.domain || DEFAULT_DOMAIN;
  cache.set(storeGroupId, domain);
  return domain;
}

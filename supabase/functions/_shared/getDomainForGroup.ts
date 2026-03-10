import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const DEFAULT_DOMAIN = "https://dealergrowth.solutions";

export async function getDomainForGroup(
  supabaseAdmin: SupabaseClient,
  storeGroupId: string | null | undefined
): Promise<string> {
  if (!storeGroupId) return DEFAULT_DOMAIN;

  const { data } = await supabaseAdmin
    .from("store_groups")
    .select("domain")
    .eq("id", storeGroupId)
    .single();

  return data?.domain || DEFAULT_DOMAIN;
}

import { supabase } from "@/integrations/supabase/client";

/**
 * Scorecard Import Matching Utilities
 * Matches advisor names to system users and source columns to KPIs
 */

export interface UserMatchResult {
  userId: string | null;
  matchedName: string | null;
  matchType: "alias" | "exact" | "fuzzy" | null;
  confidence: number;
}

export interface KPIMatchResult {
  kpiId: string;
  kpiName: string;
  metricType: "dollar" | "percentage" | "unit";
  targetDirection: "above" | "below";
}

/**
 * Calculate fuzzy match score between two strings (0-1)
 */
export const fuzzyNameMatch = (name1: string, name2: string): number => {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  
  // Exact match
  if (n1 === n2) return 1;
  
  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) {
    return 0.9;
  }
  
  // Split into words and compare
  const words1 = n1.split(/\s+/).filter(w => w.length > 1);
  const words2 = n2.split(/\s+/).filter(w => w.length > 1);
  
  // Check first and last name match
  if (words1.length >= 2 && words2.length >= 2) {
    const firstMatch = words1[0] === words2[0];
    const lastMatch = words1[words1.length - 1] === words2[words2.length - 1];
    
    if (firstMatch && lastMatch) return 0.95;
    if (lastMatch) return 0.8;
    if (firstMatch) return 0.7;
  }
  
  // Calculate Levenshtein-based similarity
  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(n1, n2);
  const similarity = 1 - distance / maxLen;
  
  return similarity;
};

/**
 * Levenshtein distance between two strings
 */
const levenshteinDistance = (s1: string, s2: string): number => {
  const m = s1.length;
  const n = s2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const d: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  
  return d[m][n];
};

/**
 * Match an advisor name to a user profile
 */
export const matchUserByName = async (
  name: string,
  storeId: string
): Promise<UserMatchResult> => {
  const normalizedName = name.toLowerCase().trim();
  
  // 1. First check aliases
  const { data: aliasMatch } = await supabase
    .from("scorecard_user_aliases")
    .select("user_id, alias_name")
    .eq("store_id", storeId)
    .ilike("alias_name", normalizedName)
    .limit(1)
    .single();
  
  if (aliasMatch) {
    return {
      userId: aliasMatch.user_id,
      matchedName: aliasMatch.alias_name,
      matchType: "alias",
      confidence: 1
    };
  }
  
  // 2. Check for exact match in profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("store_id", storeId);
  
  if (profiles) {
    // Exact match
    const exactMatch = profiles.find(p => 
      p.full_name.toLowerCase().trim() === normalizedName
    );
    
    if (exactMatch) {
      return {
        userId: exactMatch.id,
        matchedName: exactMatch.full_name,
        matchType: "exact",
        confidence: 1
      };
    }
    
    // 3. Fuzzy match
    let bestMatch: { profile: typeof profiles[0]; score: number } | null = null;
    
    for (const profile of profiles) {
      const score = fuzzyNameMatch(name, profile.full_name);
      if (score > 0.85 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { profile, score };
      }
    }
    
    if (bestMatch) {
      return {
        userId: bestMatch.profile.id,
        matchedName: bestMatch.profile.full_name,
        matchType: "fuzzy",
        confidence: bestMatch.score
      };
    }
  }
  
  return {
    userId: null,
    matchedName: null,
    matchType: null,
    confidence: 0
  };
};

/**
 * Batch match multiple advisor names
 */
export const matchUsersByNames = async (
  names: string[],
  storeId: string
): Promise<Map<string, UserMatchResult>> => {
  const results = new Map<string, UserMatchResult>();
  
  // Fetch all aliases for this store
  const { data: aliases } = await supabase
    .from("scorecard_user_aliases")
    .select("user_id, alias_name")
    .eq("store_id", storeId);
  
  // Fetch all profiles for this store
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("store_id", storeId);
  
  const aliasMap = new Map(
    aliases?.map(a => [a.alias_name.toLowerCase().trim(), a]) || []
  );
  
  for (const name of names) {
    const normalizedName = name.toLowerCase().trim();
    
    // Check alias
    const aliasMatch = aliasMap.get(normalizedName);
    if (aliasMatch) {
      results.set(name, {
        userId: aliasMatch.user_id,
        matchedName: aliasMatch.alias_name,
        matchType: "alias",
        confidence: 1
      });
      continue;
    }
    
    if (profiles) {
      // Exact match
      const exactMatch = profiles.find(p => 
        p.full_name.toLowerCase().trim() === normalizedName
      );
      
      if (exactMatch) {
        results.set(name, {
          userId: exactMatch.id,
          matchedName: exactMatch.full_name,
          matchType: "exact",
          confidence: 1
        });
        continue;
      }
      
      // Fuzzy match
      let bestMatch: { profile: typeof profiles[0]; score: number } | null = null;
      
      for (const profile of profiles) {
        const score = fuzzyNameMatch(name, profile.full_name);
        if (score > 0.85 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { profile, score };
        }
      }
      
      if (bestMatch) {
        results.set(name, {
          userId: bestMatch.profile.id,
          matchedName: bestMatch.profile.full_name,
          matchType: "fuzzy",
          confidence: bestMatch.score
        });
        continue;
      }
    }
    
    results.set(name, {
      userId: null,
      matchedName: null,
      matchType: null,
      confidence: 0
    });
  }
  
  return results;
};

/**
 * Create a user alias for future matching
 */
export const createUserAlias = async (
  storeId: string,
  aliasName: string,
  userId: string,
  createdBy: string
): Promise<void> => {
  const { error } = await supabase
    .from("scorecard_user_aliases")
    .upsert({
      store_id: storeId,
      alias_name: aliasName,
      user_id: userId,
      created_by: createdBy
    }, {
      onConflict: "store_id,alias_name"
    });
  
  if (error) {
    throw new Error(`Failed to create alias: ${error.message}`);
  }
};

/**
 * Match a source column to a KPI definition
 */
export const matchColumnToKpi = async (
  sourceColumn: string,
  payTypeFilter: string | null,
  profileId: string,
  departmentId: string
): Promise<KPIMatchResult | null> => {
  // Get import mappings for this profile
  const { data: mappings } = await supabase
    .from("scorecard_import_mappings")
    .select("*")
    .eq("import_profile_id", profileId);
  
  if (!mappings) return null;
  
  // Find matching mapping
  const normalizedColumn = sourceColumn.toLowerCase().trim();
  const normalizedPayType = payTypeFilter?.toLowerCase().trim() || null;
  
  const mapping = mappings.find(m => {
    const columnMatch = m.source_column.toLowerCase().trim() === normalizedColumn;
    const payTypeMatch = normalizedPayType 
      ? (m.pay_type_filter?.toLowerCase().trim() === normalizedPayType)
      : !m.pay_type_filter;
    return columnMatch && payTypeMatch;
  });
  
  if (!mapping) return null;
  
  // Get KPI definition
  const { data: kpi } = await supabase
    .from("kpi_definitions")
    .select("*")
    .eq("department_id", departmentId)
    .ilike("name", mapping.target_kpi_name)
    .limit(1)
    .single();
  
  if (kpi) {
    return {
      kpiId: kpi.id,
      kpiName: kpi.name,
      metricType: kpi.metric_type as "dollar" | "percentage" | "unit",
      targetDirection: kpi.target_direction as "above" | "below"
    };
  }
  
  return null;
};

/**
 * Standard column name mappings (CSR report columns to KPI names)
 */
export const STANDARD_COLUMN_MAPPINGS: Record<string, Record<string, string>> = {
  // Pay Type = Total
  total: {
    "sold hrs": "Total Hours",
    "#so": "Total RO's",
    "lab sold": "Total Labour Sales",
    "e.l.r.": "Total ELR",
  },
  // Pay Type = Customer
  customer: {
    "sold hrs": "CP Hours",
    "#so": "CP RO's",
    "lab sold": "CP Labour Sales",
    "e.l.r.": "CP ELR",
    "parts sold": "CP Parts Sales",
  },
  // Pay Type = Warranty
  warranty: {
    "sold hrs": "Warranty Hours",
    "#so": "Warranty RO's",
    "lab sold": "Warranty Labour Sales",
  },
  // Pay Type = Internal
  internal: {
    "sold hrs": "Internal Hours",
    "#so": "Internal RO's",
    "lab sold": "Internal Labour Sales",
  }
};

/**
 * Get KPI name from standard mappings
 */
export const getStandardKpiName = (
  sourceColumn: string,
  payType: string
): string | null => {
  const normalizedColumn = sourceColumn.toLowerCase().trim();
  const normalizedPayType = payType.toLowerCase().trim();
  
  const payTypeMappings = STANDARD_COLUMN_MAPPINGS[normalizedPayType];
  if (!payTypeMappings) return null;
  
  return payTypeMappings[normalizedColumn] || null;
};

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CategoryMapping {
  metric_key: string;
  parent_metric_key: string | null;
  category: string | null;
}

/**
 * Hook to fetch sub-brand categories from financial_cell_mappings.
 * Used for GMC dealerships to filter sub-metrics by sub-brand
 * (e.g., Chevrolet, Buick, Cadillac, GMC, Fleet).
 *
 * Only fetches when brand is GMC and department contains "New" or "Used".
 */
export const useSubBrandCategories = (
  brand: string | null,
  departmentName: string | null
) => {
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);

  const isGMC = brand?.toLowerCase() === "gmc";
  const isVehicleDept = departmentName
    ? ["new", "used"].some((d) => departmentName.toLowerCase().includes(d))
    : false;
  const shouldFetch = isGMC && isVehicleDept;

  useEffect(() => {
    if (!shouldFetch || !departmentName) {
      setMappings([]);
      return;
    }

    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("financial_cell_mappings")
        .select("metric_key, parent_metric_key, category")
        .eq("brand", "GMC")
        .eq("department_name", departmentName)
        .eq("is_sub_metric", true)
        .not("category", "is", null);

      if (error) {
        console.error("Error fetching sub-brand categories:", error);
        return;
      }
      setMappings(data || []);
    };

    fetchCategories();
  }, [shouldFetch, departmentName]);

  // Build lookup: parentMetricKey -> Map<orderIndex, category>
  const categoryByOrder = useMemo(() => {
    const lookup = new Map<string, Map<number, string>>();
    for (const m of mappings) {
      if (!m.parent_metric_key || !m.category) continue;
      const parts = m.metric_key.split(":");
      if (parts.length < 3) continue;
      const orderIdx = parseInt(parts[2], 10);
      if (isNaN(orderIdx)) continue;

      if (!lookup.has(m.parent_metric_key)) {
        lookup.set(m.parent_metric_key, new Map());
      }
      lookup.get(m.parent_metric_key)!.set(orderIdx, m.category);
    }
    return lookup;
  }, [mappings]);

  // Unique sorted list of categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const m of mappings) {
      if (m.category) cats.add(m.category);
    }
    return Array.from(cats).sort();
  }, [mappings]);

  // Look up the category for a given sub-metric by its parent key and order index
  const getCategory = useCallback(
    (parentMetricKey: string, orderIndex: number): string | null => {
      return categoryByOrder.get(parentMetricKey)?.get(orderIndex) ?? null;
    },
    [categoryByOrder]
  );

  return {
    categories,
    getCategory,
    hasCategories: categories.length > 0,
  };
};

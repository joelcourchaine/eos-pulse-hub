import { getMetricsForBrand } from "@/config/financialMetrics";

/**
 * Returns a Set of metric selection IDs (usually metric names) that are "parents" —
 * i.e., they have at least one selected sub-metric (`sub:{parentKey}:*`) in the list.
 */
export function getParentMetricKeys(
  sortedMetrics: string[],
  brandName: string | null
): Set<string> {
  const parents = new Set<string>();
  const metrics = getMetricsForBrand(brandName);
  const keySet = new Set(sortedMetrics);

  for (const metric of metrics) {
    const key = (metric as any).key as string;
    const name = metric.name as string;
    const hasSubSelected = sortedMetrics.some(
      (id) => id.startsWith(`sub:${key}:`)
    );
    if (hasSubSelected && keySet.has(name)) {
      parents.add(name);
    }
  }
  return parents;
}

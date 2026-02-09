import { getMetricsForBrand } from "@/config/financialMetrics";

/**
 * Sorts selected metrics so that sub-metrics (sub:{parentKey}:{name}) appear
 * directly below their parent metric, following the brand's canonical ordering.
 */
export function sortMetricsWithSubMetrics(
  selectedMetrics: string[],
  brandName: string | null
): string[] {
  if (selectedMetrics.length === 0) return selectedMetrics;

  const brandMetrics = getMetricsForBrand(brandName);
  const sorted: string[] = [];
  const placed = new Set<string>();

  for (const metric of brandMetrics) {
    const metricName = metric.name as string;
    const metricKey = (metric as any).key as string;

    // Add parent if selected
    if (selectedMetrics.includes(metricName) && !placed.has(metricName)) {
      sorted.push(metricName);
      placed.add(metricName);
    }

    // Find selected sub-metrics for this parent key
    // Sub-metrics use selection IDs like sub:{parentKey}:{subName}
    const selectedSubs = selectedMetrics.filter(
      (id) => id.startsWith(`sub:${metricKey}:`) && !placed.has(id)
    );

    for (const sub of selectedSubs) {
      sorted.push(sub);
      placed.add(sub);
    }
  }

  // Append any remaining metrics that weren't matched by brand config
  for (const m of selectedMetrics) {
    if (!placed.has(m)) {
      sorted.push(m);
    }
  }

  return sorted;
}

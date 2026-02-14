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

    // Sort sub-metrics by the embedded order index (e.g. sub:parent:001:Name)
    selectedSubs.sort((a, b) => {
      const partsA = a.split(":");
      const partsB = b.split(":");
      // Format: sub:{parentKey}:{orderIndex}:{name} (4+ parts)
      const indexA = partsA.length >= 4 ? parseInt(partsA[2], 10) : NaN;
      const indexB = partsB.length >= 4 ? parseInt(partsB[2], 10) : NaN;
      if (!isNaN(indexA) && !isNaN(indexB)) return indexA - indexB;
      if (!isNaN(indexA)) return -1;
      if (!isNaN(indexB)) return 1;
      return a.localeCompare(b);
    });

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

/**
 * Reusable pagination utility for Supabase queries
 * 
 * Supabase has a default limit of 1000 rows per query. This utility
 * automatically paginates through all results to ensure no data is lost.
 * 
 * Usage:
 * ```typescript
 * const entries = await fetchAllRows(
 *   supabase.from("scorecard_entries").select("*").in("kpi_id", kpiIds)
 * );
 * ```
 */

interface PaginatableQuery<T> {
  range: (from: number, to: number) => Promise<{ data: T[] | null; error: Error | null }>;
}

/**
 * Fetches all rows from a Supabase query by automatically paginating
 * through results. Use this whenever you might have >1000 rows.
 * 
 * @param queryBuilder - The Supabase query builder (don't call .range() on it)
 * @param pageSize - Number of rows per page (default 1000, Supabase's default limit)
 * @returns Promise resolving to all rows from the query
 * @throws Error if any page fetch fails
 */
export async function fetchAllRows<T>(
  queryBuilder: PaginatableQuery<T>,
  pageSize: number = 1000
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryBuilder.range(offset, offset + pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allRows.push(...data);
    hasMore = data.length === pageSize;
    offset += pageSize;
  }

  return allRows;
}

/**
 * Helper to paginate inline without the utility function.
 * Useful when you need more control over the pagination loop.
 * 
 * Example:
 * ```typescript
 * const allData: MyType[] = [];
 * let offset = 0;
 * const pageSize = 1000;
 * 
 * while (true) {
 *   const { data: page, error } = await supabase
 *     .from("my_table")
 *     .select("*")
 *     .eq("department_id", deptId)
 *     .range(offset, offset + pageSize - 1);
 *   
 *   if (error) throw error;
 *   if (!page || page.length === 0) break;
 *   
 *   allData.push(...page);
 *   if (page.length < pageSize) break;
 *   offset += pageSize;
 * }
 * ```
 */

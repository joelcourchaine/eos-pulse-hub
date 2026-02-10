

## Year-Aware Nissan Financial Mappings

### Problem
Nissan's manufacturer added a row to the Nissan3 sheet starting in 2026, shifting cells from row 31 downward. We need to support both the 2025 layout and the 2026+ layout so dealers can import statements from either year.

### Approach
Add an `effective_year` column to the `financial_cell_mappings` table. Mappings with `effective_year = NULL` apply to all years (default). When a year-specific override exists, it takes precedence.

### Database Changes

**1. Add `effective_year` column**

```sql
ALTER TABLE financial_cell_mappings 
ADD COLUMN effective_year integer;
```

**2. Create 2026 mappings for affected Nissan rows**

Duplicate the Nissan Service, Parts, and Body Shop rows on `Nissan3` where `row >= 31`, set the originals to `effective_year = 2025`, and create new copies with `effective_year = 2026` and cell references shifted +1.

Affected rows per department:
- **Service (Col D)**: D31-D38, D61 (10 rows including sub:total_fixed_expense:001 and total_fixed_expense)
- **Parts (Col H)**: H31-H38, H61 (10 rows including sub:total_fixed_expense:001 and total_fixed_expense)
- **Body Shop (Col L)**: L31-L37, L61 (9 rows -- same pattern)

Rows below 31 and rows on other sheets (Nissan5, etc.) remain unchanged with `effective_year = NULL`.

**3. Remove redundant mapping**

Delete the `sub:total_fixed_expense:001:TOTAL FIXED EXPENSE` entries that duplicate the parent `total_fixed_expense` mapping (same cell reference). This applies to all three departments.

### Code Changes

**File: `src/utils/parseFinancialExcel.ts`**

Update `fetchCellMappings` to accept an optional `year` parameter:

```typescript
export const fetchCellMappings = async (
  brand: string, 
  year?: number
): Promise<CellMapping[]> => {
  let query = supabase
    .from('financial_cell_mappings')
    .select('*')
    .eq('brand', brand);

  const { data, error } = await query;
  if (error || !data) return [];

  if (year) {
    // For each metric_key + department combo, prefer year-specific 
    // mapping over NULL (universal) mapping
    const grouped = new Map<string, CellMapping[]>();
    for (const m of data) {
      const key = `${m.department_name}::${m.metric_key}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(m);
    }
    const result: CellMapping[] = [];
    for (const entries of grouped.values()) {
      const yearMatch = entries.find(e => e.effective_year === year);
      const universal = entries.find(e => e.effective_year === null);
      result.push(yearMatch || universal || entries[0]);
    }
    return result;
  }

  return data;
};
```

Update the `CellMapping` interface to include:
```typescript
effective_year?: number | null;
```

**File: `src/components/financial/MonthDropZone.tsx`**

Pass the year (extracted from `monthIdentifier`) to `fetchCellMappings`:

```typescript
const year = parseInt(monthIdentifier.split('-')[0], 10);
const mappings = await fetchCellMappings(storeBrand, year);
```

This change applies to all three places `fetchCellMappings` is called in this file (around lines 131, 223, 309).

**File: `src/components/financial/FinancialDataImport.tsx`**

If `fetchCellMappings` is used here for manual imports, pass the year from the month column as well.

### How It Works

1. User drops a January 2026 Nissan statement onto the January column
2. `monthIdentifier` is `"2026-01"`, so year = 2026
3. `fetchCellMappings("Nissan", 2026)` fetches all Nissan mappings
4. For rows that have both a 2025 and 2026 version, the 2026 version (shifted +1) is selected
5. For rows with only `effective_year = NULL`, those universal mappings are used as-is
6. Parser reads the correct cells from the shifted layout

If a dealer drops a 2025 statement, `fetchCellMappings("Nissan", 2025)` picks the 2025-specific mappings instead.

### Data Cleanup

After deploying, delete the incorrect January 2026 financial entries for the affected departments so they can be cleanly re-imported with the corrected mappings.

### Files to Modify

1. **Database migration** -- Add `effective_year` column, duplicate and shift affected mappings, clean up redundant rows
2. `src/utils/parseFinancialExcel.ts` -- Update `CellMapping` interface and `fetchCellMappings` function
3. `src/components/financial/MonthDropZone.tsx` -- Pass year to `fetchCellMappings` calls
4. `src/components/financial/FinancialDataImport.tsx` -- Pass year to `fetchCellMappings` if applicable

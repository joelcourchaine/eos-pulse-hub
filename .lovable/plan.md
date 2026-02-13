

## Fix Scorecard Import: Column Index Drift Breaking Most KPI Imports

### Problem
When Chris Mark drags the CSR Productivity Report into the scorecard, only **CP ELR** data imports (5 entries for 5 advisors). The other KPIs (CP Hours Per RO, CP Labour Sales Per RO, Total Parts and Labour Sales) are silently skipped.

**Root cause**: The Visual Mapper cell mappings store **hardcoded column indices** (e.g., "CP ELR is at column 14"). When the DMS export adds, removes, or reorders columns, all indices shift. CP ELR happens to still land at index 14 in the new report, but the other KPIs have moved.

**Secondary issue**: The template KPI names (e.g., "CP Hours", "Total CP RO's") don't match the user's actual KPI names (e.g., "CP Hours Per RO", "CP Labour Sales Per RO"), so even if columns were correct, several mappings would still fail due to name mismatches.

### Solution
Add **column-header-based index re-mapping** so the import adapts to column shifts automatically. Instead of using the raw column index from the cell mapping, the system will:

1. Look up what column header was at that index when the mapping was created (stored in the import profile or derivable from the report structure)
2. Find where that same header appears in the current report
3. Use the corrected index to extract data

### Technical Changes

**File: `src/components/scorecard/ScorecardImportPreviewDialog.tsx`**
- Before processing universal mappings, build a **column index remapping table** by comparing the cell mapping's `col_index` against the actual `parseResult.columnHeadersWithIndex`
- For each cell mapping, look up the original column header from the mapping metadata, then find the matching header in the current report to get the correct current index
- Add console logging showing which mappings succeeded and which failed (with reason), so future issues are easier to diagnose
- When `payType` is found but `metricsByIndex[payType][colIndex]` returns undefined, log a warning with the expected column name and available columns

**File: `supabase/migrations/` (new migration)**
- Add a `source_column_header` column to `scorecard_cell_mappings` table to persist the column header name that was mapped in the Visual Mapper
- This enables reliable re-mapping when column indices shift

**File: `src/components/admin/scorecard-mapper/ScorecardVisualMapper.tsx`**
- When saving cell mappings, also store the column header name from the Excel file alongside the column index

**Fallback behavior (no migration needed for immediate fix):**
- If `source_column_header` is not yet populated (existing mappings), the system will attempt to match by scanning `parseResult.columnHeaders` for headers that correspond to the mapped KPI name using the existing `STANDARD_COLUMN_MAPPINGS` reverse lookup
- For example, if the mapping says KPI "CP ELR" at col 14, and `STANDARD_COLUMN_MAPPINGS.customer["e.l.r."]` = "CP ELR", then look for "E.L.R." in the current report headers and use that column's actual index

**Immediate diagnostic improvement (no schema change):**
- Add detailed console logging in `ScorecardImportPreviewDialog` showing:
  - How many universal mappings were attempted
  - How many matched a user KPI
  - How many found a valid payType
  - How many found a numeric value
  - Which specific mappings failed and why
- Show a warning toast when fewer than 50% of expected mappings produce data, alerting the user that the report format may have changed

### Why This Keeps Happening
The Visual Mapper maps cells by absolute position (column 14, row offset 2). DMS exports are not guaranteed to have stable column layouts across report runs. The fix makes the import resilient to column reordering by anchoring on header names rather than positions.


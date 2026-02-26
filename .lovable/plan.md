
## What Was and Wasn't Done

The previous Nissan 2026 row-shift change was **incomplete**. Here's the current state:

**Done:**
- `total_direct_expenses` (D38→D37 for 2026) and `total_fixed_expense` (D61→D60 for 2026) were added with `effective_year: 2025` for Service and Parts departments only.

**Missing — needs to be done:**

### 1. Sub-metric rows D21-D37 need 2026 versions
The DIGITAL ADVERTISING row was at position D26 (sub_6). For 2026+, sub_6 disappears and sub_7 through sub_17 each shift up by 1 row:
- Currently sub_7=D27 → for 2026 becomes sub_6=D26 (renumbered)
- sub_17=D37 → for 2026 becomes sub_16=D36

The cleanest approach: add `effective_year: 2025` to `total_direct_expenses_sub_6` (the DIGITAL ADVERTISING row), and add **2026 rows** for sub_6 through sub_16 at the shifted cell references.

### 2. Body Shop Department is entirely missing 2026-shifted mappings
Body Shop uses column L (L38, L61, etc.) — same Nissan3 sheet but column L. It currently only has 4 sales_expense sub rows (L16-L19) with no year tagging. It needs full mappings matching Service/Parts but in column L.

### 3. No 2026 mappings exist yet for any department
The current `effective_year: 2025` entries are the 2025-specific cells. We need mirrored 2026 entries at the shifted cell addresses.

## Plan

### Database migration — insert 2026 mappings for Nissan Nissan3

For all 3 departments (Service=D, Parts=H, Body Shop=L):

**Tag existing 2025 sub_6 (DIGITAL ADVERTISING):**
- Update `total_direct_expenses_sub_6` rows (D26, H26, L26) to `effective_year = 2025`

**Insert 2026 mappings (sub rows shift -1 from row 27 onward):**
- `total_direct_expenses_sub_6` → D26/H26/L26 but NOW these map to what was sub_7's content at 2026 (the sub_6 slot is vacated by removal of DIGITAL ADVERTISING, so sub_7's 2025 cell D27 becomes D26 in 2026)
- sub_7 through sub_16 shift: D28→D27, D29→D28... D37→D36 (effective_year: 2026)
- `total_direct_expenses` total: D38→D37 (effective_year: 2026)
- `total_fixed_expense`: D61→D60 (effective_year: 2026)

**Body Shop — add ALL missing base mappings plus 2026 variants:**
- Add universal mappings for Body Shop: total_sales (L6), gp_net (L7), sales_expense (L20), total_direct_expenses_sub_1 through sub_17, total_direct_expenses (L38), total_fixed_expense (L61)
- Add `effective_year: 2025` tag to Body Shop total_direct_expenses (L38) and total_fixed_expense (L61)
- Add `effective_year: 2026` entries for Body Shop with shifted cells

### No code changes needed
The `fetchCellMappings` function in `parseFinancialExcel.ts` already correctly prioritizes `effective_year`-matched rows over universal ones — the logic is already there. This is purely a data fix.

### SQL Summary
```sql
-- 1. Tag existing sub_6 rows as 2025-only (DIGITAL ADVERTISING)
UPDATE financial_cell_mappings SET effective_year = 2025
WHERE brand = 'Nissan' AND sheet_name = 'Nissan3'
  AND metric_key LIKE 'total_direct_expenses_sub_6';

-- 2. Tag existing total_direct_expenses and total_fixed_expense as 2025
UPDATE financial_cell_mappings SET effective_year = 2025
WHERE brand = 'Nissan' AND sheet_name = 'Nissan3'
  AND department_name IN ('Service Department','Parts Department')
  AND metric_key IN ('total_direct_expenses','total_fixed_expense');

-- 3. Insert 2026 sub rows for Service (col D), Parts (col H), Body Shop (col L)
--    sub_6 through sub_16 shift: old sub_7..sub_17 → new sub_6..sub_16 at row-1
INSERT INTO financial_cell_mappings (...) VALUES
  -- Service 2026
  ('Nissan','Service Department','total_direct_expenses_sub_6','Nissan3','D26',2026),
  ('Nissan','Service Department','total_direct_expenses_sub_7','Nissan3','D27',2026),
  ...
  ('Nissan','Service Department','total_direct_expenses_sub_16','Nissan3','D36',2026),
  ('Nissan','Service Department','total_direct_expenses','Nissan3','D37',2026),
  ('Nissan','Service Department','total_fixed_expense','Nissan3','D60',2026),
  -- Parts 2026 (col H) — same logic
  -- Body Shop base (col L) — universal + 2025/2026 variants

-- 4. Insert Body Shop base mappings (missing entirely)
INSERT INTO financial_cell_mappings (...) VALUES
  ('Nissan','Body Shop Department','total_sales','Nissan3','L6',NULL),
  ('Nissan','Body Shop Department','gp_net','Nissan3','L7',NULL),
  ('Nissan','Body Shop Department','sales_expense','Nissan3','L20',NULL),
  ...
```

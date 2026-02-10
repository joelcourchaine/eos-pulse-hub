

## Fix: Correct Nissan 2026 Mapping Direction

### What Went Wrong

The previous migration assumed a row was **added** (shifting rows down by +1). The image shows the opposite: **"DIGITAL ADVERTISING (Memo)" was removed** in 2026, shifting everything from row 27 onward **up by 1**.

### Current (Incorrect) State vs. What We Need

**Service Department example (Column D):**

| Metric | 2025 Cell | Current 2026 (WRONG) | Correct 2026 |
|--------|-----------|---------------------|--------------|
| 006: DIGITAL ADVERTISING | D27 | D27 (universal) | **REMOVED** |
| 007: ADVERTISING - FACTORY | D28 | D28 (universal) | D27 |
| 008: POLICY ADJUSTMENT | D29 | D29 (universal) | D28 |
| 009: WARRANTY ADJUSTMENT | D30 | D30 (universal) | D29 |
| 010: DATA PROCESSING | D31 | D32 (+1 wrong) | D30 |
| 011: MEMBERSHIP | D32 | D33 (+1 wrong) | D31 |
| 012: FREIGHT | D33 | D34 (+1 wrong) | D32 |
| 013: TRAINING | D34 | D35 (+1 wrong) | D33 |
| 014: INTEREST - FLOORPLAN | D35 | D36 (+1 wrong) | D34 |
| 015: NIIF (ICE) | D36 | D37 (+1 wrong) | D35 |
| 016: TRAVEL & ENTERTAIN | D37 | D38 (+1 wrong) | D36 |
| total_direct_expenses | D38 | D39 (+1 wrong) | D37 |
| total_fixed_expense | D61 | D62 (+1 wrong) | D60 |

Same pattern applies to **Parts (Col H)** and **Body Shop (Col L)**.

### Migration Plan

A single SQL migration that:

1. **Delete all incorrect 2026 mappings** created by the previous migration
2. **Set "DIGITAL ADVERTISING" (006)** to `effective_year = 2025` (it doesn't exist in 2026)
3. **Set sub-metrics 007-009** (currently universal/NULL) to `effective_year = 2025` and create 2026 versions shifted -1
4. **Fix sub-metrics 010-016** 2025 mappings stay as-is; update incorrect 2026 mappings to shift -1 from original (not +1)
5. **Fix parent metrics** (total_direct_expenses, total_fixed_expense): update 2026 versions to -1
6. **Delete incorrect January 2026 data** for re-import

### Affected Departments (all on Nissan3 sheet)

- Service Department (Column D)
- Parts Department (Column H)
- Body Shop Department (Column L)

### No Code Changes Needed

The `fetchCellMappings` year-aware logic from the previous change is correct. Only the database mapping values need fixing.

### Technical Details

```sql
-- 1. Delete wrong 2026 mappings for 010-016, totals (all 3 depts)
DELETE FROM financial_cell_mappings
WHERE brand = 'Nissan' AND sheet_name = 'Nissan3'
  AND effective_year = 2026;

-- 2. Mark DIGITAL ADVERTISING (006) as 2025-only
UPDATE financial_cell_mappings
SET effective_year = 2025
WHERE brand = 'Nissan' AND sheet_name = 'Nissan3'
  AND metric_key LIKE '%006:DIGITAL ADVERTISING%'
  AND effective_year IS NULL;

-- 3. Mark 007-009 as 2025-only (they were universal)
UPDATE financial_cell_mappings
SET effective_year = 2025
WHERE brand = 'Nissan' AND sheet_name = 'Nissan3'
  AND (metric_key LIKE '%007:%' OR metric_key LIKE '%008:%' OR metric_key LIKE '%009:%')
  AND effective_year IS NULL;

-- 4. Create correct 2026 mappings for 007-016 and parents
--    (shifted -1 from 2025 cell references)
-- e.g., Service 007: D28 -> D27, 008: D29 -> D28, etc.
-- Parts 007: H28 -> H27, etc.
-- Body Shop 007: L28 -> L27, etc.

-- 5. Delete bad January 2026 financial data for re-import
```

After approval, the full SQL will handle all three departments with the correct -1 cell reference shift for every affected row.

 ## ✅ Genesis Sub-Metric Import Fix (COMPLETED)
 
 ### Problem
 Genesis brand was missing the parent `sales_expense` mapping required for sub-metrics to import correctly.
 
 ### Solution
 Added missing parent mappings for Genesis:
 - Parts: `sales_expense` → H30
 - Service: `sales_expense` → N30
 
 ### Genesis Page4 Configuration (for reference)
 - **Service sub-metrics**: Rows 75-84, skip row 79
 - **Parts sub-metrics**: Same as Hyundai (rows 64-74)
 
 **Status**: ✅ Migration completed. Re-import a Genesis financial statement to verify.
 
 ---
 
 ## ✅ Fix Hyundai/Genesis Expense Sub-Metric Name Column (COMPLETED)

### Problem
The recently created expense sub-metric mappings use `name_cell_reference: B{row}` but the line item names on Page3 are actually in **Column C**.

This causes the parser to:
1. Attempt to read names from Column B (which contains something else)
2. Get null or short values
3. Fall back to extracting "01", "02", etc. from the metric_key

### Solution
Update all 88 expense sub-metric mappings for Hyundai and Genesis to change `name_cell_reference` from Column B to Column C.

### Database Update
```sql
UPDATE financial_cell_mappings
SET name_cell_reference = CONCAT('C', SUBSTRING(name_cell_reference FROM 2))
WHERE brand IN ('Hyundai', 'Genesis')
  AND metric_key LIKE 'sub:sales_expense:%'
  AND name_cell_reference LIKE 'B%';

UPDATE financial_cell_mappings
SET name_cell_reference = CONCAT('C', SUBSTRING(name_cell_reference FROM 2))
WHERE brand IN ('Hyundai', 'Genesis')
  AND metric_key LIKE 'sub:total_direct_expenses:%'
  AND name_cell_reference LIKE 'B%';
```

### Result After Fix
| Before | After |
|--------|-------|
| `name_cell_reference: B23` | `name_cell_reference: C23` |
| `name_cell_reference: B31` | `name_cell_reference: C31` |

 ### Status
 ✅ Migration completed - 88 mappings updated from Column B to Column C.
 
 **Action Required:** Re-import a Hyundai/Genesis financial statement to see the proper ALL CAPS names.

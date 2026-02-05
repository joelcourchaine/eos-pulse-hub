

# Fix: Add Missing Ford Service Department Dealer Salary Mapping

## Problem
The `dealer_salary` metric is not being imported for Ford Service departments because the cell mapping is missing from the `financial_cell_mappings` table.

## Current State

| Department | Metric | Cell Reference | Status |
|------------|--------|----------------|--------|
| Parts Department | `total_fixed_expense` | Y13 | Exists |
| Parts Department | `dealer_salary` | Y15 | Exists |
| Service Department | `total_fixed_expense` | AB13 | Exists |
| Service Department | `dealer_salary` | AB15 | **MISSING** |

## Solution
Add the missing cell mapping for Ford Service Department `dealer_salary`:

```sql
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference)
VALUES ('Ford', 'Service Department', 'dealer_salary', 'FORD2', 'AB15');
```

## After Implementation
1. The mapping will be added to the database
2. **Re-import the December 2025 statement** for Steve Marshall Ford Service to populate the `dealer_salary` value
3. The 2026 Forecast baseline will then include the complete December 2025 data

## Technical Notes
- This is a one-line database insert
- All Ford brand stores using the standard Ford statement format will benefit from this fix
- Historical months with manually-entered `dealer_salary` values will be preserved (the import only adds missing data, it doesn't overwrite manual entries)


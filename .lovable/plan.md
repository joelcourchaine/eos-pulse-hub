
## Insert Sample Data into Growth Automotive "Top 10 Oldest RO's"

**List found:** `eda523a5-e0ba-4666-8823-70bf8de72a4d` (Growth Automotive - GMC, Service Department)  
**Existing items:** 10 empty rows with IDs already in place

### Data to insert (10 rows, 130 days → ~45 days old, today = Feb 28 2026)

| Rank | RO Date | Customer | RO # | Advisor | RO Value | Days | Status |
|------|---------|----------|------|---------|----------|------|--------|
| 1 | Oct 21, 2025 | Kowalski | RO-48821 | J. Patterson | $3,240.00 | 130 | Waiting on Parts |
| 2 | Nov 4, 2025 | Marchetti | RO-49105 | M. Delacroix | $1,875.50 | 116 | Customer Approval |
| 3 | Nov 14, 2025 | Tran | RO-49388 | J. Patterson | $5,610.00 | 106 | Insurance Pending |
| 4 | Nov 22, 2025 | Okafor | RO-49512 | S. Brennan | $920.75 | 98 | Waiting on Parts |
| 5 | Dec 1, 2025 | Henderson | RO-49701 | M. Delacroix | $2,450.00 | 89 | In Progress |
| 6 | Dec 9, 2025 | Petrov | RO-49834 | S. Brennan | $7,100.00 | 81 | Customer Approval |
| 7 | Dec 18, 2025 | Nguyen | RO-50021 | J. Patterson | $3,780.25 | 72 | Insurance Pending |
| 8 | Jan 5, 2026 | Zabriski | RO-50340 | M. Delacroix | $1,320.00 | 54 | In Progress |
| 9 | Jan 12, 2026 | Beaumont | RO-50489 | S. Brennan | $4,995.00 | 47 | Waiting on Parts |
| 10 | Jan 15, 2026 | Ramirez | RO-50567 | J. Patterson | $680.50 | 44 | In Progress |

### Action
Update all 10 existing empty `top_10_items` rows with the sample data above using their known IDs.

Single operation: UPDATE 10 rows in `top_10_items` table.



## Update Hyundai/Genesis Expense Sub-Metric Mappings

### Problem
The expense sub-metrics (`sales_expense` and `total_direct_expenses`) for Hyundai and Genesis brands use a 3-part metric_key format with hardcoded snake_case names:
- Current: `sub:sales_expense:absentee_vacation_pay`
- This stores the name as "absentee_vacation_pay" instead of reading from the statement

Meanwhile, `total_sales`, `gp_net`, and `gp_percent` use the 4-part format that dynamically reads names:
- Current: `sub:total_sales:01` → reads name from cell J77 → stores "LABOUR - CUSTOMER REPAIR ORDERS"

### Solution
Convert all Hyundai and Genesis expense sub-metric mappings from 3-part to 4-part format, using row-based ordering that matches the statement layout.

### Implementation Details

**1. Delete existing expense sub-metric mappings**
Remove all mappings where `metric_key` matches patterns:
- `sub:sales_expense:%` (but NOT parent `sales_expense`)
- `sub:total_direct_expenses:%`

For both Hyundai and Genesis brands.

**2. Insert new mappings with 4-part format**

The statement layout on Page3 is:
- **Sales Expense rows**: 23-29 (7 line items)
- **Total Direct Expenses rows**: 31-45 (15 line items, skipping row 46 which is a total)

Each mapping will use:
- `metric_key`: `sub:{parent}:{order}` (e.g., `sub:sales_expense:01`)
- `name_cell_reference`: Column B for the row (e.g., `B23`)
- `cell_reference`: Column H (Parts) or N (Service) for the row

**Sales Expense Mapping Order (rows 23-29)**:

| Order | Row | Name Cell | Description (from statement) |
|-------|-----|-----------|------------------------------|
| 01    | 23  | B23       | Manager Compensation         |
| 02    | 24  | B24       | Other Compensation           |
| 03    | 25  | B25       | Absentee/Vacation Pay        |
| 04    | 26  | B26       | Worker Comp Insurance        |
| 05    | 27  | B27       | EI/CPP/QPP                   |
| 06    | 28  | B28       | Group Insurance Pension      |
| 07    | 29  | B29       | Employee Benefits            |

**Total Direct Expenses Mapping Order (rows 31-45)**:

| Order | Row | Name Cell | Description (from statement) |
|-------|-----|-----------|------------------------------|
| 01    | 31  | B31       | Training                     |
| 02    | 32  | B32       | Stationery/Office Supplies   |
| 03    | 33  | B33       | Shop Tools/Sundry Supplies   |
| 04    | 34  | B34       | Laundry/Uniforms             |
| 05    | 35  | B35       | Janitor Services/Cleaning    |
| 06    | 36  | B36       | Policy Adj Parts/Service     |
| 07    | 37  | B37       | Advg/Promotion               |
| 08    | 38  | B38       | Maintenance of Equipment     |
| 09    | 39  | B39       | Company Vehicles             |
| 10    | 40  | B40       | Equipment Rental             |
| 11    | 41  | B41       | Software Support Fees        |
| 12    | 42  | B42       | Travel/Entertainment         |
| 13    | 43  | B43       | Telephone/Cell/Internet      |
| 14    | 44  | B44       | Postage/Freight/Express      |
| 15    | 45  | B45       | Miscellaneous                |

**3. Apply to both Hyundai and Genesis**

Genesis uses the same Page3 layout, so identical mappings apply.

**4. Data Migration (Optional)**

Existing stored data with old metric_key format (e.g., `sub:sales_expense:001:absentee_vacation_pay`) will remain but become orphaned. New imports will use the correct format. Users may need to re-import affected months to see consistent naming.

### SQL Operations

```text
┌──────────────────────────────────────────────────────────────┐
│  1. DELETE existing expense sub-metric mappings              │
│     WHERE brand IN ('Hyundai', 'Genesis')                    │
│     AND metric_key LIKE 'sub:sales_expense:%'                │
│     OR  metric_key LIKE 'sub:total_direct_expenses:%'        │
├──────────────────────────────────────────────────────────────┤
│  2. INSERT new mappings with 4-part format                   │
│     For each brand × department × parent × row:              │
│     - metric_key: sub:{parent}:{order}                       │
│     - cell_reference: {col}{row}                             │
│     - name_cell_reference: B{row}                            │
│     - parent_metric_key: {parent}                            │
│     - is_sub_metric: true                                    │
└──────────────────────────────────────────────────────────────┘
```

### Result
After implementation:
- Sub-metric names will display exactly as shown on the statement (e.g., "MANAGER COMPENSATION" instead of "manager_compensation")
- Expense line items will appear in statement order (row 23 → row 29 for Sales Expense, row 31 → row 45 for Total Direct Expenses)
- Consistent behavior with total_sales/gp_net/gp_percent sub-metrics


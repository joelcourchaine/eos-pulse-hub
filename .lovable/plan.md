

## Add Missing Hyundai Service Sub-Metric Mappings

This is a **database data fix** - the cell mapping configuration is incomplete. Row 86 ("Other Income") and row 85 are missing from the Hyundai Service department sub-metric mappings.

### Current State
The system maps these rows on Page4 for Hyundai Service:
- Rows 77, 78, 79, 80, 82, 83, 84 (7 line items)
- Row 81 is intentionally skipped (blank/total row)

### Missing Rows
- **Row 85**: Needs 3 mappings (total_sales, gp_net, gp_percent)
- **Row 86**: Needs 3 mappings (total_sales, gp_net, gp_percent) - "Other Income"

### Cell References for Missing Rows

| Row | Parent Metric | Value Cell | Name Cell |
|-----|---------------|------------|-----------|
| 85  | total_sales   | B85        | J85       |
| 85  | gp_net        | E85        | J85       |
| 85  | gp_percent    | H85        | J85       |
| 86  | total_sales   | B86        | J86       |
| 86  | gp_net        | E86        | J86       |
| 86  | gp_percent    | H86        | J86       |

### Implementation

Insert 6 new rows into `financial_cell_mappings`:

```sql
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
  -- Row 85 mappings
  ('Hyundai', 'Service', 'sub:total_sales:08', 'Page4', 'B85', 'J85', 'total_sales', true),
  ('Hyundai', 'Service', 'sub:gp_net:08', 'Page4', 'E85', 'J85', 'gp_net', true),
  ('Hyundai', 'Service', 'sub:gp_percent:08', 'Page4', 'H85', 'J85', 'gp_percent', true),
  -- Row 86 mappings (Other Income)
  ('Hyundai', 'Service', 'sub:total_sales:09', 'Page4', 'B86', 'J86', 'total_sales', true),
  ('Hyundai', 'Service', 'sub:gp_net:09', 'Page4', 'E86', 'J86', 'gp_net', true),
  ('Hyundai', 'Service', 'sub:gp_percent:09', 'Page4', 'H86', 'J86', 'gp_percent', true);
```

### After Implementation
- Re-import the financial statement for Murray Hyundai Service
- "Other Income" and the line item at row 85 will appear in the sub-metric breakdown

### Note
If row 85 is also a blank/total row that should be skipped (like row 81), let me know and I'll only add row 86.


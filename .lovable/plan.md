
# Add Honda Financial Cell Mappings

## Overview
Insert cell reference mappings for Honda brand financial statement imports. The Honda statement structure places Service and Parts departments on the "Honda3" sheet.

## Data to Insert

### Honda Service Department (Sheet: Honda3, Column J)
| Metric Key | Cell Reference |
|------------|----------------|
| total_sales | J5 |
| gp_net | J6 |
| sales_expense | J29 |
| total_direct_expenses | J53 |
| total_fixed_expense | J70 |

### Honda Parts Department (Sheet: Honda3, Column F)
| Metric Key | Cell Reference |
|------------|----------------|
| total_sales | F5 |
| gp_net | F6 |
| sales_expense | F29 |
| total_direct_expenses | F53 |
| total_fixed_expense | F70 |

## Implementation

### Database Migration
Execute the following SQL to insert the 10 new mappings:

```sql
-- Honda Service Department (Sheet: Honda3, Column J)
INSERT INTO public.financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference) VALUES
('Honda', 'Service Department', 'total_sales', 'Honda3', 'J5'),
('Honda', 'Service Department', 'gp_net', 'Honda3', 'J6'),
('Honda', 'Service Department', 'sales_expense', 'Honda3', 'J29'),
('Honda', 'Service Department', 'total_direct_expenses', 'Honda3', 'J53'),
('Honda', 'Service Department', 'total_fixed_expense', 'Honda3', 'J70');

-- Honda Parts Department (Sheet: Honda3, Column F)
INSERT INTO public.financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference) VALUES
('Honda', 'Parts Department', 'total_sales', 'Honda3', 'F5'),
('Honda', 'Parts Department', 'gp_net', 'Honda3', 'F6'),
('Honda', 'Parts Department', 'sales_expense', 'Honda3', 'F29'),
('Honda', 'Parts Department', 'total_direct_expenses', 'Honda3', 'F53'),
('Honda', 'Parts Department', 'total_fixed_expense', 'Honda3', 'F70');
```

## Notes
- These mappings align with Honda's metric structure which includes `total_direct_expenses` (used to calculate `semi_fixed_expense` as `total_direct_expenses - sales_expense` for November 2025+)
- No code changes required - the existing `parseFinancialExcel.ts` parser will automatically use these mappings when importing Honda financial statements

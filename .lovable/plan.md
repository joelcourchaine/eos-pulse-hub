

## Add Hyundai Financial Cell Mappings

### Summary
Insert 12 new financial cell mappings for Hyundai brand to enable Excel drag-and-drop import for Service and Parts departments.

### Data to Insert

| Department | Metric | Cell | Sheet |
|------------|--------|------|-------|
| Service | total_sales | N6 | Page3 |
| Service | gp_net | N7 | Page3 |
| Service | total_direct_expenses | N49 | Page3 |
| Service | semi_fixed_expenses | N51 | Page3 |
| Service | net_selling_gross | N52 | Page3 |
| Service | total_fixed_expense | N72 | Page3 |
| Parts | total_sales | H6 | Page3 |
| Parts | gp_net | H7 | Page3 |
| Parts | total_direct_expenses | H49 | Page3 |
| Parts | semi_fixed_expenses | H51 | Page3 |
| Parts | net_selling_gross | H52 | Page3 |
| Parts | total_fixed_expense | H72 | Page3 |

### Implementation
1. Run a database migration to insert the 12 Hyundai mappings into `financial_cell_mappings` table
2. Uses `ON CONFLICT DO NOTHING` to prevent duplicates if run again

### Technical Details
- **Table**: `public.financial_cell_mappings`
- **Brand**: Hyundai (new - not currently in system)
- **Sheet**: Page3
- **Service column**: N
- **Parts column**: H




## Add Hyundai Sub-Metric Cell Mappings

### Summary
Insert 60 new sub-metric cell mappings for the Hyundai brand to enable granular line-item extraction from Excel financial statements. This follows the same pattern established for Honda/Mazda.

### Mapping Structure

**Sheet**: Page4

**Column Layout**:
| Data | Column |
|------|--------|
| Name | J |
| Sales | B |
| Gross Profit | E |
| GP % | H |

**Parts Department** (11 line items, rows 64-74):
- 11 sub-metrics for `total_sales` (parent)
- 11 sub-metrics for `gp_net` (parent)  
- 11 sub-metrics for `gp_percent` (parent)

**Service Department** (9 line items, rows 77-86, skipping row 81):
- 9 sub-metrics for `total_sales` (parent)
- 9 sub-metrics for `gp_net` (parent)
- 9 sub-metrics for `gp_percent` (parent)

### Data Summary

| Department | Parent Metric | Row Range | Count |
|------------|---------------|-----------|-------|
| Parts | total_sales | 64-74 | 11 |
| Parts | gp_net | 64-74 | 11 |
| Parts | gp_percent | 64-74 | 11 |
| Service | total_sales | 77-80, 82-86 | 9 |
| Service | gp_net | 77-80, 82-86 | 9 |
| Service | gp_percent | 77-80, 82-86 | 9 |
| **Total** | | | **60** |

### Implementation
1. Run a database insert to add 60 Hyundai sub-metric mappings to `financial_cell_mappings` table
2. Each mapping includes:
   - `is_sub_metric: true`
   - `parent_metric_key` linking to the parent metric
   - `name_cell_reference` pointing to column J for dynamic name extraction
3. Uses `ON CONFLICT DO NOTHING` to prevent duplicates

### Technical Details
- **Table**: `public.financial_cell_mappings`
- **Brand**: Hyundai
- **Sheet**: Page4
- **Pattern**: Matches Honda/Mazda sub-metric structure (`total_sales`, `gp_net`, `gp_percent`)
- **Metric Key Format**: `sub:{parent}:{order}` (e.g., `sub:total_sales:01`)


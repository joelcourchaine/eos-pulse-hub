

# Add Honda Sub-Metric Cell Mappings

## Overview
Insert sub-metric cell reference mappings for Honda brand financial statement imports. The Honda5 sheet contains detailed breakdowns for Parts, Service, and Body Shop departments.

## Data Summary

| Department | Metrics | Sub-metrics per Metric | Total Rows |
|------------|---------|------------------------|------------|
| Parts Department | total_sales, gp_net, gp_percent | 15 each | 45 |
| Service Department | total_sales, gp_net, gp_percent | 10 each | 30 |
| Body Shop Department | total_sales, gp_net, gp_percent | 6 each | 18 |
| **Total** | | | **93** |

## Sheet Structure (Honda5)

### Column Layout
- **Column C**: Total Sales values
- **Column E**: GP Net values  
- **Column G**: GP Percent values

### Row Ranges
- **Parts Department**: Rows 44-59 (skipping row 55)
- **Service Department**: Rows 63-73 (skipping row 69)
- **Body Shop Department**: Rows 77-83 (skipping row 81)

## Implementation

### Database Migration
Execute SQL INSERT statements to add 93 sub-metric mappings with:
- `brand`: 'Honda'
- `sheet_name`: 'Honda5'
- `is_sub_metric`: true
- `parent_metric_key`: 'total_sales', 'gp_net', or 'gp_percent'
- `metric_key`: Format `sub:{parent}:{order}:{name}` (e.g., `sub:total_sales:001:Parts - Wholesale - Body Shop`)

## Sub-Metric Details

### Parts Department (15 line items)
1. Parts - Wholesale - Body Shop
2. Parts - Wholesale - Mechanical Repair Shop
3. Retail Counter
4. Cust. Rep. Orders Serv.
5. Cust Rep. Orders Body Shop
6. Warranty
7. Internal
8. Accessories - Honda
9. Accessories - Other
10. Parts Discount Earned
11. Parts Inventory Adjust.
12. Tires
13. Gas (Fuel), Oil & Grease
14. Battery - 12 Volt
15. Miscellaneous

### Service Department (10 line items)
1. Labour - Customer
2. Express Service
3. Warranty
4. Internal
5. P.D.I.
6. Unapplied Time
7. Detail - Customer Pay
8. Detail - Internal
9. Tire Storage
10. Sublet Repairs

### Body Shop Department (6 line items)
1. Labour - Customer
2. Internal
3. Warranty
4. Unapplied Time
5. Supplies - Body and Paint
6. Sublet Repairs

## Notes
- These mappings follow the existing sub-metric format used for other brands (e.g., Mazda)
- The `parseFinancialExcel.ts` parser already supports sub-metric mappings with `is_sub_metric: true`
- GP percent values will be automatically converted from decimal (0.28) to percentage (28%) during import
- No code changes required - the existing parser infrastructure handles these mappings automatically


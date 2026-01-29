
# Plan: Commission Scenario Tool with Flexible Department Trend View

## Overview

Build a **Payplan Scenario Tool** integrated into the Enterprise reporting section that allows you to model manager compensation scenarios. The tool will calculate commissions based on a base salary plus percentage of financial metrics (like Net Selling Gross), displayed as sub-metric rows in any department's 12-month trend view.

## Key Requirement Addressed

**Flexibility**: The payplan scenarios should work with ANY department trend view, not just "Fixed Combined". This means:
- Single departments (e.g., just "Service" or just "Parts")
- Multiple selected departments
- "Fixed Combined" (Parts + Service aggregated)
- Any other department selection

## Current Architecture Gap

The existing `FixedCombinedTrendView.tsx` is hardcoded to only work with Parts and Service departments:

```typescript
// Line 167-171 of FixedCombinedTrendView.tsx
return data?.filter(d => 
  d.name.toLowerCase().includes('parts') || 
  d.name.toLowerCase().includes('service')
) || [];
```

This needs to be made flexible to accept the user's department selection.

## Implementation Steps

### Phase 1: Make Trend View Department-Flexible

**Rename/Update FixedCombinedTrendView → FinancialTrendView**

| Change | Description |
|--------|-------------|
| Add `selectedDepartmentNames` prop | Pass from Enterprise filter panel |
| Remove hardcoded Parts/Service filter | Use `selectedDepartmentNames` to filter departments |
| Update title/subtitle | Show selected department names instead of "Fixed Combined" |

**Updated Props Interface:**
```typescript
interface FinancialTrendViewProps {
  storeIds: string[];
  selectedDepartmentNames: string[];  // NEW - pass from Enterprise
  selectedMetrics: string[];
  startMonth: string;
  endMonth: string;
  brandDisplayName: string;
  filterName: string;
  onBack: () => void;
  activePayplanScenarios?: PayplanScenario[];  // NEW - for phase 2
}
```

### Phase 2: Database Schema for Payplan Scenarios

**New Table: `payplan_scenarios`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Owner (references auth.users) |
| `name` | text | Scenario name (e.g., "Tom FOM Candidate") |
| `base_salary_annual` | numeric | Annual base salary (e.g., 78000) |
| `commission_rules` | jsonb | Array of commission rules |
| `department_names` | text[] | Applicable departments (empty = all selected) |
| `is_active` | boolean | Quick toggle for display |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update |

**Commission Rules JSON Structure:**
```json
{
  "rules": [
    {
      "source_metric": "net_selling_gross",
      "rate": 0.03,
      "min_threshold": null,
      "max_threshold": null,
      "description": "3% of Net Selling Gross"
    }
  ]
}
```

### Phase 3: Scenario Management UI

**PayplanScenarioDialog Component**

A dialog for creating/editing scenarios:

```text
┌─────────────────────────────────────────────────────────────┐
│ Create Payplan Scenario                                 [X] │
├─────────────────────────────────────────────────────────────┤
│ Scenario Name:                                              │
│ [Tom - Fixed Ops Manager Candidate                     ]    │
│                                                             │
│ Base Salary:                                                │
│ [$6,500    ] per [Monthly ▼]  = $78,000/year               │
│                                                             │
│ Commission Rule:                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Source Metric:  [Net Selling Gross              ▼]     │ │
│ │ Rate:           [3.0    ] %                            │ │
│ │ Min Threshold:  [$           ] (optional)              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [+ Add Another Rule]                                        │
│                                                             │
│ [Cancel]                              [Save Scenario]       │
└─────────────────────────────────────────────────────────────┘
```

**PayplanScenariosPanel Component**

A collapsible panel in the Financial Metrics section:

```text
┌─────────────────────────────────────────────────────────────┐
│ 💰 Payplan Scenarios                                   [+]  │
├─────────────────────────────────────────────────────────────┤
│ ☑ Tom - Fixed Ops Manager                                   │
│   $6,500/mo base + 3% of Net Selling Gross                  │
│ ☐ Sarah - Service Manager                                   │
│   $5,000/mo base + 2.5% of Department Profit                │
├─────────────────────────────────────────────────────────────┤
│ [+ Create New Scenario]                                     │
└─────────────────────────────────────────────────────────────┘
```

### Phase 4: Calculation Engine

**usePayplanCalculations Hook**

Inputs:
- Financial data (from trend view query)
- Selected payplan scenarios
- Selected departments

Logic:
1. For each selected scenario, iterate through its commission rules
2. For each rule, find the source metric value per month
3. Calculate: `commission = source_metric_value * rate`
4. Add base salary per month: `base_salary_annual / 12`
5. Return computed rows to inject into trend view

Output structure:
```typescript
interface PayplanComputedRows {
  [scenarioId: string]: {
    name: string;
    months: {
      [month: string]: {
        commission: number;
        baseSalary: number;
        totalComp: number;
      };
    };
    sourceMetric: string;  // For placement in table
  };
}
```

### Phase 5: Trend View Integration

**Updated FinancialTrendView Rendering**

When payplan scenarios are active, insert computed rows below the source metric:

```text
┌──────────────────┬─────────┬─────────┬─────────┬───────────┐
│ Metric           │ Feb 25  │ Mar 25  │ Apr 25  │ Total     │
├──────────────────┼─────────┼─────────┼─────────┼───────────┤
│ Net Selling Gross│ $125K   │ $142K   │ $138K   │ $405K     │
│ ↳ Commission 3%  │ $3,750  │ $4,260  │ $4,140  │ $12,150   │
│ ↳ Base Salary    │ $6,500  │ $6,500  │ $6,500  │ $19,500   │
│ ↳ Total Comp     │ $10,250 │ $10,760 │ $10,640 │ $31,650   │
├──────────────────┼─────────┼─────────┼─────────┼───────────┤
│ Department Profit│ $45K    │ $52K    │ $48K    │ $145K     │
└──────────────────┴─────────┴─────────┴─────────┴───────────┘
```

Visual styling:
- Payplan rows use a light blue/teal background to distinguish from regular metrics
- `↳` prefix indicates derived/calculated rows
- Scenario name appears in a tooltip or expandable header

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/enterprise/PayplanScenarioDialog.tsx` | Create/edit scenario dialog |
| `src/components/enterprise/PayplanScenariosPanel.tsx` | List and select scenarios |
| `src/hooks/usePayplanScenarios.ts` | CRUD operations for scenarios |
| `src/hooks/usePayplanCalculations.ts` | Commission calculation logic |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/enterprise/FixedCombinedTrendView.tsx` | Add `selectedDepartmentNames` prop, remove hardcoded filter, add `activePayplanScenarios` prop for computed rows |
| `src/pages/Enterprise.tsx` | Pass `selectedDepartmentNames` to trend params, add PayplanScenariosPanel to Financial Metrics section |

## Department Flexibility Matrix

| Selection | Behavior |
|-----------|----------|
| Single department (e.g., "Service") | Show only Service data, payplan calculates on Service metrics |
| Multiple departments (e.g., "Parts", "Service") | Show each separately OR aggregated based on user preference |
| "Fixed Combined" | Aggregate Parts + Service (current behavior) |
| All departments | Show all available departments with their financial data |

## Edge Cases

1. **Missing data months**: Show "-" for commission (no calculation if source metric missing)
2. **Multiple scenarios active**: Show each scenario's rows below the same source metric
3. **Different source metrics per scenario**: Each scenario's rows appear below their respective source metric
4. **Multi-store view**: Aggregate metrics across stores first, then calculate commission on total

## Security

- RLS policies: Users can only see/edit their own scenarios
- Validate commission rates (0-100%)
- Validate base salary is positive

## Future Enhancements

1. **Tiered Commissions**: Multiple rate tiers based on thresholds
2. **Team Scenarios**: Share scenarios with other users in same store group
3. **What-If Analysis**: Adjust source metrics manually to project compensation
4. **Comparison Mode**: Side-by-side comparison of multiple scenarios
5. **PDF/Excel Export**: Include payplan rows in exported reports

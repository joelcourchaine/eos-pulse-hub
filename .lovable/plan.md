
# Plan: Fix Manual Visual Mapper Mappings to Take Precedence Over Fuzzy Matching

## Problem Summary

When a user manually maps "All Repair Orders" (department totals row) to Jake in the Visual Mapper, but Jake also appears as an individual advisor in the report, the system incorrectly uses Jake's personal advisor metrics instead of the department totals metrics.

**Current Behavior:**
1. Visual Mapper: "All Repair Orders" row → Jake (manual mapping)
2. Report parsing finds: "Advisor 1234 - Jake Smith" as an advisor
3. Fuzzy matching matches "Jake Smith" → Jake's user ID
4. Import uses Jake's personal advisor row data (wrong)

**Expected Behavior:**
1. Visual Mapper cell mappings should take precedence
2. Since Jake was manually mapped to "All Repair Orders", his KPIs should pull from the department totals row
3. Jake should NOT appear in the fuzzy-matched advisor list since he has explicit cell mappings

## Root Cause

In `ScorecardImportPreviewDialog.tsx`, line 325:
```typescript
if (advisorUserIds.has(mappedUserId)) continue; // Skip - already processed with advisors
```

This logic is backwards. It skips users with cell mappings if they also appear in `advisorMatches`, but the correct behavior is:
- Users with explicit cell mappings should be processed using those mappings
- These users should be EXCLUDED from advisor fuzzy matching entirely

## Solution

### 1. Exclude Users with Cell Mappings from Advisor Matching

**File: `src/components/scorecard/ScorecardImportPreviewDialog.tsx`**

Before running fuzzy matching in the `matchAdvisors` useEffect, filter out users who already have cell mappings. If a user has cell mappings configured in the Visual Mapper, they should not appear in the advisor matches list at all.

```typescript
// After getting cellMappings, identify users with explicit mappings
const usersWithCellMappings = new Set(
  cellMappings?.map(cm => cm.user_id).filter(Boolean) || []
);

// Filter advisorMatches to exclude users already mapped via Visual Mapper
const filteredAdvisorMatches = advisorMatches.filter(match => {
  const matchedUserId = match.userId || match.selectedUserId;
  return !matchedUserId || !usersWithCellMappings.has(matchedUserId);
});
```

### 2. Update Import Logic Priority

**File: `src/components/scorecard/ScorecardImportPreviewDialog.tsx`**

Change the import logic to:
1. First process all users with explicit cell mappings (using the row/column they're mapped to)
2. Then process remaining advisor matches that don't have cell mappings

Current logic (wrong):
```typescript
// Build advisorUserIds from fuzzy matches
const advisorUserIds = new Set(advisorMatches.map(m => m.userId || m.selectedUserId)...);

// Skip cell-mapped users if they're in advisorUserIds
if (advisorUserIds.has(mappedUserId)) continue;
```

New logic (correct):
```typescript
// Build cellMappedUserIds from Visual Mapper
const cellMappedUserIds = new Set(userCellMappingsLookup.keys());

// Process ALL users with cell mappings first (including those also fuzzy-matched)
for (const [mappedUserId, userMappings] of userCellMappingsLookup.entries()) {
  // Determine if this user's mappings point to department totals or an advisor row
  // Use the appropriate data source based on the row_index stored in the mapping
  processUserWithCellMappings(mappedUserId, userMappings);
}

// Then process advisor matches that DON'T have cell mappings
for (const match of advisorMatches) {
  const assignedUserId = match.selectedUserId || match.userId;
  if (cellMappedUserIds.has(assignedUserId)) continue; // Already processed
  // Use legacy fallback matching
}
```

### 3. Determine Data Source from Cell Mapping Row Offset

When processing a user with cell mappings, determine whether to pull data from:
- Department totals row (if mapped to "All Repair Orders")
- Individual advisor row (if mapped to a specific advisor)

This is already partially implemented but needs refinement:

```typescript
for (const { colIndex, kpiId, rowOffset } of userMappings) {
  // Check if this mapping points to department totals or an advisor
  const isDepartmentTotals = !advisorAnchorRows.includes(rowOffset);
  
  if (isDepartmentTotals) {
    // Use parseResult.departmentTotalsByIndex
    const value = parseResult.departmentTotalsByIndex[payType]?.[colIndex];
  } else {
    // Find the advisor that matches this row and use their metrics
    const advisor = findAdvisorByRowOffset(parseResult, rowOffset);
    const value = advisor?.metricsByIndex[payType]?.[colIndex];
  }
}
```

### 4. Update Preview Display

**File: `src/components/scorecard/ScorecardImportPreviewDialog.tsx`**

The preview table should show:
- Users with cell mappings (showing data from their mapped rows)
- Fuzzy-matched advisors WITHOUT cell mappings
- "Dept Totals" badge for users mapped to totals rows

Update the preview values calculation:

```typescript
// For users with cell mappings, check if their mapping points to dept totals
const isPointingToDeptTotals = checkIfMappingPointsToDeptTotals(userMappings, parseResult);

if (isPointingToDeptTotals) {
  // Pull preview values from departmentTotalsByIndex
  previewValues[mapping.kpi_name] = parseResult.departmentTotalsByIndex[payType]?.[colIndex];
} else {
  // Pull from advisor metrics
  previewValues[mapping.kpi_name] = match.advisor.metricsByIndex[payType]?.[colIndex];
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/scorecard/ScorecardImportPreviewDialog.tsx` | Reorder processing to prioritize cell mappings, exclude cell-mapped users from fuzzy matching, update preview display |

## Technical Details

### Identifying Department Totals vs Advisor Rows

The Visual Mapper stores cell mappings with a `row_index` that represents the relative offset from the owner's anchor row. However, for users mapped to "All Repair Orders", the anchor is the department totals header.

To distinguish:
1. Check if the user has any advisorMatch in the `advisorMatches` list
2. If they do NOT match any advisor but have cell mappings → they're mapped to dept totals
3. If they DO match an advisor AND have cell mappings → cell mappings take precedence

### Data Flow

```text
Before (Wrong):
┌─────────────────┐      ┌───────────────────┐      ┌──────────────────┐
│ Parse Report    │ ──▶  │ Fuzzy Match Jake  │ ──▶  │ Use Jake's Row   │
│ (finds Jake as  │      │ to Jake's User ID │      │ (personal sales) │
│  advisor)       │      └───────────────────┘      └──────────────────┘
└─────────────────┘

After (Correct):
┌─────────────────┐      ┌────────────────────┐      ┌──────────────────┐
│ Check Cell      │ ──▶  │ Jake has mapping   │ ──▶  │ Use Dept Totals  │
│ Mappings First  │      │ to "All Repair     │      │ Row (what user   │
│                 │      │  Orders" row       │      │  configured)     │
└─────────────────┘      └────────────────────┘      └──────────────────┘
```

## Edge Cases

1. **User mapped to multiple rows**: Cell mappings can have different row offsets for different KPIs
2. **User not in store users list**: Skip processing (already handled)
3. **No cell mappings at all**: Fall back to current fuzzy matching behavior

## Testing

After implementation:
1. Map "All Repair Orders" to Jake in Visual Mapper
2. Import a report where Jake also appears as an advisor
3. Verify Jake's KPIs pull from department totals row
4. Verify Jake's personal advisor row is NOT imported (or imported to a different user if configured)

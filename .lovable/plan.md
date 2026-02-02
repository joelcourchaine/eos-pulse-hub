
# Add Drop Zone Support to Weekly Scorecard View

## Overview
Mirror the monthly scorecard drop zone functionality for the weekly/quarterly view, allowing users to drop the same Excel file but import data for a specific week timeframe instead of a month.

## Current State
- Monthly view: Each month column header is wrapped in `ScorecardMonthDropZone` that accepts file drops
- Weekly view: Plain `<TableHead>` elements without drop zone capability
- Import system uses `month` field (e.g., "2026-01") to store monthly entries
- Weekly entries use `week_start_date` field instead

## Implementation Plan

### 1. Create New ScorecardWeekDropZone Component
Create a new component similar to `ScorecardMonthDropZone` but tailored for weekly imports:

**File: `src/components/scorecard/ScorecardWeekDropZone.tsx`**
- Accept `weekStartDate` (ISO date string like "2026-01-06")
- Accept `weekLabel` for display (e.g., "1/6-1/12")
- Parse dropped Excel files using the same `parseCSRProductivityReport` parser
- Override the result to use week context instead of month
- Support same import log display functionality

### 2. Update ScorecardGrid.tsx - Weekly Headers
Wrap the weekly column headers (lines 3201-3242) with the new drop zone:

```typescript
// Current (without drop zone):
<TableHead key={week.label} className={...}>
  <div>...</div>
</TableHead>

// Updated (with drop zone):
<TableHead key={week.label} className={...}>
  <ScorecardWeekDropZone
    weekStartDate={weekDate}
    weekLabel={week.label}
    onFileDrop={handleWeekFileDrop}
    onReimport={handleWeekReimport}
    importLog={weekImportLogs[weekDate]}
  >
    <div>...</div>
  </ScorecardWeekDropZone>
</TableHead>
```

### 3. Add Week-Specific Import Handler
Create new handler in `ScorecardGrid.tsx`:

```typescript
const handleWeekFileDrop = useCallback((
  result: CSRParseResult, 
  fileName: string, 
  weekStartDate: string, 
  file: File
) => {
  // Set week context instead of month
  setDroppedParseResult(result);
  setDroppedFileName(fileName);
  setDroppedFile(file);
  setImportWeekStartDate(weekStartDate); // New state
  setImportPreviewOpen(true);
}, []);
```

### 4. Update Import Preview Dialog
Modify `ScorecardImportPreviewDialog.tsx` to handle both monthly and weekly imports:
- Accept optional `weekStartDate` prop
- When `weekStartDate` is provided, save entries with `week_start_date` instead of `month`
- Update the upsert conflict key to `kpi_id,week_start_date`

### 5. Track Weekly Import Logs
Add state and fetching for week-specific import logs:

```typescript
const [weekImportLogs, setWeekImportLogs] = useState<{ [weekDate: string]: ScorecardImportLog }>({});
```

Query `scorecard_import_logs` filtering by week identifiers when in weekly mode.

### 6. Storage Considerations
Update the import log storage to differentiate between monthly and weekly imports:
- Add `import_type` field or use `month` vs `week_start_date` to differentiate
- Store week imports with `week_start_date` identifier

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/scorecard/ScorecardWeekDropZone.tsx` | **New file** - Week-specific drop zone component |
| `src/components/scorecard/ScorecardGrid.tsx` | Wrap weekly headers with drop zones, add week import handlers and state |
| `src/components/scorecard/ScorecardImportPreviewDialog.tsx` | Support `weekStartDate` prop for weekly imports |
| `src/components/scorecard/ScorecardMonthDropZone.tsx` | Extract shared logic or keep separate (can decide during implementation) |

## Technical Notes

1. **Same Parser**: The Excel file format is identical; only the target period changes
2. **Entry Type**: Weekly imports will set `entry_type: 'weekly'` in scorecard_entries
3. **Date Key**: Weekly entries use `week_start_date` (Monday of the week) as the period key
4. **Import Logs**: Will need to query by week dates rather than month identifiers when loading logs
5. **Re-import**: Same re-import functionality as monthly - download file from storage, re-parse, show preview

## User Experience
- Drag Excel file onto any week column header in weekly view
- See "Drop to import" overlay (same as monthly)
- Preview dialog shows parsed advisors
- Import saves to `scorecard_entries` with `week_start_date` and `entry_type: 'weekly'`
- Green/amber indicator appears on week header after successful import
- Click indicator to view import details or re-import

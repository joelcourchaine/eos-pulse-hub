
## Fix: CSR Report Mapper - Date Row Exclusion and Advisor Detection

### Problem 1: Date Rows Should Not Be Mappable
Rows containing only date ranges (e.g., "01/01/2026 - 01/31/2026") appear throughout the report but have no useful data for mapping. These rows should be visually distinguished and excluded from mapping interactions.

### Problem 2: Advisor Rows Before Header Not Detected
The current parser only scans for advisor patterns in rows **after** the header row. If an advisor name appears in row 5 (before the header row), it won't be detected as an advisor, preventing users from mapping it.

---

### Technical Solution

**File: `src/components/admin/scorecard-mapper/ScorecardVisualMapper.tsx`**

1. **Add date row detection during parsing**
   - Create a helper function to detect if a row is a date-only row (contains date range pattern but no meaningful data)
   - Track date row indices similar to advisor row indices

2. **Extend advisor detection to metadata rows**
   - Scan metadata rows (before header) for advisor patterns
   - Add any found advisors to `advisorRowIndices` and `advisorNames`

```typescript
// Helper to detect date-only rows
const isDateOnlyRow = (row: any[]): boolean => {
  // Date range pattern: "01/01/2026 - 01/31/2026" or similar
  const dateRangePattern = /^\d{1,2}\/\d{1,2}\/\d{4}\s*[-–]\s*\d{1,2}\/\d{1,2}\/\d{4}$/;
  
  for (const cell of row) {
    const cellStr = String(cell ?? "").trim();
    if (cellStr && dateRangePattern.test(cellStr)) {
      // Check if this is the only meaningful content in the row
      const otherContent = row.filter(c => {
        const s = String(c ?? "").trim();
        return s && !dateRangePattern.test(s);
      });
      return otherContent.length === 0;
    }
  }
  return false;
};

// In parseWorkbookToParsedData:
// 1. Add dateRowIndices array to track date rows
// 2. Check metadata rows for advisors AND date patterns
// 3. Return dateRowIndices in the ParsedExcelData interface
```

**File: `src/components/admin/scorecard-mapper/ExcelPreviewGrid.tsx`**

1. **Accept dateRowIndices prop**
   - Add to interface and component props

2. **Render date rows with distinct styling**
   - Grey/muted background
   - Non-clickable cells
   - Visual indicator that the row is excluded

3. **Skip date rows in mapping logic**
   - Don't allow cell click handlers on date rows
   - Don't show mapping indicators

---

### Changes Summary

| File | Change |
|------|--------|
| `ScorecardVisualMapper.tsx` | Add date row detection, extend advisor scanning to metadata rows, pass `dateRowIndices` to grid |
| `ExcelPreviewGrid.tsx` | Accept `dateRowIndices` prop, style date rows as disabled/non-mappable |

### Interface Updates

```typescript
// ParsedExcelData
interface ParsedExcelData {
  headers: string[];
  rows: (string | number | null)[][];
  advisorRowIndices: number[];
  advisorNames: { rowIndex: number; name: string }[];
  headerRowIndex: number;
  dateRowIndices: number[]; // NEW: rows that are date-only
}

// ExcelPreviewGridProps
interface ExcelPreviewGridProps {
  // ... existing props
  dateRowIndices?: number[]; // NEW
}
```

### Visual Result
- Date rows will appear greyed out with a "date" indicator
- Advisor rows in metadata section will be properly detected and clickable
- No change to existing mapping functionality for valid data rows

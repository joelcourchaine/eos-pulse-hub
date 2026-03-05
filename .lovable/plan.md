
## The KPIs are Not the Problem

Existing KPIs attached to technicians have zero effect on the import preview. The preview dialog builds its technician list entirely from `parseResult.technicians` — if that array is empty, nothing shows. The database isn't consulted until after you click Import.

**The real issue remains the parser failing to detect technicians from the River City Ram file.** Without seeing the actual file structure, we're guessing at column positions and label names. The most efficient fix is to add debug output to the parser that surfaces directly in the preview dialog when 0 technicians are found — this will tell us exactly what the RAM file looks like.

---

## Plan: Add Parse Debug Info When 0 Technicians Detected

### Change 1 — `src/utils/parsers/parseTechnicianHoursReport.ts`

Extend `TechnicianHoursParseResult` with an optional `debugInfo` field:

```typescript
debugInfo?: {
  sheetName: string;
  totalRows: number;
  headerRowIndex: number;
  dateColIdx: number;
  soldColIdx: number;
  clockColIdx: number;
  detectedLayout: string;
  first10DataRows: string[][];   // first 10 rows after header as raw strings
  headerRowContent: string[];     // the actual header row cell values
}
```

Populate this always but only include `first10DataRows` when technicians.length === 0 so there's no performance cost in the normal case.

### Change 2 — `src/components/scorecard/TechnicianImportPreviewDialog.tsx`

When `parseResult.technicians.length === 0`, instead of showing an empty list, show a debug panel:

```
No technicians detected in this file.

Parse debug info:
  Sheet: "Sheet1"   Total rows: 142
  Header row: 12    Layout: "RAM fallback (0,2,4)"
  Date col: 0   Sold col: 2   Clock col: 4

  Header row content:
    [Date] [??] [Flat Rate Hrs] [??] [Available Hrs] ...

  First 10 data rows (after header):
    Row 13: ["1/2/2025", "", "8.5", "", "7.0", ...]
    Row 14: ["John Smith", "", "", "", "", ...]
    ...
```

This panel shows inline in the dialog — no new UI needed beyond a `pre`/`code` block with a copy button. It will immediately reveal:
- Whether dates are in the right column
- What the actual column header names are
- Whether technician names are on separate rows or inline

---

### Files to change: 2

| File | Change |
|---|---|
| `src/utils/parsers/parseTechnicianHoursReport.ts` | Add `debugInfo` to result type + populate it |
| `src/components/scorecard/TechnicianImportPreviewDialog.tsx` | Show debug panel when 0 technicians parsed |

No DB changes. No migration. This gives us the information needed to fix the parser correctly for the RAM format on the next pass.

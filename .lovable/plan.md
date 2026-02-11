

## Import Preview: Manual User Assignment

### Completed
The import preview dialog now lets users manually assign every row — including "All Repair Orders" (Dept Totals) — via dropdowns instead of auto-guessing.

### What Changed (`ScorecardImportPreviewDialog.tsx`)
- **Removed** `matchUsersByNames` fuzzy matching — no more guessing
- **Removed** `manualOverrideUserIds` and `deptTotalsUsers` auto-map logic
- **Removed** auto-assignment of department manager to "All Repair Orders"
- **Added** dropdowns for every row, including a dedicated "All Repair Orders" row with Dept Totals badge
- **Pre-fills** from saved aliases only — if a user was previously assigned, the dropdown remembers
- **Saves** new assignments as aliases on import for next time
- **Shows** "Saved" badge on pre-filled rows so users know what's remembered

### Store-Scoped Cell Mappings (Previously Completed)
- Visual Mapper and Import Preview filter cell mappings to only include users from the selected store
- Prevents cross-store mapping leakage

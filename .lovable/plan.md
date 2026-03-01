
Yes — the Import dialog (`ScorecardImportDropZone`) already has **both slots** side by side:

- **Left slot** → Service Advisors (CSR Productivity Report) — uses `parseCSRProductivityReport` → opens `ScorecardImportPreviewDialog`
- **Right slot** → Technicians (Technician Hours Report) — uses `parseTechnicianHoursReport` → opens `TechnicianImportPreviewDialog`

The plan is simply to wire this dialog into the scorecard toolbar so you can actually reach it.

## What needs to be done

**`src/components/scorecard/ScorecardGrid.tsx`**
1. Import `ScorecardImportDropZone`
2. Add `importOpen` state
3. Add an "Import" button in the toolbar (visible to `canManageKPIs` users)
4. Render `<ScorecardImportDropZone>` with `storeId`, `departmentId`, and `onImportComplete` wired up

That's a single file, ~10 line change. Once done, clicking **Import** opens the dialog with both the CSR Advisor drop zone and the Technician drop zone right next to each other — you drop whichever report applies.

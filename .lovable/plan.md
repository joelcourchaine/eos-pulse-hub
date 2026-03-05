
## Rename "Closed Hours" → "Open and Closed Hours" Everywhere + Remove Selector UI

### What needs to change

**1. Database — rename existing KPI definitions (data update)**

There are 27 existing `kpi_definitions` rows named `"Closed Hours"` across 3 stores:
- 6 at Courtenay Nissan
- 14 at Steve Marshall Ford
- 7 at River City Ram

These need to be renamed to `"Open and Closed Hours"` via a data UPDATE (not a migration).

Also update `departments.technician_sold_hours_label` where it's set to `"closed_hours"` → `"open_and_closed_hours"`.

**2. Code — `src/components/scorecard/TechnicianImportPreviewDialog.tsx`**

- Remove the `SOLD_HOURS_OPTIONS` array and `getSoldHrsKpiName` function
- Hardcode `soldHrsLabel` to `"open_and_closed_hours"` (remove `useState` for it)
- Remove the department query for `technician_sold_hours_label` (no longer needed)
- Remove the `saveLabelMutation`
- Remove the entire "Sold Hours KPI Name" UI block (lines 499–537) — the settings panel with the Select dropdown and Save button
- Replace `getSoldHrsKpiName(soldHrsLabel)` call (line 266) with the hardcoded string `"Open and Closed Hours"`
- Remove `labelSaved` state

### Files to change: 1 code + 1 data update

| Change | Detail |
|---|---|
| DB data update | `UPDATE kpi_definitions SET name = 'Open and Closed Hours' WHERE name = 'Closed Hours'` |
| DB data update | `UPDATE departments SET technician_sold_hours_label = 'open_and_closed_hours' WHERE technician_sold_hours_label = 'closed_hours'` |
| `TechnicianImportPreviewDialog.tsx` | Remove selector UI, hardcode KPI name to "Open and Closed Hours" |

No migration needed (schema unchanged). No other files reference the KPI name label selection logic.


## Root Causes Found

### 1. Wrong column mapped to "Available Hours"
The report has 3 relevant columns:
- Col D (index 3): **Actual Hrs** → this is what should be "Available Hours"
- Col E (index 4): **Sold Hrs** → this should be "Open and Closed Hours" / "Closed Hours"
- Col G (index 6): **Clocked In Hrs** → this is a 3rd metric (not currently captured)

The current parser only captures 2 columns (Sold + Clocked In), but maps "Clocked In Hrs" as `clockedInHrs` which then becomes "Available Hours" in the import dialog. However, looking at the report data, **Actual Hrs** (col D) is the correct "Available Hours" and **Clocked In Hrs** (col G) is a separate value. Since the "Productive" KPI is sold/available, the parser needs to use **Actual Hrs** for `clockedInHrs` (which is written to "Available Hours").

The column header row is: `Date | Actual Hrs | Sold Hrs | Sold/Actual% | Clocked In Hrs | ...`

The parser currently finds "Clocked In Hrs" with `c.includes("clocked in")` and uses that as `clockColIdx`. But the import code uses `clockedInHrs` as "Available Hours". So the fix is: the parser should capture **"Actual Hrs" (col D/index 3)** as `clockedInHrs` (= Available Hours), not "Clocked In Hrs".

### 2. Import is extremely slow — hundreds of individual DB round-trips
The import loop does `await supabase.from("scorecard_entries").upsert(...)` one-at-a-time for every weekly and monthly entry. With 6 technicians × ~13 weeks × 3 KPIs = ~234 weekly upserts + monthly upserts, that's hundreds of sequential DB calls.

### 3. Name case mismatch
`6189 - VINCENTE CASTILLO` → stripped to `VINCENTE CASTILLO` but alias was saved as `Vincente Castillo`. The alias lookup uses `.toLowerCase()` on both sides so it should match, but the `displayName` stored in the mapping will be uppercase, which looks odd. Need to normalize to title case.

---

## Fix Plan

### Fix A — Parser: capture "Actual Hrs" as the available hours column
In `parseTechnicianHoursReport.ts`:
- Change the column detection for `clockColIdx` to look for `"actual hrs"` instead of `"clocked in"`.
- The existing fallback column indices also need to change: `actualColIdx = 3` (not 6).
- Rename variable from `clockColIdx` to `actualColIdx` for clarity.
- Keep collecting the same `clockedInHrs` field name since the import dialog maps it to "Available Hours".

### Fix B — Import: batch all scorecard_entries upserts
In `TechnicianImportPreviewDialog.tsx`:
- Collect all weekly entries across all technicians into one array.
- Collect all monthly entries into a second array.
- Upsert in batches of 500 using a loop with a 50ms yield between batches.
- This reduces ~250+ sequential calls to 1-2 batched calls.

### Fix C — Name normalization  
In the parser, after stripping the numeric prefix, apply title-case normalization so `VINCENTE CASTILLO` becomes `Vincente Castillo`. This ensures alias lookups and display names are consistent.

### Files to change
- `src/utils/parsers/parseTechnicianHoursReport.ts` — Fix A + Fix C
- `src/components/scorecard/TechnicianImportPreviewDialog.tsx` — Fix B

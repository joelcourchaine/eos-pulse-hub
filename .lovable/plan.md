

## Add Excel Attachment with Color-Coded Cells to Enterprise Comparison Email

### Overview

When emailing the Enterprise dealer comparison report, the email will include an Excel (.xlsx) file attachment that preserves the red/green/yellow visual cues from the UI. The HTML email body will remain as a summary, and the Excel file will be attached for recipients to download and work with.

### What Changes

**1. Email Dialog -- Add "Attach Excel" Toggle**

File: `src/components/enterprise/EmailComparisonDialog.tsx`

- Add a checkbox/switch labeled "Attach Excel report" (default: on)
- Pass a new `attachExcel: true/false` field in the request body to the backend function
- No other UI changes needed -- the dialog stays the same otherwise

**2. Backend Function -- Generate Excel with Color-Coded Cells**

File: `supabase/functions/send-dealer-comparison-email/index.ts`

- Replace the `xlsx` import with `xlsx-js-style` (a drop-in replacement that supports cell fill colors, built on the same SheetJS 0.18.5 used elsewhere in the project)
- Add a `generateExcelBuffer()` function that:
  - Creates one worksheet with all stores as columns and metrics as rows
  - Applies proper number formatting (currency `$#,##0` for dollar values, `0.0%` for percentages)
  - Color-codes cells based on variance thresholds matching the UI logic:
    - **Standard mode**: Green fill for variance >= 10%, yellow for -10% to +10%, red for < -10%
    - **YOY mode**: Green fill for favorable difference, red for unfavorable (respecting `lowerIsBetter` flag)
    - **Questionnaire mode**: Green fill for "Yes", red fill for "No"
  - Handles all three report layouts (standard, YOY 3-column, questionnaire)
- When `attachExcel` is true in the request body, generate the Excel buffer and include it as a Resend attachment alongside the existing HTML email body
- The email subject and HTML body remain the same -- the Excel is purely additive

### Color Mapping (Excel Cell Fills)

```text
Standard Comparison:
  variance >= 10%  --> Green fill (RGB: C6EFCE), dark green font (RGB: 006100)
  variance -10-10% --> Yellow fill (RGB: FFEB9C), dark yellow font (RGB: 9C5700)
  variance < -10%  --> Red fill   (RGB: FFC7CE), dark red font   (RGB: 9C0006)

YOY Comparison (Diff column):
  Favorable diff   --> Green fill (RGB: C6EFCE)
  Unfavorable diff  --> Red fill   (RGB: FFC7CE)

Questionnaire:
  "Yes" / "True"   --> Green fill (RGB: C6EFCE)
  "No"  / "False"  --> Red fill   (RGB: FFC7CE)
```

These are standard Excel conditional formatting colors that look clean in all spreadsheet applications.

### Excel Layout

**Standard mode** -- one sheet:
```text
| Metric           | Store A  | Store B  | Store C  |
|------------------|----------|----------|----------|
| Total Sales      | $500,000 | $450,000 | $520,000 |
| GP %             |   45.2%  |   42.1%  |   48.3%  |
```
Each value cell gets a background color based on its variance.

**YOY mode** -- one sheet with 3 sub-columns per store:
```text
| Metric      | Store A (2025) | Store A (2024) | Store A Diff | Store B ... |
|-------------|----------------|----------------|--------------|-----------|
| Total Sales |     $500,000   |     $450,000   |    +$50,000  |    ...    |
```
The "Diff" column cells get colored green/red based on favorable/unfavorable.

**Questionnaire mode** -- one sheet:
```text
| Question              | Store A | Store B |
|-----------------------|---------|---------|
| Do you track CSI?     |   Yes   |   No    |
```

### Technical Details

- Uses `xlsx-js-style` from `https://esm.sh/xlsx-js-style@1.6.0` -- this is a community fork of SheetJS that adds cell style support (fill, font color, borders) while maintaining full API compatibility
- The Excel file is base64-encoded and sent via Resend's `attachments` API field (same pattern already used by the KPI Trend and Financial Trend email functions)
- File naming convention: `Dealer_Comparison_Report_Jan_2025.xlsx`

### Files Modified

1. `src/components/enterprise/EmailComparisonDialog.tsx` -- add attach-Excel toggle + pass flag
2. `supabase/functions/send-dealer-comparison-email/index.ts` -- add Excel generation with color fills + attachment logic

### No Database Changes Required


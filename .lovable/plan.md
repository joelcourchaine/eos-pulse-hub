
## Root Cause

The screenshot shows the **old** template. The new code IS deployed and correct in the file — the problem is twofold:

1. **The user clicked the old Dashboard email button**, not the new "Email" button in the GO Scorecard header. The Dashboard sends no `roleFilter` and the email used the old cached deployment.

2. **Even with the new code, Gmail will break the layout** because:
   - `display: flex` is stripped by Gmail, Outlook, and most email clients
   - `rgba()` colors are not supported in many clients
   - The header stats badges will not render correctly

## Fix Plan

### Edge function — fix Gmail-compatible HTML

Replace `display: flex` with `<table>`-based layout for the header stats row. Replace `rgba()` with solid hex colors. This ensures the navy header renders perfectly in Gmail, Outlook, Apple Mail.

**Header fix** (lines 676–685):
```html
<!-- Use table layout instead of flex for email client compatibility -->
<table style="border-collapse: collapse; margin-top: 10px; width: 100%;">
  <tr>
    <td style="padding-right: 8px;">
      <span style="background-color: #2d4a6b; border-radius: 4px; padding: 4px 10px; font-size: 12px; font-weight: 600; color: #ffffff; display: inline-block;">${reportTitle} · 13 weeks</span>
    </td>
    <td style="padding-right: 8px;">
      <span style="background-color: #2d4a6b; ...">Weeks Entered: ${weeksWithData}/13</span>
    </td>
    <td>
      <span style="background-color: #059669 (or amber/red based on rate); ...">🎯 ${greenRate}% Green Rate</span>
    </td>
  </tr>
</table>
```

Also fix `rgba(255,255,255,0.12)` → solid `#2d4a6b` (a lighter navy).

### No other changes needed

The single-table structure, navy styles, saturated cell colors, and Σ Totals rows are all correct in the current code and will render properly once the Gmail-incompatible CSS is fixed.

### Files to change

- **`supabase/functions/send-scorecard-email/index.ts`** — replace `display: flex` + `rgba()` in the weekly header (lines 676–685) with table-based layout and solid hex colors. Then redeploy.

After this fix, the user should use the **"Email" button in the GO Scorecard header** (not the Dashboard button) for the role-filtered send. The Dashboard button sends all roles as it always did.

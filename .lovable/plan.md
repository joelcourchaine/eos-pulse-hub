
## Problem

The "Email Scorecard Report" dialog in `src/pages/Dashboard.tsx` (lines 1380–1407) only shows pre-loaded profiles in the Recipients section. There is no "Additional emails" input for custom/external addresses — unlike the `EmailTop10Dialog` and `EmailTodosDialog` components which both have this field.

## Fix

Add a custom email input below the recipient checkboxes in the Email Scorecard dialog, matching the pattern from the other email dialogs:

1. **Add state** for `customEmailInput` (string) near the other email state vars (~line 99)
2. **Add `useMemo`** to parse/validate the custom input into `validatedCustomEmails` and `invalidEntries` (same zod-based logic as other dialogs)
3. **Add the UI** below the recipients box — a labeled `Input` with "comma-separated" hint, invalid entry warning, and reset `customEmailInput` on dialog close
4. **Update `handleEmailScorecard`** to merge `validatedCustomEmails` into `allRecipients` alongside `selectedEmailRecipients`
5. **Update the send button** disabled condition to check `selectedEmailRecipients.length + validatedCustomEmails.length === 0`
6. **Reset** `customEmailInput` to `""` when dialog closes (in `onOpenChange` and after successful send)

Also need to add `useMemo` import if not already present.

## Files to change

- `src/pages/Dashboard.tsx`:
  - Add `customEmailInput` state (~line 99)
  - Add `useMemo` to imports
  - Add `useMemo` block for validating custom emails
  - Update `handleEmailScorecard` to combine recipients + custom emails
  - Add custom email `Input` UI inside the dialog after the recipients box (~line 1407)
  - Reset `customEmailInput` on close and on successful send

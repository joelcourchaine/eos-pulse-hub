

## Add Numbered Notes Column to Dealer Comparison Table

### Overview
Add a "Notes" column as the last column in the dealer comparison table. Each row with a note gets an auto-incrementing number displayed in a purple bubble (e.g., 1, 2, 3...). Only rows where you type a note get a number. The notes and their numbers are included in the emailed report (HTML and Excel) so recipients can reference them by number in their replies.

### How It Works
- A "Notes" column appears as the rightmost column in the table
- Each note input shows a compact text field with placeholder "Add note..."
- When you type a note, a purple numbered bubble (starting at 1) appears to the left of the text
- Numbers are sequential -- only rows with actual notes get a number
- When emailing, the notes column is included with the purple numbered references
- The Excel attachment also includes a "Notes" column with the numbers

### UX Details
- Purple bubble: small circle with white text, background color ~#7c3aed (purple-600)
- Numbers only appear on rows that have a note typed in
- If no notes are entered, the Notes column still shows but is empty
- Notes are ephemeral (local state only, not saved to the database)

---

### Technical Changes

**1. `src/pages/DealerComparison.tsx`**
- Add `rowNotes` state: `Record<string, string>` keyed by metric `selectionId`
- Compute `noteNumberMap`: a derived map that assigns sequential numbers (1, 2, 3...) only to rows that have non-empty notes
- Add a "Notes" `TableHead` after all store columns in both the standard and three-column header rows
- Add a `TableCell` in each metric row containing:
  - A purple numbered bubble (only if note is non-empty)
  - A compact `<input>` for typing the note
- Pass `rowNotes` to `EmailComparisonDialog`

**2. `src/components/enterprise/EmailComparisonDialog.tsx`**
- Accept new prop `rowNotes?: Record<string, string>`
- Pass `rowNotes` in the edge function request body

**3. `supabase/functions/send-dealer-comparison-email/index.ts`**
- Read `rowNotes` from request body
- Compute numbered notes list (same sequential logic as frontend)
- In all three HTML builders (standard, YOY, questionnaire): add a "Notes" column header and cell with purple numbered bubble + note text (only for rows with notes)
- In all three Excel generators: add a "Notes" column with "1. note text" format
- Only add the Notes column if at least one note exists


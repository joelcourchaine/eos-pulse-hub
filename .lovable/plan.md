

## Add Custom Email Address Input to Email Comparison Dialog

### Problem
Currently, the Email Comparison Report dialog only allows selecting from a pre-populated list of system users (Super Admins and GMs). Users with enterprise reporting access need the ability to send reports to external email addresses not in the system.

### Solution
Add a text input field below the recipient list where users can type in one or more custom email addresses. These addresses will be added to the recipient list alongside any checked system users.

### Technical Details

**File: `src/components/enterprise/EmailComparisonDialog.tsx`**

1. Add a `customEmails` state (`string`) for the text input value
2. Add a `validatedCustomEmails` derived array that parses and validates email addresses (comma or semicolon separated)
3. Add an input field with placeholder text like `"Add email addresses (comma-separated)"` between the recipient list and the "Attach Excel report" toggle
4. Show validation feedback -- display valid parsed emails as small badges/chips, highlight invalid entries
5. Update `handleSend` to merge `selectedRecipients` with `validatedCustomEmails` before sending
6. Update the send button count to reflect both system recipients and custom emails

**UI Layout (below recipient list, above the Attach Excel toggle):**
- A text input for typing email addresses
- Helper text: "Separate multiple addresses with commas"
- Parsed valid emails shown as count or inline list
- Invalid email format warning if detected

**Validation:**
- Use a simple email regex or `zod` email validation (already installed)
- Trim whitespace, split on commas/semicolons
- Deduplicate against already-selected system recipient emails
- Show inline error for invalid formats




# Fix CSR Report Import Not Pulling KPI Data for Murray Merritt

## Problem Analysis

After investigating the database, I found two distinct issues causing KPI data not to be imported for Daniel Park at Murray Merritt:

### Issue 1: Unmatched Advisor "DANIEL"

The recent CSR reports contain an advisor named "DANIEL" (and "Cole") who have no user aliases configured. The import logs confirm:
- Feb 24 import: only **4 metrics imported** (down from 11 in January), with unmatched users ["DANIEL", "Cole"]
- The system cannot map "DANIEL" to Daniel Park's profile because there is no alias, and the initialization code only uses alias-based matching (no fuzzy matching)

The "All Repair Orders" row IS correctly mapped to Daniel Park, which is why 4 department-total metrics still import. But the per-advisor "DANIEL" row data is completely lost.

### Issue 2: One-Directional KPI Name Matching

The `getKpiNameCandidates` function in `ScorecardImportPreviewDialog.tsx` only strips prefixes like "Total " and "Total CP " -- it never adds them. This means:

- Template KPI "CP ELR" generates candidates: `["cp elr"]`
- But Daniel's KPI is named "Total CP ELR" -- no match
- Template KPI "CP Hours Per RO" generates `["cp hours per ro"]`
- But Daniel's KPI is "Total CP Hours Per RO" -- no match

While duplicate template entries exist for some KPIs (both "CP ELR" and "Total CP ELR" are configured), this is fragile and doesn't cover all cases.

## Solution

### 1. Fix Build Error (logrocket type issue)

The `skipLibCheck: true` is already set in tsconfig. This appears to be a transient build issue. If it persists, we'll add a type declaration override.

### 2. Make KPI Name Matching Bidirectional

In `ScorecardImportPreviewDialog.tsx`, update `getKpiNameCandidates` to also ADD "Total " and "Total CP " prefixes, not just strip them:

```text
Current: "CP ELR" -> ["cp elr"]
Fixed:   "CP ELR" -> ["cp elr", "total cp elr"]

Current: "CP Hours" -> ["cp hours"]  
Fixed:   "CP Hours" -> ["cp hours", "total cp hours"]
```

This makes the matching robust regardless of whether the template or the user's KPI uses the "Total" prefix.

### 3. Improve Advisor Name Pre-Matching

Update the advisor initialization `useEffect` in `ScorecardImportPreviewDialog.tsx` to also attempt partial/fuzzy matching against store users when alias matching fails. This would catch cases like "DANIEL" matching "Daniel Park" via first-name matching. The existing `fuzzyNameMatch` utility supports this but it's not used during initialization.

Specifically:
- After alias lookup fails, check if the advisor's display name is a case-insensitive match for any store user's first name (when only one user matches)
- Use a conservative threshold to avoid false matches
- Mark these as non-alias matches so new aliases still get created on import

### Files to Modify

1. **`src/components/scorecard/ScorecardImportPreviewDialog.tsx`**
   - Enhance `getKpiNameCandidates` to add "Total " and "Total CP " prefixes in addition to stripping them
   - Add first-name / partial matching fallback in the advisor initialization useEffect when alias matching fails

### What Won't Be Fixed in Code

The user will still need to manually assign "DANIEL" to Daniel Park in the import preview dropdown the first time. After that, the alias will be saved automatically. The code improvement means the system will pre-suggest Daniel Park as a match (via first-name matching) rather than leaving the row blank.


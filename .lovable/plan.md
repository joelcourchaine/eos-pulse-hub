
## Fix: Hardcode exact column names — no fallbacks

The parser currently uses a wide `findIndex` with many fallback terms for `clockColIdx`. The user says there is only ever one correct mapping:
- **Clocked In Hrs** → Available Hours
- **Sold Hrs** → Open and Closed Hours

### Change in `parseTechnicianHoursReport.ts` (lines 141–156)

Replace the multi-term `soldColIdx` and `clockColIdx` detection with exact single-term matches:

```typescript
// Sold hrs — exact match only
const sIdx = normed.findIndex(c => c === "sold hrs" || c === "sold hours");

// Clocked In Hrs — exact match only  
const cIdx = normed.findIndex(c => c === "clocked in hrs" || c === "clocked in hours" || c === "clocked in");
```

This removes all ambiguous fallbacks ("actual hrs", "flat rate hrs", "labour sold", etc.) that caused the wrong column to be picked. If the report ever uses a different header, the import will surface a clear parse failure rather than silently mapping the wrong column.

### File to change
- `src/utils/parsers/parseTechnicianHoursReport.ts` — lines 141–156 only

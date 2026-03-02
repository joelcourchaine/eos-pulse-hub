
## Column map confirmed from the screenshot

| Col index | Header |
|---|---|
| 0 (A) | Technician name / row label |
| 2 (C) | Date |
| 3 (D) | Actual Hrs |
| 4 (E) | Sold Hrs |
| 5 (F) | Sold/Actual% |
| 6 (G) | Clocked In Hrs ← Available Hours |
| 7 (H) | Sold/Clocked% |

**Available Hours → Clocked In Hrs (index 6)**
**Sold Hours → Sold Hrs (index 4)** ← already correct

## One-file fix in `parseTechnicianHoursReport.ts`

**Dynamic detection (around line 131):** Change the `cIdx` findIndex to match `"clocked in"` instead of `"actual hrs"`:
```typescript
const cIdx = normed.findIndex(c =>
  c.includes("clocked in hrs") || c.includes("clocked in hours") || c === "clocked in"
);
```

**Fallback fixed index (around line 147):** Change `clockColIdx = 3` → `clockColIdx = 6`

**Comment update:** `// Col 2 = Date, Col 6 = Clocked In Hrs (Available Hours), Col 4 = Sold Hrs`

That's the entire change — no other files need to be touched.

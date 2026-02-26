
## Why December worked but January fails

The console logs confirm the error is thrown from `parseFinancialExcel.ts` line 106 (`reader.readAsBinaryString` + `XLSX.read(data, { type: 'binary' })`). 

The reason December worked but January doesn't: Mazda's DMS outputs `.xls` files (old binary format). The January 2026 file for Island Owl Mazda happens to use a slightly different internal structure (or a newer `.xls` variant) that the `xlsx` library misidentifies as encrypted when parsed in binary string mode. This is a known quirk — the `xlsx` library throws "File is password-protected" as a false positive for certain `.xls` file structures when using `type: 'binary'`.

Switching to `readAsArrayBuffer` + `type: 'array'` is the standard fix for this — it handles all `.xls`/`.xlsx` variants more robustly.

## Fix

**`src/utils/parseFinancialExcel.ts`** (lines ~180-393):
1. Change `reader.readAsBinaryString(file)` → `reader.readAsArrayBuffer(file)` 
2. Change `XLSX.read(data, { type: 'binary' })` → `XLSX.read(new Uint8Array(data as ArrayBuffer), { type: 'array' })`

This is a 2-line change. No other logic changes needed.

Also check `parseStellantisExcel.ts` for the same pattern and fix it there too (to prevent the same issue on Stellantis stores in the future).

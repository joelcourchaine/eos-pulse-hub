

## Add Retry Logic to Financial Statement Import

### Problem
Craig from Winnipeg Chevrolet is repeatedly getting "failed to fetch" errors when dragging his CSR Productivity Report into the financial grid. The Excel parsing succeeds every time (206 mappings extracted), but the network calls to storage upload or database upsert intermittently fail. This has now happened multiple times, pointing to a flaky network connection rather than a one-off glitch.

### Solution
Add automatic retry with exponential backoff to the two critical network operations in the drop handler:

1. **Storage upload** (`supabase.storage.from("financial-attachments").upload(...)`)
2. **Database upsert** (`supabase.from("financial_attachments").upsert(...)`)
3. **Import data calls** inside `processBrandExcel` (the `importFinancialData` call and cross-department attachment writes)

### How It Works
- If a network call fails with a "Failed to fetch" or similar transient error, it retries up to 3 times
- Each retry waits progressively longer: ~1s, ~2s, ~4s (exponential backoff)
- Non-transient errors (e.g., auth failures, RLS violations) are not retried
- The user sees a toast only after all retries are exhausted
- The existing toast messaging and error handling remain unchanged for non-transient errors

### Technical Changes

**File: `src/utils/retryFetch.ts`** (new utility)
- Create a generic `retryAsync` helper function that wraps any async operation
- Accepts: the async function, max retries (default 3), and a predicate to determine if the error is retryable
- Default retryable check: error message includes "fetch", "network", "timeout", or "ECONNRESET"

**File: `src/components/financial/MonthDropZone.tsx`**
- Wrap the storage upload call (line ~589) with `retryAsync`
- Wrap the database upsert call (line ~603) with `retryAsync`
- Wrap the `importFinancialData` call inside `processBrandExcel` (line ~366) with `retryAsync`
- Wrap the cross-department attachment insert/update calls (lines ~396-417) with `retryAsync`
- Update the error toast to mention retry exhaustion so the user knows it tried multiple times

No database changes required. No edge function changes required.

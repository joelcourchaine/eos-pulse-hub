
# Fix "Invalid key" Error on Process Attachment Upload

## Root Cause

On line 256 of `src/pages/ProcessDetail.tsx`, the upload path is built using the raw `file.name`:

```
const filePath = `${processId}/${stepId}/${Date.now()}-${file.name}`;
```

When a filename contains spaces (e.g., `Screenshot 2025-12-13 at 8.03.08 AM.png`), Supabase storage rejects it as an invalid key.

## Fix

Sanitize the filename by replacing spaces (and any other problematic characters) with underscores before building the storage path.

### Change in `src/pages/ProcessDetail.tsx` (line 256)

**Before:**
```typescript
const filePath = `${processId}/${stepId}/${Date.now()}-${file.name}`;
```

**After:**
```typescript
const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
const filePath = `${processId}/${stepId}/${Date.now()}-${safeName}`;
```

This replaces any character that is not alphanumeric, a dot, underscore, or hyphen with an underscore -- preventing the "Invalid key" error for filenames with spaces or special characters.

One-line change, no other files affected.

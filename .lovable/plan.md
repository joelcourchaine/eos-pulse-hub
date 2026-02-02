
# Fix Thumbnail Proxy Function Deployment

## Problem Identified
The `thumbnail-proxy` edge function exists in the codebase (`supabase/functions/thumbnail-proxy/index.ts`) but is **not registered in `supabase/config.toml`**. This means the function isn't being deployed or recognized by the backend, causing a 404 error when your ResourceCard tries to fetch thumbnails via the proxy.

This explains why:
- Your Google Drive thumbnail URL is stored correctly in the database
- The frontend is trying to use the proxy
- But the proxy returns 404 → broken image appears

## Solution

### Step 1: Add thumbnail-proxy to config.toml

Add the following configuration to enable the edge function:

```toml
[functions.thumbnail-proxy]
verify_jwt = false
```

Setting `verify_jwt = false` is correct here because this function just proxies public images and doesn't need authentication.

### Step 2: Redeploy the function

After updating the config, the function will be properly deployed and accessible.

## Expected Outcome

Once fixed:
1. The thumbnail-proxy function will respond at `/functions/v1/thumbnail-proxy?id=...`
2. It will fetch the Google Drive image and serve it to your ResourceCard
3. Your thumbnails will display properly (assuming the Drive file is shared publicly)

## Important Note: Google Drive Sharing

For the thumbnail to work, make sure your Google Drive image has sharing set to **"Anyone with the link can view"**. If it's restricted, even the proxy won't be able to fetch it.

## Technical Details
- Function location: `supabase/functions/thumbnail-proxy/index.ts`
- Config file: `supabase/config.toml`
- The function already has proper CORS headers and error handling

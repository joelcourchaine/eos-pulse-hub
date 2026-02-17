

# Add "Last Updated" Date to Email Header

## Change

In the edge function `supabase/functions/send-top10-email/index.ts`, add the `last_item_activity` timestamp to the email header, displayed to the right of the store/department subtitle line.

### Steps

1. **Fetch `last_item_activity`** -- Add it to the select query on line 59 (add `last_item_activity` to the fields).

2. **Format the date** -- Convert `last_item_activity` to a readable string like "Last Updated: Jan 15, 2025". If null, omit it.

3. **Update the header HTML** (line 136) -- Change the subtitle `<p>` from a single line to a small inline table so the store/department name sits on the left and "Last Updated: ..." sits on the right, both in the same `#94a3b8` muted color.

### Result

The header will look like:

```text
+----------------------------------------------------------+
| Top 10 Most Frequently Used Op Codes (CP)                |
| Murray Chev Medicine Hat · Service Dept    Last Updated:  |
|                                            Jan 15, 2025   |
+----------------------------------------------------------+
```

Single file change: `supabase/functions/send-top10-email/index.ts`

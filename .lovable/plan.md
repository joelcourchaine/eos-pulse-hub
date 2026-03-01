
The `DialogContent` has `max-h-[90vh] flex flex-col overflow-hidden` but the Radix Dialog root renders inside a portal and the content doesn't have a real height constraint — `max-h` only kicks in when the element would naturally exceed that height. Since the dialog is sized to its content by default, the `ScrollArea` with `flex-1 min-h-0` has no fixed parent height to anchor against, so it never scrolls.

**Fix**: Add `h-[90vh]` (explicit height, not just max-height) to `DialogContent`. This gives the flex container a real height, allowing `flex-1 min-h-0` on the `ScrollArea` to work correctly.

**Single change in `src/components/scorecard/TechnicianImportPreviewDialog.tsx` line 405:**

```tsx
// Before
<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

// After  
<DialogContent className="max-w-3xl h-[90vh] flex flex-col overflow-hidden">
```

Changing `max-h-[90vh]` → `h-[90vh]` forces the dialog to always be 90% of the viewport height, giving the inner `ScrollArea` a concrete height to fill, so the technician list scrolls properly.

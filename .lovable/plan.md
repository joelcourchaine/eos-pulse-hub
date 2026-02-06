

## Remove Item Count from Top 10 List Headers

A small UI cleanup to remove the "(X items)" indicator shown next to each Top 10 list title in the collapsed view.

### What Changes

In `src/components/top-10/Top10ListCard.tsx`, remove the `<span>` element that displays the item count (e.g., "(10 items)", "(0 items)") next to the list title.

### Technical Detail

- **File**: `src/components/top-10/Top10ListCard.tsx`
- **Change**: Delete the following element (around line 239):
  ```tsx
  <span className="text-sm text-muted-foreground">
    ({items.length} items)
  </span>
  ```

No other files or logic are affected -- the `items` state is still loaded when the list is expanded, so removing the display has no side effects.

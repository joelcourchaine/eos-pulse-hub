

## Prevent Scroll Wheel from Changing Number Input Values

### Problem
When a number input is focused, scrolling the mouse wheel increments/decrements the value. This causes accidental edits across all grids and forms in the app (Financial Summary, Forecast, Scorecard, etc.).

### Solution
Add an `onWheel` handler to the shared `Input` component (`src/components/ui/input.tsx`) that calls `e.currentTarget.blur()` when the input type is `"number"`. This immediately removes focus so the browser's default scroll-to-change-value behavior is suppressed, and the page scrolls normally instead.

This is a single-file change that covers all ~160 number inputs across the entire app since they all use this shared component.

### File to Modify

**`src/components/ui/input.tsx`**

Add an `onWheel` handler alongside the existing `onKeyDown` handler:

```text
const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
  if (type === "number") {
    e.currentTarget.blur();
  }
};
```

Then pass `onWheel={handleWheel}` to the `<input>` element.

This pairs with the existing arrow-key prevention (lines 8-11) to fully lock down accidental value changes on number inputs.



## Bug: Connector lines don't appear between team members

### Root Cause

The SVG lines are drawn by measuring DOM element positions using `getBoundingClientRect()`. The connecting line from a **child** goes to the **top** of the parent (`pRect.top - chartRect.top`), and from the **bottom** of the child (`cRect.bottom - chartRect.top`).

Looking at the image: the child circles (Jamie, Pete, Shandi) are **above** Sara (the Service Manager). This is the reversed org chart layout — leaves at top, roots at bottom. The line should go:

- **From**: bottom of the child node (`cRect.bottom`)  
- **To**: top of the parent node (`pRect.top`)

But the current code at lines 581–598 draws:
```
y1 = pRect.top - chartRect.top      ← top of parent (correct anchor on parent)
y2 = cRect.bottom - chartRect.top   ← bottom of child (correct anchor on child)
```

That math is actually right in isolation — but the issue is the **`chartRect`** reference point. The chart `div` has `transform: scale(${zoom})` applied to it. `getBoundingClientRect()` returns **scaled** coordinates, but the SVG sits **inside** the same scaled div. This means the coordinates fed into the SVG are in "screen space" post-scale, but the SVG coordinate system is "pre-scale" (its own local space). When zoom ≠ 1 the lines are drawn in the wrong positions, and at zoom levels far from 1 the lines might be completely off-screen or invisible.

**But there's an additional problem**: `chartRect` is obtained by calling `chartRef.current.getBoundingClientRect()` on the **scaled** element. All child rects are also scaled, so `child - chart` should cancel out the scaling. The real bug is subtler:

The line endpoints connect **bottom of child → top of parent**, but when the chart has `transformOrigin: "top center"`, the `getBoundingClientRect` on children inside the scaled div **does** account for the transform. So the coordinates are correct when zoom=1.

**The actual bug**: The line `y2` for individual leaf nodes uses `cRect.bottom` (bottom of child). This means the line exits the bottom of the child. Since children are **above** parents in this reversed layout, the line should connect the **bottom** of the child (`y2`) to the **top** of the parent (`y1`). That's what the code does — and it should work.

Re-examining more carefully: The SVG is `position: absolute; inset: 0` inside the **scaled** div. The `getBoundingClientRect` returns viewport coordinates. The SVG's coordinate space matches the div's unscaled internal layout space only when zoom=1.

**Fix**: Divide the computed coordinates by `zoom` to convert from viewport space back to the SVG's local coordinate space:

```ts
const scale = zoom;
// instead of:
const parentX = pRect.left + pRect.width / 2 - chartRect.left;
// use:
const parentX = (pRect.left + pRect.width / 2 - chartRect.left) / scale;
```

### Changes
- **`src/components/team/ReverseOrgChart.tsx`** — In the `calcLines` effect (lines 570–618), divide all computed x/y coordinates by `zoom` to convert from scaled viewport coordinates to the SVG's unscaled local coordinate space.

```text
Before:
  parentX = (pRect.left + pRect.width/2 - chartRect.left)
  parentY = (pRect.top - chartRect.top)
  childX  = (cRect.left + cRect.width/2 - chartRect.left)
  childY  = (cRect.bottom - chartRect.top)

After:
  parentX = (pRect.left + pRect.width/2 - chartRect.left) / zoom
  parentY = (pRect.top - chartRect.top) / zoom
  childX  = (cRect.left + cRect.width/2 - chartRect.left) / zoom
  childY  = (cRect.bottom - chartRect.top) / zoom
```

The `zoom` value is already in component scope so no additional state is needed.

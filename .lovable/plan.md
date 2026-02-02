
# Fix Resource Card to Display Square Thumbnails Without Cropping

## Problem
The resource card thumbnail area is a fixed 160px height rectangle. Square images (like your 1024x1024px meeting illustration) get cropped because the CSS uses `object-cover`.

## Solution
Change the image CSS from `object-cover` to `object-contain` so the entire image is visible within the container.

## Changes Required

**File: `src/components/resources/ResourceCard.tsx` (Line 74)**

Change:
```tsx
className="w-full h-full object-cover transition-transform ..."
```

To:
```tsx
className="w-full h-full object-contain transition-transform ..."
```

## Result
- Your square image will display fully without cropping
- The gradient background will show on the sides (if the image doesn't fill the horizontal space)
- All existing thumbnails will also benefit from this change

## Technical Details
- `object-cover`: Fills container, crops excess (current behavior)
- `object-contain`: Shows entire image, letterboxes if needed (proposed)
- Container height remains `h-40` (160px)

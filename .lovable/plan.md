

# Fit Wide Logos in Resource Cards

## The Problem
Currently, resource card thumbnails use `object-cover` which fills the entire container but crops images that don't match the container's aspect ratio. For wide logos (like the Marshall Group 60th Anniversary logo), this results in the left and right edges being cut off.

## Solution
Change the image fitting from `object-cover` to `object-contain`. This ensures the entire image is visible within the container, adding background padding around it rather than cropping.

## Change Required

**File: `src/components/resources/ResourceCard.tsx`**

Update line 77 from:
```typescript
className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
```

To:
```typescript
className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
```

## Visual Comparison

| Before (`object-cover`) | After (`object-contain`) |
|------------------------|-------------------------|
| Image fills entire area | Image fits within area |
| Crops edges of wide/tall images | Shows complete image |
| No background visible | Background visible around image |

## Result
- Wide logos will show in full without cropping
- The existing gradient background (`bg-gradient-to-br from-muted/50 to-muted`) will be visible around the image edges
- Tall images will also benefit, showing the full height

This is a single-line change that preserves the hover animation and all other styling.


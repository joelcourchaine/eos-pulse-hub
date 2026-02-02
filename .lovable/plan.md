
# Fix Gray Bars on Resource Thumbnails

## Change
Switch from `object-contain` to `object-cover` in `ResourceCard.tsx` to eliminate gray bars.

## File to Modify
**`src/components/resources/ResourceCard.tsx`** - Line 74

```tsx
// From:
className="w-full h-full object-contain transition-transform ..."

// To:
className="w-full h-full object-cover transition-transform ..."
```

## Result
- All thumbnails remain the same size (160px tall, responsive width)
- Images fill the entire thumbnail area
- No gray bars regardless of image dimensions
- Minor edge cropping if image aspect ratio differs from container

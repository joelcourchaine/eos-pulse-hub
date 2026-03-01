
## Add subtle animated drop-zone cue to Financial Summary month headers

**File: `src/components/financial/MonthDropZone.tsx`**

The outer `<div>` at line 801 wraps the whole drop zone. The inner `<div>` at line 807 wraps `{children}`. Changes needed:

1. **Add `isInView` state** using `IntersectionObserver` on the outer div ref — triggers a one-shot pulse animation when the column scrolls into view.

2. **Add `isHovered` state** tracked via `onMouseEnter`/`onMouseLeave` on the outer div.

3. **Modify the outer div (line 801)**: add `ref`, `onMouseEnter`, `onMouseLeave`, and `group` class.

4. **Modify the inner div (line 807)**: when `!attachment && !isUploading && !copiedFrom`, apply:
   - On hover: `group-hover:ring-1 group-hover:ring-dashed group-hover:ring-primary/40 group-hover:bg-primary/5 rounded`
   - When `isInView && !attachment && !isUploading`: apply a one-shot `animate-pulse` dashed border for ~2s then stop

5. **Add hover tooltip + upload hint**: when `!attachment && !isUploading && !copiedFrom`, render inside the inner div an absolutely-positioned element that appears on `group-hover`:
   ```tsx
   <div className="absolute inset-0 flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none rounded">
     <TooltipProvider>
       <Tooltip open={isHovered && !attachment && !isUploading}>
         <TooltipTrigger asChild>
           <div className="pointer-events-auto">
             <Upload className="h-3 w-3 text-primary/60" />
           </div>
         </TooltipTrigger>
         <TooltipContent side="bottom" className="text-xs">Drop statement to import</TooltipContent>
       </Tooltip>
     </TooltipProvider>
   </div>
   ```

6. **Add `animate-bounce-once` via IntersectionObserver**: When the component first enters the viewport and has no attachment, show a small downward chevron/arrow for ~1.5s using a CSS animation class defined inline or via Tailwind's `animate-bounce` for a short window. Implement this by setting a `showPulse` state to `true` on first intersection, then `false` after a 2000ms timeout.

**Summary of state additions:**
- `isHovered: boolean`  
- `showPulse: boolean` (true for 2s after first scroll-into-view, only when no attachment)
- `outerRef: useRef<HTMLDivElement>`

**The inner wrapper when no attachment:**
```tsx
className={cn(
  "transition-all duration-200",
  isDragOver && "ring-2 ring-primary ring-inset bg-primary/10 rounded",
  isCopying && "opacity-50 pointer-events-none",
  !attachment && !isUploading && !copiedFrom && isHovered && "ring-1 ring-dashed ring-primary/50 bg-primary/5 rounded",
  !attachment && !isUploading && !copiedFrom && showPulse && "ring-1 ring-dashed ring-primary/30 rounded animate-pulse",
)}
```

The animated downward arrow (only shown when `showPulse || isHovered`):
```tsx
{!attachment && !isUploading && !copiedFrom && (showPulse || isHovered) && (
  <div className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none z-10">
    <ChevronDown className={cn("h-3 w-3 text-primary/50", showPulse && "animate-bounce")} />
  </div>
)}
```

Tooltip wraps the whole outer div using `Tooltip open={isHovered && !attachment}` to show "Drop statement to import" on hover.

No new dependencies needed. All changes in one file.

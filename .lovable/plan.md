
## Remove Drop Zone Animations from Month Headers

**File: `src/components/financial/MonthDropZone.tsx`**

Remove all the animated/hover cue additions:

1. **Lines 105-106**: Remove `isHovered` and `showPulse` state declarations
2. **Lines 108**: Remove `outerRef` ref
3. **Lines 110-126**: Remove the `IntersectionObserver` useEffect entirely
4. **Line 827**: Change `<Tooltip open={isHovered && ...}>` to `<Tooltip>` (remove controlled open)
5. **Line 830**: Remove `ref={outerRef}` from outer div
6. **Lines 835-836**: Remove `onMouseEnter`/`onMouseLeave` handlers
7. **Line 843**: Remove hover ring class line (`isHovered && "ring-1 ring-dashed..."`)
8. **Line 844**: Remove pulse class line (`showPulse && ...animate-pulse`)
9. **Lines 853-857**: Remove the ChevronDown bounce indicator block entirely

The drag-over visual (`isDragOver && "ring-2 ring-primary..."`) stays — that's the active drop feedback which is still useful.

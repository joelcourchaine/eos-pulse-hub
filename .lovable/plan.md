

## Fix Cell Alignment with Header Columns

### Problem
Data cells are not staying aligned with their header columns. The `min-w`/`max-w` constraints work differently when combined with `flex flex-col` — flex children can grow beyond `max-w` in a flex row, causing misalignment.

### Solution
Use a fixed width (`w-[150px]`) with `shrink-0` on both header and data cells so every column is exactly the same width and cannot flex or shrink. The advisor column keeps its wider fixed width.

### Changes

**File: `src/components/admin/scorecard-mapper/ExcelPreviewGrid.tsx`**

1. **Header cells (line 274)**: Change `min-w-[120px] max-w-[180px]` to `w-[150px] shrink-0`

2. **Data cells (line 385)**: Change `min-w-[120px] max-w-[180px] truncate` to `w-[150px] shrink-0 overflow-hidden`. The advisor cell branch changes from `min-w-[280px] max-w-[320px]` to `w-[300px] shrink-0 overflow-hidden`.

3. **Move `truncate`**: Remove `truncate` from the outer cell div (it conflicts with `flex flex-col`) and ensure the inner `<span>` elements have `truncate` so text is clipped properly within the fixed-width cell.

### Why this works
Using exact `w-[150px] shrink-0` on both header and data cells guarantees they are always the same width. The `shrink-0` prevents flex from compressing them, and `overflow-hidden` ensures content doesn't push them wider.

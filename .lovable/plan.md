

## Add "Import File" Option to Month Header Right-Click Menu

### Problem
Windows users often prefer right-clicking and selecting a file from a dialog rather than drag-and-drop. Currently, the month column headers only support drag-and-drop for importing Excel files. The right-click context menu only has "Clear Month Data."

### Solution
Add an **"Import Scorecard File"** option to the existing right-click context menu on each month header. Clicking it opens a native file picker for `.xlsx`/`.xls` files, then feeds the selected file through the same parsing and preview pipeline already used by drag-and-drop.

### Technical Details

**File: `src/components/scorecard/ScorecardMonthDropZone.tsx`**
- Add a hidden `<input type="file" accept=".xlsx,.xls">` ref
- Expose a new `onFileSelect` callback prop (or an imperative `triggerFileSelect()` ref method) so the parent can programmatically trigger the file picker
- When a file is selected via the input, run the same `parseCSRProductivityReport` + `onFileDrop` logic already used by `handleDrop`

**File: `src/components/scorecard/ScorecardGrid.tsx`** (3 locations where month headers render with ContextMenu)
- Add a new `ContextMenuItem` labeled "Import Scorecard File" with an `Upload` icon to each month's `ContextMenuContent`
- On click, trigger the file input on the corresponding `ScorecardMonthDropZone`
- This applies to all 3 month header render sites (~lines 3501, 3645, 3695)

### User Experience
- Right-click any month column header
- See "Import Scorecard File" option (alongside existing "Clear Month Data")
- Click it, native file picker opens
- Select an Excel file, and it flows into the same preview/import dialog as drag-and-drop


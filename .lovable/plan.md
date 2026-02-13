
## Add "Import Statement" to Financial Summary Right-Click Menu

### Problem
Windows users prefer right-clicking to select a file rather than drag-and-drop. The financial summary's `MonthDropZone` currently only supports drag-and-drop for file imports, with the right-click menu limited to "Copy from..." and "Clear Month Data" options.

### Solution
Add an **"Import Statement"** option to the existing right-click context menu on each month header in the financial summary. Clicking it opens a native file picker for supported file types (.xlsx, .xls, .xlsm, .csv, .pdf), then processes the selected file through the same upload and parsing pipeline already used by drag-and-drop.

### Technical Details

**File: `src/components/financial/MonthDropZone.tsx`**

1. Add a hidden `<input type="file">` element with a ref, accepting `.xlsx,.xls,.xlsm,.csv,.pdf`
2. Add a `handleFileInputChange` handler that takes the selected file and feeds it into the same logic as `handleDrop` (file type detection, upload to storage, brand Excel processing, attachment creation)
3. Add a new `ContextMenuItem` labeled **"Import Statement"** with an `Upload` icon at the top of the existing context menu (before the copy options)
4. Clicking the menu item triggers `fileInputRef.current.click()` to open the native file picker
5. Update the `hasContextMenuOptions` check to always include the import option (since importing is always available regardless of copy options)

### User Experience
- Right-click any month column header in the Financial Summary
- See "Import Statement" at the top of the menu (above existing Copy/Clear options)
- Click it to open the native file picker
- Select a file, and it flows through the same upload + auto-import pipeline as drag-and-drop

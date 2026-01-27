

# Add Date Picker for RO Date in Top 10 Lists

## Summary
Replace the text input for date columns (like "RO Date") with a visual calendar picker. This eliminates date format confusion between Canadian (DD/MM) and American (MM/DD) formats and ensures consistent data entry across all stores.

## What Users Will See

- Date columns will display a **calendar button** instead of a plain text input
- Clicking it opens a **calendar popup** for easy date selection
- The selected date displays in a readable format (e.g., "Nov 28, 2025")
- The "# of Days" automatically calculates when a date is picked
- Non-date columns remain as regular text inputs

## Drop Zone Compatibility

The file import drop zone functionality is completely separate and will **not be affected**:

| Component | Purpose | Affected? |
|-----------|---------|-----------|
| `ImportTop10Dialog` | Handles screenshot/PDF/Excel drops | No change |
| `Top10ItemRow` | Individual cell editing | Date picker added here |

The drop zone lives in the Import dialog's dedicated drop area, while the date picker is for inline cell editing - they are completely independent features.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/top-10/Top10ItemRow.tsx` | Add date picker for date-type columns |
| `src/components/ui/calendar.tsx` | Add `pointer-events-auto` class for popover compatibility |

---

## Technical Details

### 1. Calendar Component Fix

Add `pointer-events-auto` to ensure the calendar is clickable inside popovers:

```typescript
// In calendar.tsx, line 14
className={cn("p-3 pointer-events-auto", className)}
```

### 2. Date Column Detection

Use the existing `findColumnKey` helper to identify which columns are dates:

```typescript
const isDateColumn = (colKey: string) => colKey === roDateColKey;
```

### 3. Date Picker Rendering

Replace the Input with a Popover+Calendar for date columns:

```typescript
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

// Helper to parse stored ISO dates
const parseStoredDate = (dateStr: string): Date | undefined => {
  if (!dateStr) return undefined;
  // Try ISO format first (new storage format)
  const isoDate = parse(dateStr, "yyyy-MM-dd", new Date());
  if (isValid(isoDate)) return isoDate;
  // Fall back to legacy parsing for existing data
  return parseDate(dateStr) || undefined;
};

// Handle date selection
const handleDateSelect = (key: string, date: Date | undefined) => {
  const formatted = date ? format(date, "yyyy-MM-dd") : "";
  handleChange(key, formatted);
};

// In the column render loop:
{isDateColumn(col.key) ? (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn(
          "h-8 w-full justify-start text-left text-sm font-normal",
          !localData[col.key] && "text-muted-foreground"
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {localData[col.key] 
          ? format(parseStoredDate(localData[col.key])!, "MMM d, yyyy")
          : col.label}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={parseStoredDate(localData[col.key])}
        onSelect={(date) => handleDateSelect(col.key, date)}
        className="pointer-events-auto"
      />
    </PopoverContent>
  </Popover>
) : (
  <Input ... />  // Existing text input for non-date columns
)}
```

### 4. Storage Format

- **New data**: Stored as ISO format `yyyy-MM-dd` (e.g., "2025-11-28")
- **Display**: Shown as readable format "Nov 28, 2025"
- **Backward compatible**: The `parseStoredDate` function handles legacy date formats that may already exist in the database

### 5. Auto-Calculation Integration

The existing `handleChange` function already handles the "# of Days" auto-calculation. When `handleDateSelect` calls it with the new ISO date, the calculation will work correctly because:
- The `parseDate` helper already supports `yyyy-MM-dd` format
- The days difference calculation remains unchanged


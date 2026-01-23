
# Travel Visualization Overlay - Vertical Bars

## Overview
Add a travel visualization system to the Consulting Scheduler that displays **vertical colored bars** overlaying the grid columns. Each travel period appears as a semi-transparent vertical band spanning from its start date to end date across month columns, allowing you to instantly see scheduling conflicts.

**Key behavior**: Same destinations always use the same color (e.g., all "Calgary" trips are blue).

## Visual Design

```text
           ┌─────────────────────────────────────────────────────────────────────────────┐
           │  + Add Travel                                              [Calgary] [Toronto] │ <- Legend
           ├──────────┬───────────┬───────────┬───────────┬───────────┬──────────────────┤
           │ Dealer   │  January  │  February │   March   │   April   │       May        │
           ├──────────┼───────────┼───────────┼───────────┼───────────┼──────────────────┤
           │          │     ░░░░░░│░░░░░░░░░░░│░░░        │   ████████│█████████         │
           │ Murray   │  Jan 20   │░░ Calgary ░│  Mar 5    │   █Toronto│█████████         │
           │ Merritt  │  9:00am   │░░ (Blue)  ░│           │   █(Green)│█████████         │
           │          │     ░░░░░░│░░░░░░░░░░░│░░░        │   ████████│█████████         │
           ├──────────┼───────────┼───────────┼───────────┼───────────┼──────────────────┤
           │          │     ░░░░░░│░░░░░░░░░░░│░░░        │           │                  │
           │ Another  │     ░░░░░░│░░ Calgary ░│░░░        │  Apr 22   │                  │
           │ Dealer   │     ░░░░░░│░░ (Blue)  ░│░░░        │           │                  │
           └──────────┴───────────┴───────────┴───────────┴───────────┴──────────────────┘
                            ▲                       ▲
                            │                       │
                     Both Calgary trips         Toronto trip
                     share SAME blue color      Apr 10 - May 8
```

**Key Visual Elements:**
- Vertical colored bands spanning the full height of the grid for the travel date range
- **Same destinations share the same color** - color is assigned per unique destination name
- Bars are semi-transparent (25% opacity) so calls beneath remain visible
- Destination label shown as a floating badge at the top of each bar
- Date range displayed on hover/tooltip
- Quick-add button in header for adding new travel periods
- Small color legend showing destination-to-color mapping

## User Interaction Flow

1. **Add Travel**: Click "+ Add Travel" button in the scheduler header
2. **Pick Dates**: Select start and end dates from calendar pickers
3. **Enter Destination**: Type the destination name (e.g., "Calgary", "Toronto")
4. **Auto Color**: System checks if destination already exists - if yes, uses same color; if new, assigns next available color
5. **View Overlay**: Vertical bar appears spanning the date range
6. **Edit/Delete**: Click on existing bar to edit dates, change destination, or delete

## Database Design

### New Table: `consulting_travel`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (auto-generated) |
| `destination` | text | Travel destination name |
| `start_date` | date | Travel start date |
| `end_date` | date | Travel end date |
| `notes` | text | Optional notes about the trip |
| `created_by` | uuid | FK to profiles (creator) |
| `created_at` | timestamptz | Creation timestamp |

**Note**: Color is NOT stored in the database. Instead, colors are dynamically assigned based on alphabetically-sorted unique destinations to ensure consistency.

### New Table: `consulting_travel_destinations`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Unique destination name |
| `color` | text | Hex color code |
| `created_at` | timestamptz | Creation timestamp |

This approach ensures:
- Calgary is always the same color across all trips
- Colors persist even if trips are deleted
- New destinations get the next available color from the palette

### RLS Policies
- Super admin and consulting_scheduler roles can read/write all travel records
- Policies matching the existing consulting_clients/consulting_calls pattern

## Implementation Steps

### Step 1: Database Migration
- Create `consulting_travel` table with columns as specified
- Create `consulting_travel_destinations` table for destination-to-color mapping
- Add RLS policies for super_admin and consulting_scheduler roles
- Add unique constraint on `consulting_travel_destinations.name`

### Step 2: Create Travel Data Hook
Create `src/hooks/useTravelPeriods.ts`:
- Fetch travel periods overlapping the 12-month grid range
- Fetch destination-to-color mappings
- Create new travel periods (auto-create destination if new)
- Update existing travel periods
- Delete travel periods
- Color assignment logic:
  1. Check if destination exists in `consulting_travel_destinations`
  2. If yes, use existing color
  3. If no, get count of existing destinations, pick next color from palette, insert new destination

### Step 3: Create TravelDialog Component
Create `src/components/consulting/TravelDialog.tsx`:
- Popover-based dialog for adding/editing travel
- Destination name input with autocomplete from existing destinations
- Start date picker
- End date picker (validates must be after start date)
- Optional notes textarea
- Color preview (read-only, based on destination)
- Save/Cancel/Delete buttons

### Step 4: Create TravelOverlay Component
Create `src/components/consulting/TravelOverlay.tsx`:
- Renders absolutely positioned vertical bars over the table
- Takes props: `months`, `travelPeriods`, `destinations`, `tableRef`, `onEditTravel`
- For each travel period:
  1. Calculate which month columns it spans
  2. Calculate left position based on start date within month
  3. Calculate width based on end date
  4. Look up color from destination name
  5. Render vertical bar with destination label badge

### Step 5: Integrate with ConsultingGrid
Modify `src/components/consulting/ConsultingGrid.tsx`:
- Add a `useRef` for the table container
- Import and use `useTravelPeriods` hook
- Wrap the table in a `position: relative` container
- Render `TravelOverlay` absolutely positioned inside the container
- Add "+ Add Travel" button next to "Add Client" button
- Add destination color legend in the header area

### Step 6: Position Calculation Logic

```text
Table structure:
- Left columns: Dealership (280px) + Department (120px) + Contact (120px) + Value (80px) = 600px
- Month columns: 12 × 130px = 1560px (starting at left offset 600px)

For travel spanning Jan 25 - Feb 5:

1. Find month indexes:
   - January = month index 0
   - February = month index 1

2. Calculate pixel positions:
   - Column 0 starts at: 600px
   - Left edge = 600px + (25/31 × 130px) = 600 + 105 = 705px
   - Column 1 starts at: 600 + 130 = 730px
   - Right edge = 730px + (5/28 × 130px) = 730 + 23 = 753px
   - Width = 753 - 705 = 48px

3. Render bar:
   - position: absolute
   - left: 705px
   - width: 48px
   - top: header height
   - height: calc(100% - header height)
   - pointer-events: none (except for the label badge)
```

## Color Palette
Pre-defined colors assigned to destinations in order of creation:

| Order | Color Name | Hex Code |
|-------|------------|----------|
| 1 | Blue | #3B82F6 |
| 2 | Emerald | #10B981 |
| 3 | Amber | #F59E0B |
| 4 | Rose | #F43F5E |
| 5 | Violet | #8B5CF6 |
| 6 | Cyan | #06B6D4 |
| 7 | Orange | #F97316 |
| 8 | Pink | #EC4899 |

Colors cycle if more than 8 unique destinations exist.

## Files to Create
1. `src/components/consulting/TravelOverlay.tsx` - Vertical bar overlay component
2. `src/components/consulting/TravelDialog.tsx` - Add/edit travel dialog
3. `src/hooks/useTravelPeriods.ts` - Data fetching and mutations hook

## Files to Modify
1. `src/components/consulting/ConsultingGrid.tsx` - Add overlay container and integration
2. `src/pages/ConsultingScheduler.tsx` - Add travel button and legend to header

## Technical Considerations

### Overlay Positioning
- Table container gets `position: relative`
- Travel bars use `position: absolute` with calculated left/width
- Bars have `pointer-events: none` to allow clicks to pass through to cells
- Label badges have `pointer-events: auto` to remain clickable for editing

### Column Width Synchronization
- Use `useRef` + `useLayoutEffect` to measure actual column positions after render
- Recalculate on window resize using `ResizeObserver`
- Account for horizontal scroll position in calculations

### Same-Destination Color Consistency
- Colors are determined by the `consulting_travel_destinations` table
- When creating a new trip with an existing destination, color lookup happens automatically
- When typing a destination name, show existing matches with their colors for quick selection

### Performance
- Only fetch travel periods within the 12-month visible range
- Use React Query for caching and invalidation
- Debounce resize recalculations

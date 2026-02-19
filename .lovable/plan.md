
# Dual-Position Support for Team Members

## What Changes

Team members can optionally hold **two positions**. When they do, their org chart node displays a **diagonal split color** -- the top-left half shows the first position's color, the bottom-right half shows the second position's color. Both position labels appear on the card.

## Database Change

Add a new nullable column `position_secondary` (text) to the `team_members` table. No foreign key needed -- positions are free-text strings just like the existing `position` column.

```sql
ALTER TABLE team_members ADD COLUMN position_secondary text DEFAULT NULL;
```

## UI Changes

### Add Team Member Dialog and Edit Panel
- Replace the single Position dropdown with a **Primary Position** select
- Add a second **Secondary Position** select (optional, with a "None" option to clear it)
- Prevent selecting the same position for both

### Org Chart Node (`OrgNode`)
- When `position_secondary` is set, render the node background as a **CSS diagonal gradient** combining both position colors:
  ```css
  background: linear-gradient(135deg, <color1> 50%, <color2> 50%);
  ```
- Show both position labels stacked (e.g., "Advisor" / "Dispatcher")
- The legend remains unchanged -- each position keeps its own color swatch

### Data Model Update
- Extend the `TeamMember` TypeScript interface to include `position_secondary: string | null`
- Update all queries that fetch team members (no filter changes needed since it's a new nullable column)

## Technical Details

**Files to modify:**

1. **Database migration** -- add `position_secondary` column
2. **`src/components/team/ReverseOrgChart.tsx`**
   - Update `TeamMember` interface to add `position_secondary`
   - Update `OrgNode` to render split-color background via `linear-gradient(135deg, ...)` when two positions exist
   - Show both position labels on the node
   - Legend stays the same (individual position colors)
3. **`src/components/team/AddTeamMemberDialog.tsx`**
   - Add optional "Secondary Position" select field
   - Save `position_secondary` on insert
4. **`src/components/team/TeamMemberDetailPanel.tsx`**
   - Add optional "Secondary Position" select field
   - Load/save `position_secondary` on edit

## Visual Example

Single position node:
```text
+---------------------+
|  solid green bg     |
|  "John Smith"       |
|  Advisor            |
+---------------------+
```

Dual position node:
```text
+---------------------+
| green / | teal      |
|   diagonal split    |
|  "Jane Doe"         |
|  Advisor / Dispatcher|
+---------------------+
```

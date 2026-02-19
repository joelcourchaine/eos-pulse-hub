

# Add "Administrative" and "Cashier" Positions

Add two new position options to the My Team org chart: **Administrative** and **Cashier**.

## Changes

**Files to update (3 files share the same `POSITION_OPTIONS` array):**

1. `src/components/team/ReverseOrgChart.tsx` -- add entries + assign colors
2. `src/components/team/AddTeamMemberDialog.tsx` -- add entries to dropdown
3. `src/components/team/TeamMemberDetailPanel.tsx` -- add entries to dropdown

**New entries to add to each `POSITION_OPTIONS` array:**
- `{ value: "administrative", label: "Administrative" }`
- `{ value: "cashier", label: "Cashier" }`

**Color assignments in `ReverseOrgChart.tsx`:**
- Administrative: a distinct color (e.g., slate/gray tone)
- Cashier: a distinct color (e.g., pink/rose tone)

No database or migration changes needed -- the `position` column stores free-text strings.



## Remove "Calls with Joel" from MeetingFramework

**File: `src/components/meeting/MeetingFramework.tsx`**

1. **Remove the data-fetching block** (lines ~75–161): The entire `useQuery` for `consulting-calls-for-meeting` that fetches `upcomingCalls` and `lastCompletedCall`, plus the two const declarations on lines 160–161.

2. **Remove the UI block** (lines ~339–420): The entire `{/* Calls with Joel Dropdown */}` JSX section including the `<DropdownMenu>` and the "Last call" display below it.

3. **Remove unused imports**: `Phone`, `Badge`, `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuItem` — any that are only used by the removed block.

Single file change, no DB changes needed.

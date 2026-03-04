
## Add Total Team Members count in bottom-right corner

Simple change to `src/pages/MyTeam.tsx` — add a fixed-position div in the bottom-right corner showing the total non-vacant member count.

**What:** A fixed overlay in the bottom-right corner of the screen showing e.g. `"12 Team Members"` in a large font.

**Count logic:** `members.filter(m => !m.is_vacant)` — only count filled positions. Or if `is_vacant` isn't a field, count members whose name isn't "Vacant". Actually — let me check the TeamMember type quickly.

Looking at the existing code: the `isVacant` logic in the chart checks `!member.name || member.name === "Vacant"` or uses an `is_vacant` field. Let me just count `members.length` since all entries in `team_members` table are actual people (vacant positions are stored with `is_vacant: true` flag or name "Vacant"). I'll filter out vacants for the count.

**Where:** Inside the `<SidebarInset>` in `MyTeam.tsx`, add a `fixed bottom-6 right-6` div after the `<main>` block.

**Styling:**
- `fixed bottom-6 right-6` positioning
- Large bold number: `text-5xl font-bold`
- Label below: `text-sm text-muted-foreground uppercase tracking-widest`
- Subtle card-like background: `bg-card/80 backdrop-blur border rounded-2xl px-6 py-4 shadow-lg text-right`

**Count:** Filter out vacant members: `members.filter(m => m.name && m.name !== "Vacant" && !m.is_vacant).length` — but I should check the TeamMember type to see the exact field name. From context, `is_vacant` seems to be the field used. I'll use both checks to be safe.

**Single file change:** `src/pages/MyTeam.tsx` — add the fixed corner widget after the `<main>` block, before `<TeamMemberDetailPanel>`.

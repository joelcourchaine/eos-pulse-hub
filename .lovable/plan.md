
## Update the bottom stats bar

The existing single badge (`fixed bottom-6 right-20`) becomes a centered bottom bar with two side-by-side cards:

1. **Active Team Members** — current card, centered
2. **Vacant Positions** — new card, shows count + list of position labels being hired for

### Layout change
Replace the current fixed right-aligned badge with a centered bottom bar:
```
fixed bottom-6 left-1/2 -translate-x-1/2
```
Two cards side by side with a divider, same blurred card style.

### Data
- `total` = members where `status !== "vacant"` and `name !== "Vacant"`  
- `vacantMembers` = members where `status === "vacant"` OR `name === "Vacant"`
- `vacantPositions` = `vacantMembers.map(m => POSITION_LABEL[m.position] || m.position)` — deduplicated list for display

I'll inline a small position label map (same as `POSITION_OPTIONS` in the dialogs) to convert `position` keys to readable labels.

### UI
```
[ 22          |    3         ]
[ TEAM MEMBERS | VACANT      ]
[             | Advisor      ]
[             | Technician   ]
```

Left card: big number + "TEAM MEMBERS"  
Right card: big number + "VACANT" + small italic list of positions below

### Files changed
- `src/pages/MyTeam.tsx` only — replace the existing badge block


## Remove the "Headcount Only" toggle — show counts inline in the legend

**What changes:**
1. **Remove** the "Headcount Only" `Switch` + label (lines 705–713) from the toolbar.
2. **Update the legend** (lines 724–746): each badge now shows a count of members in that position beside the label. Make badges slightly larger (`text-xs` instead of `text-[10px]`, taller padding) so the count + name are comfortably readable.
3. **Count logic**: for each position key, count `members` where `m.position === key || m.position_secondary === key`.

The `headcountOnly` state and its chart rendering branch (lines 765–792) remain untouched — it's still a useful view mode for existing code paths. We're just removing the toggle from the toolbar UI. Alternatively, we could remove it fully — but the safer/simpler change is just removing the toggle UI and the toolbar span, and updating the legend badges.

### Legend badge before:
```tsx
<Badge variant="outline" className="text-[10px] gap-1 py-0.5">
  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.bg }} />
  {label}
</Badge>
```

### Legend badge after:
```tsx
<Badge variant="outline" className="text-xs gap-1.5 px-2.5 py-1">
  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.bg }} />
  {label}
  <span className="font-bold ml-0.5">{count}</span>
</Badge>
```

Count = `members.filter(m => m.position === key || m.position_secondary === key).length`

**Files changed:** `src/components/team/ReverseOrgChart.tsx` only — two spots (toolbar line ~705, legend line ~724).

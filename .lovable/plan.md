
## Make KPI rows match the compact height of the Totals rows

**Root cause of height difference:**

1. **Owner header rows** (line 4206): the `Avatar` is `h-6 w-6` (24px) which stretches the row. The Totals header uses no avatar — just a `text-sm` label with `py-1`. Reducing the avatar to `h-5 w-5` and font to `text-xs` will compress it.

2. **Owner name text** (line 4214): `text-sm` vs Totals which uses `text-sm` too — but avatar is the main culprit.

3. **KPI data cells** across all view modes: already `py-0.5` on the name cell, and most data cells also use `py-0.5`. Totals data cells use `py-0` — changing KPI cells to `py-0` will tighten them.

**Changes — `src/components/scorecard/ScorecardGrid.tsx` only:**

| Location | Current | Change |
|---|---|---|
| Owner header avatar (line 4206) | `h-6 w-6` | `h-5 w-5` |
| Avatar fallback text (line 4209) | `text-xs` | keep |
| Owner name text (line 4214) | `text-sm` | `text-xs` |
| Owner header cell py (line 4203) | `py-0.5` | `py-0` |
| KPI name cell (line 4259) | `py-0.5` | `py-0` |
| KPI weekly target cell (line 4279) | `py-0.5` | `py-0` |
| KPI data cells (all view branches, ~lines 4430–5450) | `py-0.5` → `py-0` where present |

This makes all regular KPI rows visually identical in height to the Totals section rows shown in the screenshot.

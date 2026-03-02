
## Root Cause — Confirmed

All 18 technician KPIs across 6 technicians have `display_order = 9999`. The sort on line 4161 in `ScorecardGrid.tsx` returns `9999 - 9999 = 0` for every cross-owner comparison. JavaScript's `Array.sort` is **not guaranteed to be stable** in this tie case, so KPIs from the same owner get scattered. Since the owner header shows whenever `kpi.assigned_to !== sortedKpis[index - 1].assigned_to`, a scattered owner produces **multiple header rows**.

---

## Two-part fix

### Part 1: Database — assign distinct display_order values per technician

Update all 18 KPI rows so each technician's group gets a unique range:

| Technician | IDs | New display_order |
|---|---|---|
| Bill Vanderbos | Available Hours, Open/Closed, Productive | 9990, 9991, 9992 |
| Michael Abrahamsz | Available Hours, Open/Closed, Productive | 9993, 9994, 9995 |
| Vincente Castillo | Available Hours, Open/Closed, Productive | 9996, 9997, 9998 |
| Samantha Reitsema | Available Hours, Open/Closed, Productive | 10000, 10001, 10002 |
| Manny Ruiz | Available Hours, Open/Closed, Productive | 10003, 10004, 10005 |
| Ray Prakash | Available Hours, Open/Closed, Productive | 10006, 10007, 10008 |

Using the exact KPI IDs confirmed from the database query above.

### Part 2: Code — two fixes

**Fix A — Stable sort tie-breaker in `ScorecardGrid.tsx` line 4161:**

Change:
```typescript
return getOwnerMinOrder(a.assigned_to) - getOwnerMinOrder(b.assigned_to);
```
To:
```typescript
const orderDiff = getOwnerMinOrder(a.assigned_to) - getOwnerMinOrder(b.assigned_to);
if (orderDiff !== 0) return orderDiff;
return (a.assigned_to || "").localeCompare(b.assigned_to || "");
```

**Fix B — Import assigns sequential display_order per technician in `TechnicianImportPreviewDialog.tsx`:**

Instead of hardcoding `display_order: 9999` for every KPI, query the current max `display_order` in the department before the import loop starts, then assign incrementing values per technician (each technician gets `maxOrder+1`, `maxOrder+2`, `maxOrder+3` and the counter advances by 3 for each tech).

This ensures future imports never cause this problem again, regardless of the number of technicians.

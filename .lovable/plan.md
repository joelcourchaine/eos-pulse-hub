
## Problem

The "# of Days" column stores a static number in the database. When a date is saved, the days count is calculated once and written to `data[daysColKey]`. It never updates unless the row is edited again. So a row opened 30 days ago still shows "30" forever.

## Root Cause

In `Top10ItemRow.tsx`, `handleDateSelect`, `handleChange`, and the `useEffect` sync all call `onUpdate(newData)` with the days count baked into the saved data. The days value is persisted to the database as a plain string.

## Fix

**Make "# of Days" a pure computed display value — never stored in the database.**

### Changes to `src/components/top-10/Top10ItemRow.tsx`

1. **Remove days from saved data**: In `handleDateSelect`, `handleChange`, and the sync `useEffect`, strip `daysColKey` from `newData` before calling `onUpdate()`. This stops writing days to the DB.

2. **Compute days at render time**: Add a helper `getComputedDays(roDateValue: string): string` that calculates `differenceInDays(today, roDate)` fresh every render.

3. **Override display for days column**: In the render section, when the column is `daysColKey`, show the computed value instead of `localData[col.key]`.

4. **Make days field read-only**: Since it's derived from the RO Date, show it as a plain read-only `<span>` (not an `<Input>`) even in edit mode — just like the non-edit display, but with a subtle read-only style so users know they can't type in it.

```text
RO Date (user sets)  →  stored in DB as "yyyy-MM-dd"
# of Days            →  computed live: differenceInDays(today, roDate)
                         never stored, never stale
```

### Key code change sketch

```ts
// New helper — pure computation, no side effects
const getComputedDays = (roDateValue: string): string => {
  if (!roDateValue) return "";
  const roDate = parseDate(roDateValue);
  if (!roDate) return "";
  const diff = differenceInDays(new Date(), roDate);
  return diff >= 0 ? String(diff) : "";
};

// In handleDateSelect / handleChange / useEffect:
// Remove daysColKey from newData before saving
if (daysColKey) delete newData[daysColKey];
onUpdate(newData); // days never written to DB

// In render — for days column:
const displayValue = col.key === daysColKey && roDateColKey
  ? getComputedDays(localData[roDateColKey] || "")
  : localData[col.key] || "";
// Show as read-only span regardless of canEdit
```

### Files to change

- `src/components/top-10/Top10ItemRow.tsx` — ~4 targeted edits

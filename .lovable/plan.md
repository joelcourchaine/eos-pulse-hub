
## What's still wrong

The **Monthly view** cells (lines 5187–5312) were missed in the previous fix — they still use `bg-success/10`, `text-success`, `bg-warning/10`, `text-warning`, `bg-destructive/10`, `text-destructive`.

The Quarterly trend view and Yearly view are already correct (emerald/amber/red tokens).

## Fix — `src/components/scorecard/ScorecardGrid.tsx`

Three targeted replacements in the Monthly view rendering block:

**1. TableCell background (lines 5189–5191)**
```
bg-success/10  →  bg-emerald-100 dark:bg-emerald-900/40
bg-warning/10  →  bg-amber-100 dark:bg-amber-900/40
bg-destructive/10  →  bg-red-100 dark:bg-red-900/40
```

**2. Display div text color + add `text-xs` (lines 5201–5207)**
```
text-success  →  text-emerald-800 dark:text-emerald-200
text-warning  →  text-amber-800 dark:text-amber-200
text-destructive  →  text-red-800 dark:text-red-200
add text-xs to the className string
```

**3. Input field text color (lines 5309–5312)**
```
text-success  →  text-emerald-800 dark:text-emerald-200
text-warning  →  text-amber-800 dark:text-amber-200
text-destructive  →  text-red-800 dark:text-red-200
```

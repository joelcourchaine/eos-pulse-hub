
## Fix: Q Avg (prev year) data cell to match previous year monthly cells

**What the monthly prev year cells do (line 4624):**
- Base: `"text-center py-[7.2px] min-w-[125px] max-w-[125px]"`
- No status: `text-muted-foreground` (muted text, plain background)
- With status: emerald/amber/red bg colors

**What the Q Avg prev year cell does (line 4449):**
- Base: `bg-[hsl(var(--scorecard-navy))] text-primary-foreground border-x-2 border-[hsl(var(--scorecard-navy)/0.3)]` — always dark navy

**Fix in `src/components/financial/FinancialSummary.tsx`, line 4449:**

Change from:
```
"text-center py-[7.2px] min-w-[100px] max-w-[100px] text-xs bg-[hsl(var(--scorecard-navy))] text-primary-foreground border-x-2 border-[hsl(var(--scorecard-navy)/0.3)]",
isDepartmentProfit && "z-10",
status === "success" && "bg-emerald-100 ...",
status === "warning" && "bg-amber-100 ...",
status === "destructive" && "bg-red-100 ...",
!status && "text-muted-foreground",
```

Change to:
```
"text-center py-[7.2px] min-w-[100px] max-w-[100px] text-xs border-x-2 border-primary/20",
isDepartmentProfit && "z-10",
status === "success" && "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-medium",
status === "warning" && "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-medium",
status === "destructive" && "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 font-medium",
!status && "text-muted-foreground",
```

This removes the navy from data cells (keeping it only on the header) and gives it the same muted treatment as the monthly prev year cells, with a subtle border to visually group it as a summary column.

**Single file, single location change.**

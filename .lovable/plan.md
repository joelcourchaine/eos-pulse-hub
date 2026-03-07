
## What to Remove

The "Copy to Q1-Q4" button appears in **FinancialSummary.tsx** only. It consists of two parts:

### 1. The `handleCopyToQuarters` function — lines 2786–2831
```
const handleCopyToQuarters = async (metricKey: string) => { ... };
```
Delete this entire function.

### 2. The Copy button + Popover UI block — lines 4706–4724
```tsx
{canEditTargets() && (
  <Popover>
    <PopoverTrigger asChild>
      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-accent">
        <Copy className="h-3 w-3" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-2" align="center">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleCopyToQuarters(metric.key)}
        className="text-xs"
      >
        Copy to Q1-Q4 {year}
      </Button>
    </PopoverContent>
  </Popover>
)}
```
Delete this entire block.

### Note on ScorecardGrid.tsx
The Scorecard has a separate `handleCopyToQuarters` and `handleCopyTrendTargetToAllQuarters` — the user only asked about **Financial Summary**, so those are left untouched.

### Files changed
- `src/components/financial/FinancialSummary.tsx` — remove function (lines 2786–2831) and UI block (lines 4706–4724)

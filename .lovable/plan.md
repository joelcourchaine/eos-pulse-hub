

# Year/Quarter Navigation with Slide Animation

## Overview
Add left/right navigation arrows between the GO Scorecard and Financial Summary sections with smooth sliding transitions when navigating between periods.

## Navigation Behavior

| View Mode | Arrow Behavior | Label |
|-----------|----------------|-------|
| Monthly Trend (quarter = -1) | Toggles years | "2026" |
| Quarter Trend (quarter = 0) | Toggles years | "2026" |
| Specific Quarter (Q1-Q4) | Toggles quarters, wraps at year boundaries | "Q2 2026" |

## Visual Design

```text
                ┌──────────────────────────────────┐
                │       GO Scorecard Card          │
                └──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────┐
│   [←]          ← 2025 slides out | 2026 slides in →  [→] │
└──────────────────────────────────────────────────────────┘
                                ▼
                ┌──────────────────────────────────┐
                │    Financial Summary Card        │
                └──────────────────────────────────┘
```

## Slide Animation Details

- **Direction**: When clicking right arrow, current period slides left (out), new period slides in from right
- **Direction**: When clicking left arrow, current period slides right (out), new period slides in from left
- **Duration**: ~200-300ms for smooth but snappy feel
- **Implementation**: CSS transitions with `transform: translateX()` and `opacity`

## Technical Implementation

### New Component: `src/components/dashboard/PeriodNavigation.tsx`

**Props:**
```typescript
interface PeriodNavigationProps {
  year: number;
  quarter: number;  // -1 = Monthly, 0 = Quarter Trend, 1-4 = specific
  onYearChange: (year: number) => void;
  onQuarterChange: (quarter: number) => void;
  minYear?: number;
  maxYear?: number;
}
```

**Animation Logic:**
- Track `slideDirection` state: `'left' | 'right' | null`
- Track `displayedPeriod` separately from actual selection
- On arrow click:
  1. Set slide direction
  2. After short delay, update displayed period
  3. Clear slide direction

**CSS Classes:**
```css
/* Slide out to left */
.slide-out-left {
  transform: translateX(-100%);
  opacity: 0;
}

/* Slide in from right */
.slide-in-right {
  transform: translateX(0);
  opacity: 1;
}
```

### Modify: `src/pages/Dashboard.tsx`

Insert between Scorecard and Financial Summary:

```tsx
<PeriodNavigation
  year={selectedYear}
  quarter={selectedQuarter}
  onYearChange={setSelectedYear}
  onQuarterChange={setSelectedQuarter}
  minYear={2024}
  maxYear={new Date().getFullYear() + 1}
/>
```

### Tailwind Animation Extension

Add to `tailwind.config.ts`:
```typescript
keyframes: {
  "slide-out-left": {
    "0%": { transform: "translateX(0)", opacity: "1" },
    "100%": { transform: "translateX(-50px)", opacity: "0" }
  },
  "slide-in-right": {
    "0%": { transform: "translateX(50px)", opacity: "0" },
    "100%": { transform: "translateX(0)", opacity: "1" }
  },
  // Mirror versions for opposite direction
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/PeriodNavigation.tsx` | New component with arrows and slide animation |
| `src/pages/Dashboard.tsx` | Insert PeriodNavigation between Scorecard and Financial Summary |
| `tailwind.config.ts` | Add slide animation keyframes |

## Boundary Handling

- **Min Year**: 2024
- **Max Year**: Current year + 1
- **Quarter Wrap**: Q4 right → Q1 (year+1), Q1 left → Q4 (year-1)
- Disable arrows at boundaries

## Testing

1. Open Dashboard in Monthly Trend view
2. Click right arrow - verify "2026" slides in from right as "2025" slides out left
3. Click left arrow - verify opposite animation direction
4. Switch to Q1 view - verify quarter navigation with same slide effect
5. Navigate Q4 → Q1 - verify year increments with slide animation


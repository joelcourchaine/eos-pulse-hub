
# Remove Automatic Previous Quarter Loading on Scroll

## Overview
This change removes the infinite scroll behavior that automatically loads previous quarter data when users scroll to the far left in the standard weekly/monthly scorecard view.

## Current Behavior
When viewing the scorecard in weekly or monthly mode (not Quarter Trend or Monthly Trend):
- Scrolling to the left edge triggers automatic loading of previous quarters
- Up to 4 previous quarters can be loaded sequentially
- Loaded quarters appear as additional columns to the left of the current quarter
- A toast notification appears each time a quarter is loaded

## Proposed Change
Disable the automatic scroll-triggered loading entirely for the standard quarterly view. Users will only see the current quarter's weeks/months.

## Implementation Details

### File to Modify
`src/components/scorecard/ScorecardGrid.tsx`

### Changes

**1. Disable the scroll listener useEffect (lines 608-731)**

Remove or disable the entire `useEffect` block that sets up scroll, wheel, and pointer event listeners for detecting left-edge scrolling:

```typescript
// Remove this entire useEffect block:
useEffect(() => {
  const container = scrollContainerRef.current;
  if (!container) return;
  if (isQuarterTrendMode || isMonthlyTrendMode) return;
  
  // ... all the scroll detection logic
  // ... tryLoadPrevious function
  // ... event listeners
}, [/* dependencies */]);
```

**2. Clean up unused state variables**

The following state and variables become unused and can be removed for cleaner code:

```typescript
// Remove these state declarations:
const [loadedPreviousQuarters, setLoadedPreviousQuarters] = useState<{ year: number; quarter: number }[]>([]);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const [previousQuarterWeeklyEntries, setPreviousQuarterWeeklyEntries] = useState<{ [key: string]: ScorecardEntry }>({});
const [previousQuarterMonthlyEntries, setPreviousQuarterMonthlyEntries] = useState<{ [key: string]: ScorecardEntry }>({});
const [previousQuarterTargets, setPreviousQuarterTargets] = useState<{ [key: string]: number }>({});
const tryLoadPreviousRef = useRef<null | (() => void)>(null);
```

**3. Remove computed values for previous quarters**

```typescript
// Remove these computed values:
const previousQuartersWeeks = ...
const previousQuartersMonths = ...
const allWeeksWithQuarterInfo = ...
```

**4. Remove the loadPreviousQuarterData function (lines 733-970)**

This entire function is no longer needed.

**5. Update the state reset in the loadScorecardData effect**

Remove the lines that reset previous quarter state when quarter/year changes:

```typescript
// Remove from the useEffect cleanup:
setLoadedPreviousQuarters([]);
setPreviousQuarterWeeklyEntries({});
setPreviousQuarterMonthlyEntries({});
```

**6. Remove any table rendering that references previous quarter data**

Any table header/body rendering that iterates over `previousQuartersWeeks`, `previousQuartersMonths`, or `allWeeksWithQuarterInfo` should be updated to only render the current quarter's periods.

## User Experience After Change
- The scorecard will display only the current quarter's weeks (13 weeks in weekly view) or months (3 months in monthly view)
- No additional quarters will load when scrolling
- Quarter Trend and Monthly Trend views remain unchanged (they already show historical data statically)
- Users can still switch quarters manually using the quarter selector dropdown

## Technical Notes
- This is a significant simplification of the component
- Reduces complexity and potential scroll-related bugs
- The Quarter Trend view (quarter = 0) and Monthly Trend view (quarter = -1) already show historical data without infinite scroll, so those remain functional

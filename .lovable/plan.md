# Remove Automatic Previous Quarter Loading on Scroll

## Status: ✅ COMPLETED

## Overview
This change removed the infinite scroll behavior that automatically loaded previous quarter data when users scrolled to the far left in the standard weekly/monthly scorecard view.

## Changes Made

### Removed State Variables
- `loadedPreviousQuarters` - Array tracking loaded previous quarters
- `isLoadingMore` - Loading state for infinite scroll
- `previousQuarterWeeklyEntries` - Entries from previous quarters (weekly)
- `previousQuarterMonthlyEntries` - Entries from previous quarters (monthly)
- `previousQuarterTargets` - Targets from previous quarters
- `tryLoadPreviousRef` - Ref for triggering load from UI

### Removed Functions
- `loadPreviousQuarterData()` - The async function that fetched previous quarter data

### Removed UI Elements
- "Load Previous Quarter" button
- Loading indicators for infinite scroll
- Previous quarter column headers
- Previous quarter data cells
- "Showing: Q1 2025, Q2 2025 + Q3 2025" indicator text

### Simplified Scroll Effect
- Replaced complex infinite scroll detection with simple scroll metrics sync for scrollbar components

### Updated Sticky Positioning
- Simplified sticky column positioning (now fixed at `left: 200` instead of dynamic calculation)

## User Experience After Change
- The scorecard displays only the current quarter's weeks (13 weeks in weekly view) or months (3 months in monthly view)
- No additional quarters load when scrolling
- Quarter Trend and Monthly Trend views remain unchanged (they show historical data statically)
- Users can still switch quarters manually using the quarter selector dropdown

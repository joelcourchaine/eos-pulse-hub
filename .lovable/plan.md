

# Unify Dark Theme Blues for Consistency

## Problem
The dark theme uses at least four different blue hue families, creating a visually inconsistent experience:

| Element | HSL Hue | Current Value |
|---------|---------|---------------|
| Background, card, muted, border | 215 | `215 28% 10%`, `215 25% 12%`, `215 25% 20%` |
| Primary, ring | 217 | `217 91% 60%` |
| Sidebar (left nav) | 240 | `240 5.9% 10%`, `240 3.7% 15.9%` |
| Right rail (inline overrides) | 222 | `222 47% 16%` |

The sidebar hue (240) is noticeably purple-grey compared to the blue-grey backgrounds (215), and the scorecard elements use yet another hue (222). This creates a patchwork of blues that looks inconsistent.

## Solution
Standardize all dark theme surface colors around **hue 222** (the scorecard/right-rail navy), which sits comfortably between the existing values and reads as a clean, modern dark blue.

## File Changes

### `src/index.css` -- Dark theme CSS variables

Shift all dark theme surface and sidebar variables to hue 222, keeping the same lightness/saturation relationships:

- `--background`: `215 28% 10%` changes to `222 28% 10%`
- `--card`: `215 25% 12%` changes to `222 25% 12%`
- `--popover`: `215 25% 12%` changes to `222 25% 12%`
- `--secondary`: `215 25% 20%` changes to `222 25% 20%`
- `--muted`: `215 25% 20%` changes to `222 25% 20%`
- `--muted-foreground`: `215 20% 65%` changes to `222 20% 65%`
- `--border`: `215 25% 20%` changes to `222 25% 20%`
- `--input`: `215 25% 20%` changes to `222 25% 20%`
- `--sidebar-background`: `240 5.9% 10%` changes to `222 28% 10%` (matches background)
- `--sidebar-accent`: `240 3.7% 15.9%` changes to `222 25% 16%`
- `--sidebar-border`: `240 3.7% 15.9%` changes to `222 25% 16%`
- `--sidebar-foreground`: `240 4.8% 95.9%` changes to `210 40% 98%` (matches foreground)
- `--sidebar-accent-foreground`: `240 4.8% 95.9%` changes to `210 40% 98%`

The primary (`217 91% 60%`) and ring stay close enough at hue 217 (these are accent/highlight colors, not surfaces, so a slight hue difference is fine and adds depth).

### `src/components/scorecard/ScorecardGrid.tsx` -- Scorecard dark overrides

The quarter tabs and summary strip currently use `dark:bg-primary` (bright blue at 60% lightness) for active states in dark mode, which is too vivid compared to the dark surfaces. Update to use a more harmonious blue:

- Active quarter tab: change `dark:bg-primary dark:border-primary` to `dark:bg-[hsl(222,47%,24%)] dark:border-[hsl(222,47%,24%)]` -- a lighter version of the navy that stands out without being neon
- Summary strip: change `dark:bg-primary/90` to `dark:bg-[hsl(222,47%,20%)]` -- a slightly elevated navy for the stats bar

This ensures the scorecard's dark-mode prominent elements use the same hue 222 family as everything else.



## Multi-Section Combined Email Report

### What the user wants
A new "Combined Report" option in the Email Report dialog that lets them checkmark individual sections (Issues & To-Dos, Top 10 lists, Scorecard, etc.) and send a single unified email containing all selected sections stitched together.

### How it fits into the existing architecture

**Current Email Report dialog** (in `Dashboard.tsx` lines 1282–1456) has a `RadioGroup` for format — `gm-overview`, `weekly`, `monthly`, etc. The GM Overview already combines multiple sections into one email via `send-gm-overview-email`. We follow the same pattern but user-driven.

**Strategy**: Add a new edge function `send-combined-report-email` that accepts a `sections` array and assembles the HTML from whichever sections are selected — reusing the same HTML-building logic from existing functions.

---

### Plan

#### 1. New edge function: `supabase/functions/send-combined-report-email/index.ts`

Accepts:
```typescript
{
  departmentId: string;
  recipientEmails: string[];
  sections: Array<"issues-todos" | "scorecard" | "top10">;
  // Scorecard-specific params (only needed if sections includes "scorecard")
  year?: number;
  quarter?: number;
  scorecardMode?: "weekly" | "monthly" | "quarterly-trend" | "yearly";
  roleFilter?: string;
  // Top 10: which lists to include
  top10ListIds?: string[];
}
```

Logic:
- Fetches the department name + store name (shared header)
- For each requested section, runs the same data-fetch + HTML-build logic from the existing individual email functions
- Stitches sections together with a horizontal rule divider between them
- Unified navy banner at top: `Store — Department Combined Report`
- Sends one email with `subject: "Store — Department Combined Report"` via Resend

The HTML structure:
```
[Navy Header Banner: Store — Department Combined Report]
[Section 1: Issues & To-Dos (if selected)]
  — horizontal divider —
[Section 2: Scorecard (if selected)]
  — horizontal divider —
[Section 3: Top 10 Lists (if selected, one per list)]
[Footer]
```

Each section uses a section sub-header (navy label bar, e.g. `Issues & To-Dos`, `Scorecard — Weekly`, `Top 10: Oldest ROs`).

#### 2. UI changes: `src/pages/Dashboard.tsx`

In the Email Report dialog, add a new option in the `RadioGroup`:

```
○ Custom Report (select sections below)
```

When `printMode === "custom"` is selected, show a section checklist:
- [ ] Issues & To-Dos
- [ ] Scorecard → sub-option for mode (Weekly/Monthly/Trend)
- [ ] Top 10 Lists → multi-select of available lists (fetched from DB when dialog opens)

State additions:
- `printMode` gains `"custom"` as a union member
- `customSections: Set<"issues-todos" | "scorecard" | "top10">` — which boxes are checked
- `customScorecardMode: "weekly" | "monthly" | "quarterly-trend"` — sub-option for scorecard
- `customTop10ListIds: string[]` — which lists to include
- `availableTop10Lists: {id, title}[]` — fetched when dialog opens (alongside recipients)

`handleEmailScorecard` already dispatches to `send-gm-overview-email` or `send-scorecard-email`. Extend it to also dispatch to `send-combined-report-email` when `printMode === "custom"`.

#### 3. Exact files changed

| File | Change |
|---|---|
| `supabase/functions/send-combined-report-email/index.ts` | New file |
| `src/pages/Dashboard.tsx` | Add `"custom"` to printMode union, add section checkboxes UI, fetch Top 10 lists on dialog open, call new edge function |

#### 4. Section HTML building (edge function design)

Each section's HTML block is a self-contained function within the new edge function, extracted from the existing individual functions:

- **Issues & To-Dos**: Copies `buildIssueRow` / `buildTodoRow` logic from `send-todos-email/index.ts`
- **Scorecard**: Copies the weekly/monthly table logic from `send-scorecard-email/index.ts`
- **Top 10**: Copies the list + items table logic from `send-top10-email/index.ts` — loops over each selected list ID

Section divider HTML:
```html
<hr style="border: none; border-top: 2px solid #e2e8f0; margin: 32px 0;">
```

Each section has a label:
```html
<div style="background: #1e293b; color: #fff; padding: 10px 20px; font-size: 14px; font-weight: 700; border-radius: 4px; margin-bottom: 12px;">
  Issues &amp; To-Dos
</div>
```

#### 5. Summary of UI flow

1. User clicks "Email Report"
2. Clicks "Custom Report" radio
3. Checkboxes appear: Issues & To-Dos / Scorecard / Top 10 Lists
4. For Scorecard: weekly/monthly sub-options shown
5. For Top 10: checkboxes for each list found in the department
6. User picks recipients and hits Send
7. Single combined email arrives with all sections in order

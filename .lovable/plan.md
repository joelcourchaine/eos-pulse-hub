
## Problem

New users like Cody Skene receive an email that says "Accept Invitation" with zero instruction about what happens next. When they click it, they land on `/set-password` which says "Create Your Password" — but the email gave no preparation for this. Users are confused and try to log in directly at `/auth` instead, where they get an error because they have no password yet.

Two things need fixing:

1. **The invitation email** — needs to clearly say "your next step is to create a password" before the button
2. **The `/set-password` page** — needs to be more welcoming and visually clear that this is Step 1 of getting into the app

## Changes

### 1. `supabase/functions/resend-user-invite/index.ts` — Update `getInviteEmailHtml`

Add explicit instructions in the email body:

- Change "Accept Invitation" button to **"Create Your Password →"**
- Add a numbered step callout: "**Step 1:** Click the button below to create your password. **Step 2:** Sign in at dealergrowth.solutions"
- Add a note: *"Do not try to log in before completing this step — you won't have a password yet"*
- Keep the same branding/styling

### 2. `src/pages/SetPassword.tsx` — Polish the "ready" state UI

Make it unmistakably clear what this page is and why they're here:

- Add a prominent welcome banner at the top: **"Welcome to Dealer Growth Solutions!"** with a green checkmark or key icon
- Add a step indicator: "Step 1 of 2: Create your password" / "Step 2: Sign in and get started"
- Show the user's name prominently (already fetched, just make it more prominent: *"Hi Cody, let's get you set up"*)
- Add inline password strength hints that update in real time as they type (uppercase ✓, number ✓, 8+ chars ✓)
- Make the submit button say **"Create Password & Get Started"** instead of just "Create Password"

### Files Changed
- `supabase/functions/resend-user-invite/index.ts` — Update invite email template
- `src/pages/SetPassword.tsx` — Improve UX of the password creation form

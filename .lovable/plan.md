
## Skip store picker when super admin navigates to My Team from a store context

**The problem:** The `RoutineSidebar` navigates to `/my-team` with no params, so a super admin without a `profile.store_id` lands on the picker and has to manually choose.

**The fix:** Two small changes:

1. **`src/components/routines/RoutineSidebar.tsx` (line 438)** — read `selectedStore` from `localStorage` and append it as a query param:
   ```ts
   const storeId = localStorage.getItem("selectedStore");
   navigate(storeId ? `/my-team?store=${storeId}` : "/my-team");
   ```

2. **`src/pages/MyTeam.tsx`** — read the `?store=` query param on mount and use it to pre-set `selectedStoreId`, bypassing the dropdown wait. The dropdown stays visible so they can still switch stores if needed.
   ```ts
   import { useSearchParams } from "react-router-dom";
   const [searchParams] = useSearchParams();
   // In the stores useEffect, after setting stores, check searchParams.get("store") first
   ```

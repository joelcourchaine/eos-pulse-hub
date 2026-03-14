
## Plan: Add `/smgserviceguide` route — SMG domain only, no password

### Files changed: 3

---

**`public/assessments/smg-service-guide.html`**
Copy of the uploaded `tricare-dashboard_2.html` file. Fully self-contained — no changes needed to its content.

---

**`src/pages/SMGServiceGuide.tsx`** — new file:
```tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SMGServiceGuide = () => {
  const navigate = useNavigate();
  const hostname = window.location.hostname;
  const isSMGDomain = hostname === "smggrowth.ca" || hostname === "www.smggrowth.ca";

  useEffect(() => {
    if (!isSMGDomain) navigate("/", { replace: true });
  }, [isSMGDomain, navigate]);

  if (!isSMGDomain) return null;

  return (
    <iframe
      src="/assessments/smg-service-guide.html"
      title="SMG Service Guide — Tricare Claims Reference"
      style={{ width: "100%", height: "100vh", border: "none" }}
    />
  );
};

export default SMGServiceGuide;
```

---

**`src/App.tsx`** — add import and route (before the catch-all `*`):
```tsx
import SMGServiceGuide from "./pages/SMGServiceGuide";
// ...
<Route path="/smgserviceguide" element={<SMGServiceGuide />} />
```

---

### Result
- `smggrowth.ca/smgserviceguide` → renders the Tricare dashboard HTML full-screen
- All other domains (including the Lovable preview) → redirect to `/`
- No DB changes, no auth changes

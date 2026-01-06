import React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

Sentry.init({
  dsn: "https://cde7eb0a0b6ad6a3dbe27eeebc5b82a0@o4510665925132288.ingest.us.sentry.io/4510665934045184",
  sendDefaultPii: true,
  enabled: import.meta.env.PROD,
});

createRoot(document.getElementById("root")!).render(<App />);

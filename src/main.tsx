import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Older builds cached the organization allowlist in browser storage. The
// allowlist is now write-only, so purge any legacy copy before rendering.
window.localStorage.removeItem("org-payment-security-context");

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/app.css";
createRoot(document.getElementById("root")!).render(<App />);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}service-worker.js`)
      .catch(() => {
        /* The app remains usable when service workers are unavailable. */
      });
  });

import "./theme-init";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./styles/index.css";

// Global error fallback to guarantee the UI never silently degrades into a blank screen before mounting
if (typeof window !== "undefined") {
  const showFallback = (msg: string) => {
    console.error("Global startup error:", msg);
    const root = document.getElementById("root");
    if (
      root &&
      (!root.firstElementChild || root.firstElementChild.children.length === 0)
    ) {
      root.innerHTML = `
        <div style="min-height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; background: #070b12; color: #f1f5f9; font-family: system-ui, sans-serif; padding: 24px;">
          <div style="max-width: 440px; width: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #ef4444; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px;">⚠️</div>
            <h2 style="font-size: 16px; font-weight: 700; margin: 0 0 8px; color: #ffffff;">Workspace Startup Notice</h2>
            <p style="font-size: 12px; color: #94a3b8; margin: 0 0 16px; line-height: 1.5;">${msg || "An unexpected startup error occurred."}</p>
            <button onclick="window.location.reload()" style="background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">Reload Application</button>
          </div>
        </div>
      `;
    }
  };

  window.addEventListener("error", (event) => {
    showFallback(
      (event.error && event.error.message) ||
        event.message ||
        "An unexpected startup error occurred."
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    console.error("Unhandled promise rejection:", msg);
  });
}

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

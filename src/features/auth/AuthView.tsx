import React, { useState } from "react";
import { LoginView } from "./LoginView";
import { SignupView } from "./SignupView";

export const AuthView: React.FC = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Ambient background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Subtle radial center spotlight */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-500/[0.04] dark:bg-indigo-500/[0.08] rounded-full blur-3xl pointer-events-none" />
        {/* Subtle dot grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 dark:opacity-20 pointer-events-none" />
      </div>

      {mode === "signup" ? (
        <SignupView onSwitchToLogin={() => setMode("login")} />
      ) : (
        <LoginView onSwitchToSignup={() => setMode("signup")} />
      )}

      {/* Subtle branding footer */}
      <div className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500 relative z-10 select-none">
        Infinity Researcher • 100% Local-First Academic Research Engine
      </div>
    </div>
  );
};

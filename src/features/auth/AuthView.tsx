import React, { useState } from "react";
import { LoginView } from "./LoginView";
import { SignupView } from "./SignupView";

export const AuthView: React.FC = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (mode === "signup") {
    return <SignupView onSwitchToLogin={() => setMode("login")} />;
  }
  return <LoginView onSwitchToSignup={() => setMode("signup")} />;
};


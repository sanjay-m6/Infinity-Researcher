import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AppProvider, useApp } from "../context/AppContext";
import { App } from "../app/App";
import { SignupView } from "../features/auth/SignupView";
import { LoginView } from "../features/auth/LoginView";
import { LockScreenView } from "../features/auth/LockScreenView";

// Mock Tauri bridge for deterministic testing
vi.mock("../lib/tauri-bridge", () => ({
  isTauriEnvironment: () => false,
  normalizeCommandError: (err: unknown) => err,
  getErrorMessage: (err: unknown) => String(err),
}));

describe("Feature: Local Authentication System — UI & Behavior", () => {
  it("renders Signup page with required fields and performs client validation", async () => {
    const handleSwitch = vi.fn();
    render(
      <AppProvider>
        <SignupView onSwitchToLogin={handleSwitch} />
      </AppProvider>
    );

    // Verify fields
    expect(screen.getByPlaceholderText(/researcher@university.edu/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/sanjay_research/i)).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText(/••••••••••••/i)).toHaveLength(2);
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();

    // Trigger mismatch password validation
    const emailInput = screen.getByPlaceholderText(/researcher@university.edu/i);
    const userInput = screen.getByPlaceholderText(/sanjay_research/i);
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••••••/i);

    fireEvent.change(emailInput, { target: { value: "test@domain.com" } });
    fireEvent.change(userInput, { target: { value: "tester123" } });
    fireEvent.change(passwordInputs[0], { target: { value: "Password123!" } });
    fireEvent.change(passwordInputs[1], { target: { value: "DifferentPassword456" } });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });

    // Test switch to login link
    const loginLink = screen.getByRole("button", { name: /log in/i });
    fireEvent.click(loginLink);
    expect(handleSwitch).toHaveBeenCalledTimes(1);
  });

  it("renders Login page with Show/Hide password toggle and remember-me checkbox", async () => {
    const handleSwitch = vi.fn();
    render(
      <AppProvider>
        <LoginView onSwitchToSignup={handleSwitch} />
      </AppProvider>
    );

    const identifierInput = screen.getByPlaceholderText(/admin or researcher/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••••••/i);
    const rememberMeCheckbox = screen.getByRole("checkbox");

    expect(identifierInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(rememberMeCheckbox).toBeChecked();

    // Click Show/Hide password toggle
    const toggleButton = passwordInput.parentElement?.querySelector("button");
    expect(toggleButton).toBeTruthy();
    if (toggleButton) {
      fireEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute("type", "text");
    }

    // Switch to create account link
    const signupLink = screen.getByRole("button", { name: /create account/i });
    fireEvent.click(signupLink);
    expect(handleSwitch).toHaveBeenCalledTimes(1);
  });

  it("renders Lock Screen with current User ID and password unlock prompt", async () => {
    // Custom test component to simulate locked state
    const TestLockedWrapper: React.FC = () => {
      const { lockApplication } = useApp();
      return (
        <div>
          <button onClick={() => void lockApplication()}>Lock</button>
          <LockScreenView />
        </div>
      );
    };

    render(
      <AppProvider>
        <TestLockedWrapper />
      </AppProvider>
    );

    expect(screen.getByText(/application locked/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter password to unlock/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unlock application/i })).toBeInTheDocument();
    expect(screen.getByText(/switch account or log out/i)).toBeInTheDocument();
  });

  it("transitions smoothly from AuthView to AppShell upon signup without hooks crash", async () => {
    // Start with initialUser={null} to simulate fresh unauthenticated user
    render(<App initialUser={null} />);

    // User is on Login/Signup
    expect(screen.getByText(/sign in to unlock/i)).toBeInTheDocument();

    // Switch to create account
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    // Fill signup form
    const emailInput = screen.getByPlaceholderText(/researcher@university.edu/i);
    const userInput = screen.getByPlaceholderText(/sanjay_research/i);
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••••••/i);

    fireEvent.change(emailInput, { target: { value: "test@lab.edu" } });
    fireEvent.change(userInput, { target: { value: "lab_lead" } });
    fireEvent.change(passwordInputs[0], { target: { value: "StrongPassword123!" } });
    fireEvent.change(passwordInputs[1], { target: { value: "StrongPassword123!" } });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    // Should transition to main AppShell
    await waitFor(() => {
      expect(screen.getAllByText("Infinity Researcher").length).toBeGreaterThan(0);
      expect(screen.getByRole("navigation", { name: "Main Navigation" })).toBeInTheDocument();
    });
  });
});

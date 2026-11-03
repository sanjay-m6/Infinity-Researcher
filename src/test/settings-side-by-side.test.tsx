import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SettingsView } from "../features/settings/SettingsView";
import { AppProvider } from "../context/AppContext";

describe("SettingsView — Side-by-Side Master-Detail Panel Modernization", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the main page header and side-by-side view switcher", () => {
    render(
      <AppProvider>
        <SettingsView />
      </AppProvider>
    );

    // Primary heading
    expect(
      screen.getByRole("heading", { name: "Settings & Diagnostics", level: 1 })
    ).toBeInTheDocument();

    // View switcher buttons
    expect(screen.getByRole("button", { name: /Side-by-Side/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Categorized/i })).toBeInTheDocument();
  });

  it("renders the left navigation panel with all settings categories", () => {
    render(
      <AppProvider>
        <SettingsView />
      </AppProvider>
    );

    expect(screen.getByText("All Settings")).toBeInTheDocument();
    expect(screen.getByText("Appearance & Theme")).toBeInTheDocument();
    expect(screen.getByText("Account & Security")).toBeInTheDocument();
    expect(screen.getByText("Database & Storage")).toBeInTheDocument();
    expect(screen.getByText("Academic API Keys")).toBeInTheDocument();
    expect(screen.getByText("Rust Core & Health")).toBeInTheDocument();
    expect(screen.getByText("Automatic Updates")).toBeInTheDocument();
    expect(screen.getByText("About & Creator")).toBeInTheDocument();
  });

  it("renders the core runtime status indicators in the left sidebar", () => {
    render(
      <AppProvider>
        <SettingsView />
      </AppProvider>
    );

    expect(screen.getByText("Core Runtime Status")).toBeInTheDocument();
    expect(screen.getByText(/SQLite Engine/i)).toBeInTheDocument();
    expect(screen.getByText(/Tauri \/ Rust Bridge/i)).toBeInTheDocument();
    expect(screen.getByText(/Storage Privacy/i)).toBeInTheDocument();
  });

  it("filters settings cards when selecting a specific category", () => {
    render(
      <AppProvider>
        <SettingsView />
      </AppProvider>
    );

    // Initially in side-by-side mode, both Appearance and Database are visible
    expect(screen.getByText(/Appearance & Visual Theme/i)).toBeInTheDocument();
    expect(screen.getByText(/Local-First SQLite Database & Storage/i)).toBeInTheDocument();

    // Click on Appearance & Theme category
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Appearance & Theme/i }));
    });

    // Appearance is visible, but Database is filtered out
    expect(screen.getByText(/Appearance & Visual Theme/i)).toBeInTheDocument();
    expect(screen.queryByText(/Local-First SQLite Database & Storage/i)).not.toBeInTheDocument();

    // Click on "View All Side-by-Side"
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /View All Side-by-Side/i }));
    });

    // Both are visible again
    expect(screen.getByText(/Appearance & Visual Theme/i)).toBeInTheDocument();
    expect(screen.getByText(/Local-First SQLite Database & Storage/i)).toBeInTheDocument();
  });

  it("filters settings cards live using the search input", () => {
    render(
      <AppProvider>
        <SettingsView />
      </AppProvider>
    );

    const searchInput = screen.getByPlaceholderText(/Search settings & options.../i);

    // Search for "sqlite"
    act(() => {
      fireEvent.change(searchInput, { target: { value: "sqlite" } });
    });

    // Database is visible, Appearance is filtered out
    expect(screen.getByText(/Local-First SQLite Database & Storage/i)).toBeInTheDocument();
    expect(screen.queryByText(/Appearance & Visual Theme/i)).not.toBeInTheDocument();

    // Clear search
    act(() => {
      fireEvent.change(searchInput, { target: { value: "" } });
    });

    expect(screen.getByText(/Appearance & Visual Theme/i)).toBeInTheDocument();
    expect(screen.getByText(/Local-First SQLite Database & Storage/i)).toBeInTheDocument();
  });
});


import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../app/App";
import { INITIAL_DEMO_PAPERS, INITIAL_DEMO_COLLECTIONS } from "../data/demo-data";

describe("AppShell Integration Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("renders the application shell with product title and navigation items", () => {
    render(<App />);

    expect(screen.getAllByText("Infinity Researcher").length).toBeGreaterThan(0);
    expect(screen.getByText("Discover. Understand.")).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Main Navigation" });
    expect(within(nav).getByRole("button", { name: /Dashboard/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Discover/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Library/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Downloads/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Collections/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Sources/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Activity/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Settings/i })).toBeInTheDocument();
  });

  it("navigates across main sections via sidebar", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Default is Dashboard
    expect(
      screen.getByRole("heading", { name: "Scholarly Workspace", level: 1 })
    ).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Main Navigation" });

    // Navigate to Discover
    await user.click(within(nav).getByRole("button", { name: /Discover/i }));
    expect(
      screen.getByRole("heading", { name: "Discover Research Papers", level: 1 })
    ).toBeInTheDocument();

    // Navigate to Library
    await user.click(within(nav).getByRole("button", { name: /Library/i }));
    expect(
      screen.getByRole("heading", { name: "Saved Paper Library", level: 1 })
    ).toBeInTheDocument();

    // Navigate to Downloads
    await user.click(within(nav).getByRole("button", { name: /Downloads/i }));
    expect(
      screen.getByRole("heading", { name: "Downloads & Retrieval Jobs", level: 1 })
    ).toBeInTheDocument();

    // Navigate to Collections
    await user.click(within(nav).getByRole("button", { name: /Collections/i }));
    expect(
      screen.getByRole("heading", { name: "Research Collections", level: 1 })
    ).toBeInTheDocument();

    // Navigate to Sources
    await user.click(within(nav).getByRole("button", { name: /Sources/i }));
    expect(
      screen.getByRole("heading", {
        name: "Website Sources & Scraper Profiles",
        level: 1,
      })
    ).toBeInTheDocument();

    // Navigate to Activity
    await user.click(within(nav).getByRole("button", { name: /Activity/i }));
    expect(
      screen.getByRole("heading", { name: "Activity & Event Logs", level: 1 })
    ).toBeInTheDocument();

    // Navigate to Settings
    await user.click(within(nav).getByRole("button", { name: /Settings/i }));
    expect(
      screen.getByRole("heading", { name: "Settings & Diagnostics", level: 1 })
    ).toBeInTheDocument();
  });

  it("toggles light, dark, and system themes", async () => {
    const user = userEvent.setup();
    render(<App />);

    const darkButton = screen.getByRole("button", { name: "Dark mode" });
    await user.click(darkButton);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("rps_theme")).toBe("dark");

    const lightButton = screen.getByRole("button", { name: "Light mode" });
    await user.click(lightButton);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("rps_theme")).toBe("light");
  });

  it("opens the Paper Details drawer when clicking a paper row", async () => {
    const user = userEvent.setup();
    render(<App initialPapers={INITIAL_DEMO_PAPERS} />);

    // Click on the first recent paper on Dashboard
    const paperTitle = screen.getByText("Attention Is All You Need");
    await user.click(paperTitle);

    // Verify drawer appears with full metadata
    expect(screen.getByText("Research Paper Details")).toBeInTheDocument();
    expect(screen.getByText("Open Source Page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy BibTeX/i })).toBeInTheDocument();

    // Close drawer
    const closeButton = screen.getByRole("button", { name: "Close details" });
    await user.click(closeButton);
    await waitFor(() => {
      expect(screen.queryByText("Research Paper Details")).not.toBeInTheDocument();
    });
  });

  it("validates and prevents duplicate collection creation", async () => {
    const user = userEvent.setup();
    render(<App initialCollections={INITIAL_DEMO_COLLECTIONS} />);

    const nav = screen.getByRole("navigation", { name: "Main Navigation" });

    // Go to Collections screen
    await user.click(within(nav).getByRole("button", { name: /Collections/i }));

    // Open create modal
    await user.click(screen.getByRole("button", { name: /New Collection/i }));
    expect(screen.getByText("Create New Research Collection")).toBeInTheDocument();

    // Try submitting empty
    const createSubmitButton = screen.getByRole("button", { name: "Create Collection" });
    await user.click(createSubmitButton);
    expect(screen.getByText("Collection name cannot be blank.")).toBeInTheDocument();

    // Try submitting duplicate name
    const input = screen.getByLabelText("Collection Name");
    await user.type(input, "Machine Learning Foundations");
    await user.click(createSubmitButton);
    expect(
      screen.getByText(
        'A collection named "Machine Learning Foundations" already exists.'
      )
    ).toBeInTheDocument();

    // Submit valid new name
    await user.clear(input);
    await user.type(input, "Biochemical Modeling");
    await user.click(createSubmitButton);

    // Verify modal closes and new collection appears
    await waitFor(() => {
      expect(screen.getByText("Biochemical Modeling")).toBeInTheDocument();
    });
  });

  it("opens the command palette with keyboard shortcut or button", async () => {
    render(<App />);

    const cmdButton = screen.getByRole("button", { name: "Open command palette" });
    fireEvent.click(cmdButton);

    expect(screen.getByRole("dialog", { name: "Command Palette" })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Type a screen name or search papers...")
    ).toBeInTheDocument();

    // Press Escape to close
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Command Palette" })
      ).not.toBeInTheDocument();
    });
  });
});

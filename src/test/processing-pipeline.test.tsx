import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { LibraryView } from "../features/library/LibraryView";

describe("Phase 7 — Paper Processing, Deduplication & PDF Integrity Frontend", () => {
  it("renders LibraryView with Phase 7 tabs", () => {
    render(
      <AppProvider>
        <LibraryView />
      </AppProvider>
    );

    // Verify main heading
    expect(screen.getByRole("heading", { name: "Saved Paper Library" })).toBeInTheDocument();

    // Verify tab buttons
    expect(screen.getByRole("button", { name: /Library Papers/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Duplicate Review/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Document Integrity & Pipeline/i })).toBeInTheDocument();
  });

  it("switches to Duplicate Review tab and renders queue controls", async () => {
    render(
      <AppProvider>
        <LibraryView />
      </AppProvider>
    );

    const dupTab = screen.getByRole("button", { name: /Duplicate Review/i });
    fireEvent.click(dupTab);

    // Verify Duplicate Review tab contents
    await waitFor(() => {
      expect(screen.getByText(/Explainable Duplicate Detection/i)).toBeInTheDocument();
    });

    // Check action buttons in duplicate review
    expect(screen.getByRole("button", { name: /Scan for Duplicates/i })).toBeInTheDocument();
  });

  it("switches to Document Integrity & Pipeline tab and renders pipeline controls and file table", async () => {
    render(
      <AppProvider>
        <LibraryView />
      </AppProvider>
    );

    const pipelineTab = screen.getByRole("button", { name: /Document Integrity & Pipeline/i });
    fireEvent.click(pipelineTab);

    // Verify Pipeline Overview cards
    await waitFor(() => {
      expect(screen.getByText(/Persistent Processing Pipeline/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Normalize All Metadata/i })).toBeInTheDocument();
    expect(screen.getByText(/Local Document Storage & Verified Integrity Files/i)).toBeInTheDocument();
  });
});

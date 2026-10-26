import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { IeeeOpenAccessView } from "../features/ieee/IeeeOpenAccessView";

describe("IEEE Open Access Hub (Mode A & Provenance System)", () => {
  it("renders page header, terms-compliant badge, and 4-step pipeline guide", async () => {
    render(
      <AppProvider>
        <IeeeOpenAccessView />
      </AppProvider>
    );

    // Verify Heading
    expect(
      screen.getByRole("heading", { name: /IEEE Open Access Hub/i })
    ).toBeInTheDocument();

    // Verify Mode A badge
    expect(screen.getByText(/Mode A • Terms Compliant/i)).toBeInTheDocument();

    // Verify 4-step pipeline guide
    expect(
      screen.getByRole("heading", { name: /How the IEEE Open Access Workflow Works/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Find IEEE Paper/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirm Open Access/i)).toBeInTheDocument();
    expect(screen.getByText(/Download Official PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/Import & Read in App/i)).toBeInTheDocument();

    // Verify Stats Metrics Cards
    expect(screen.getByText(/Total Open Access/i)).toBeInTheDocument();
    expect(screen.getByText(/IEEE Imported Papers/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Permitted Downloads/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Pending Verification/i)).toBeInTheDocument();
  });

  it("opens manual import modal with mandatory open access confirmation checkbox", async () => {
    render(
      <AppProvider>
        <IeeeOpenAccessView />
      </AppProvider>
    );

    // Click Import IEEE PDF button in header actions
    const importBtn = screen.getByRole("button", { name: /Import IEEE PDF/i });
    fireEvent.click(importBtn);

    // Modal should be open
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Import Downloaded IEEE Open Access PDF/i })
      ).toBeInTheDocument();
    });

    // Verify required form fields
    expect(screen.getByPlaceholderText(/C:\\Users\\username\\Downloads\\ieee_paper.pdf/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. Advances in Quantum Computing Architectures/i)).toBeInTheDocument();

    // Verify mandatory Open Access User Confirmation checkbox
    const confirmationLabel = screen.getByText(/Open Access User Confirmation \(Required by Policy\)/i);
    expect(confirmationLabel).toBeInTheDocument();

    // Verify submit button is disabled initially
    const submitBtn = screen.getByRole("button", { name: /Confirm & Import PDF/i });
    expect(submitBtn).toBeDisabled();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { DiscoverView } from "../features/discover/DiscoverView";

describe("Website-Driven Research Paper Discovery View (No-API Engine)", () => {
  it("renders website-driven discovery tab, seed URL input, and inspect controls", () => {
    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    // Verify main heading
    expect(
      screen.getByRole("heading", { name: /Discover Research Papers/i })
    ).toBeInTheDocument();

    // Verify Website-Driven tab is present and active
    expect(screen.getByText(/Website-Driven Discovery \(No-API\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Academic API Connectors/i)).toBeInTheDocument();

    // Open the advanced inspect drawer
    fireEvent.click(screen.getByText(/Advanced: Inspect Permitted Website/i));

    // Verify seed URL input
    expect(
      screen.getByPlaceholderText(/Enter seed URL/i)
    ).toBeInTheDocument();

    // Verify Action Buttons
    expect(screen.getByRole("button", { name: /Inspect Page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Crawl/i })).toBeInTheDocument();
  });

  it("renders quick scholarly repository seed presets", () => {
    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    // Open the advanced inspect drawer
    fireEvent.click(screen.getByText(/Advanced: Inspect Permitted Website/i));

    expect(screen.getByRole("button", { name: /bioRxiv Recent/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PLOS ONE/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nature Scientific Reports/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /arXiv CS List/i })).toBeInTheDocument();

    // Click a preset and verify input updates
    const plosBtn = screen.getByRole("button", { name: /PLOS ONE/i });
    fireEvent.click(plosBtn);
    const input = screen.getByPlaceholderText(/Enter seed URL/i) as HTMLInputElement;
    expect(input.value).toBe("https://journals.plos.org/plosone/");
  });

  it("switches to Academic API Connectors tab and displays No-API policy warning", async () => {
    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    const academicTabBtn = screen.getByRole("button", { name: /Academic API Connectors/i });
    fireEvent.click(academicTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Academic Provider APIs Inactive/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Under the strict No-API Website-Driven scraper specification/i)
      ).toBeInTheDocument();
    });
  });

  it("displays empty state when no crawl jobs exist initially", () => {
    render(
      <AppProvider>
        <DiscoverView />
      </AppProvider>
    );

    // Open the advanced inspect drawer
    fireEvent.click(screen.getByText(/Advanced: Inspect Permitted Website/i));

    expect(screen.getByText(/No Crawl Jobs Executed Yet/i)).toBeInTheDocument();
  });
});

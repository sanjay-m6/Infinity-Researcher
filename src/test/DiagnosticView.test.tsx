import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiagnosticView } from "../components/DiagnosticView";
import * as tauriBridge from "../lib/tauri-bridge";
import { HealthResponse, CommandError } from "../types/health";

vi.mock("../lib/tauri-bridge");

const mockHealthResponse: HealthResponse = {
  status: "healthy",
  app_version: "0.1.0",
  platform: "windows-x86_64",
  backend_ready: true,
  uptime_secs: 42,
  default_storage_dir: "C:\\Users\\Elena\\Documents\\ResearchPapers",
  subsystems: {
    database: "not_initialized (Scheduled for Phase 4)",
    network_engine: "ready (Base HTTP Client)",
    scraper_pipeline: "not_implemented (Scheduled for Phase 5-6)",
    pdf_processor: "not_implemented (Scheduled for Phase 7)",
  },
};

describe("DiagnosticView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders accurately in browser fallback mode when Tauri IPC is absent", async () => {
    vi.spyOn(tauriBridge, "isTauriEnvironment").mockReturnValue(false);

    render(<DiagnosticView />);

    expect(screen.getByText("Research Paper Scraper")).toBeInTheDocument();
    expect(
      screen.getByText("Desktop Foundation / Phase 2 Diagnostics")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("Browser Fallback Mode (No Desktop IPC)")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/The frontend is rendering in standard browser mode/i)
    ).toBeInTheDocument();
  });

  it("renders healthy backend status and platform details when connected via Tauri IPC", async () => {
    vi.spyOn(tauriBridge, "isTauriEnvironment").mockReturnValue(true);
    vi.spyOn(tauriBridge, "pingBackend").mockResolvedValue("pong");
    vi.spyOn(tauriBridge, "getAppHealth").mockResolvedValue(mockHealthResponse);

    render(<DiagnosticView />);

    await waitFor(() => {
      expect(screen.getByText("Rust Native Backend Connected")).toBeInTheDocument();
    });

    expect(screen.getByText("windows-x86_64")).toBeInTheDocument();
    expect(screen.getByText("42s")).toBeInTheDocument();
    expect(screen.getByText("Strict CSP Enforced")).toBeInTheDocument();
    expect(
      screen.getByText(/C:\\Users\\Elena\\Documents\\ResearchPapers/i)
    ).toBeInTheDocument();
  });

  it("renders safe error state and allows user retry when backend communication fails", async () => {
    vi.spyOn(tauriBridge, "isTauriEnvironment").mockReturnValue(true);
    vi.spyOn(tauriBridge, "pingBackend").mockResolvedValue("pong");

    const mockError: CommandError = {
      code: "ERR_COMMAND",
      message: "Connection refused by native dispatcher",
      retryable: true,
    };
    vi.spyOn(tauriBridge, "getAppHealth").mockRejectedValue(mockError);

    render(<DiagnosticView />);

    await waitFor(() => {
      expect(screen.getByText("Backend Communication Failure")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Connection refused by native dispatcher/i)
    ).toBeInTheDocument();

    // Verify retry button is rendered and clickable
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    // Change mock to resolve on retry
    vi.spyOn(tauriBridge, "getAppHealth").mockResolvedValue(mockHealthResponse);
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("Rust Native Backend Connected")).toBeInTheDocument();
    });
  });
});

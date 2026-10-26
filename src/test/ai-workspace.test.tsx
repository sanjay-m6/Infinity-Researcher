import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { AiHubView } from "../features/ai-hub/AiHubView";

describe("AI Workspace, Multi-Provider & RAG Knowledge (Part L)", () => {
  it("renders AI Hub with 7 workspace tabs and privacy mode indicators", async () => {
    render(
      <AppProvider>
        <AiHubView />
      </AppProvider>
    );

    // Title and Header
    expect(screen.getByText("AI Workspace & Research Knowledge")).toBeInTheDocument();
    expect(screen.getByText(/Shared RAG Library Pipeline/i)).toBeInTheDocument();

    // Verify all 7 navigation tabs exist
    expect(screen.getByRole("button", { name: /Providers & Models/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reading Assistant & Chat/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recommendations/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Library Indexing \(RAG\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fine-Tuning Lab/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Evaluations & Quality/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Privacy & Storage/i })).toBeInTheDocument();
  });

  it("displays local and cloud provider badges and task routing options", async () => {
    render(
      <AppProvider>
        <AiHubView />
      </AppProvider>
    );

    // Default tab is providers
    expect(screen.getByText("AI Provider Catalog & Routing")).toBeInTheDocument();
    expect(screen.getByText(/Local runtimes \(Ollama, LM Studio\) run entirely offline/i)).toBeInTheDocument();
    expect(screen.getByText("Task-to-Model Routing Rules")).toBeInTheDocument();
  });

  it("navigates to Fine-Tuning Lab and displays honest RAG vs Fine-Tuning distinction", async () => {
    render(
      <AppProvider>
        <AiHubView />
      </AppProvider>
    );

    const ftTab = screen.getByRole("button", { name: /Fine-Tuning Lab/i });
    fireEvent.click(ftTab);

    // Conceptual distinction callout
    expect(screen.getByText("Important: RAG vs. Model Fine-Tuning")).toBeInTheDocument();
    expect(screen.getByText(/RAG \(Retrieval-Augmented Generation\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Local Hardware & Capability Pre-Flight Check/i)).toBeInTheDocument();
  });

  it("navigates to Privacy & Storage and exposes local-only and paid API toggles", async () => {
    render(
      <AppProvider>
        <AiHubView />
      </AppProvider>
    );

    const privTab = screen.getByRole("button", { name: /Privacy & Storage/i });
    fireEvent.click(privTab);

    expect(screen.getByText("Backend-Enforced Privacy Boundaries")).toBeInTheDocument();
    expect(screen.getByText("Local-Only Mode")).toBeInTheDocument();
    expect(screen.getByText("Never Use Paid APIs")).toBeInTheDocument();
    expect(screen.getByText("Cloud Paper Context Sharing")).toBeInTheDocument();
  });

  it("navigates to Evaluations and displays local deterministic benchmarks", async () => {
    render(
      <AppProvider>
        <AiHubView />
      </AppProvider>
    );

    const evalTab = screen.getByRole("button", { name: /Evaluations & Quality/i });
    fireEvent.click(evalTab);

    expect(screen.getByText("Deterministic Local Evaluation Center")).toBeInTheDocument();
    expect(screen.getByText("Citation Accuracy")).toBeInTheDocument();
    expect(screen.getByText("Abstention Rate")).toBeInTheDocument();
    expect(screen.getByText("Injection Neutralization")).toBeInTheDocument();
  });
});

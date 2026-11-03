import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ParticleField,
  GlobalLoadingOverlay,
  AITypingIndicator,
  PageLoadingView,
} from "../components/loading";
import { LoadingState } from "../components/feedback/LoadingState";

describe("Particle Loading Experience & AI Typing Indicator Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ParticleField component", () => {
    it("renders fallback gracefully when WebGL is not available in test environment", () => {
      const { container } = render(
        <ParticleField particleCount={100} active={true} variant="full" />
      );

      // In jsdom without WebGL, it falls back to the CSS loading indicator
      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("accepts reduced-motion prop and renders without throwing", () => {
      const { container } = render(
        <ParticleField
          particleCount={200}
          active={true}
          reducedMotion={true}
          variant="compact"
        />
      );

      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("GlobalLoadingOverlay component", () => {
    it("renders the startup title and custom status message when visible", () => {
      render(
        <GlobalLoadingOverlay
          visible={true}
          statusMessage="Preparing research library"
          subMessage="Connecting to local SQLite database..."
          variant="startup"
        />
      );

      expect(screen.getByText("Infinity Researcher")).toBeInTheDocument();
      expect(screen.getByText("Preparing research library")).toBeInTheDocument();
      expect(screen.getByText("Connecting to local SQLite database...")).toBeInTheDocument();
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("does not render when visible is false", () => {
      render(
        <GlobalLoadingOverlay
          visible={false}
          statusMessage="Preparing workspace"
        />
      );

      expect(screen.queryByText("Infinity Researcher")).not.toBeInTheDocument();
    });

    it("renders error state with retry button when error occurs", () => {
      const onRetryMock = vi.fn();
      render(
        <GlobalLoadingOverlay
          visible={true}
          statusMessage="Starting engine"
          error="Failed to connect to backend service"
          onRetry={onRetryMock}
        />
      );

      expect(screen.getByText("Initialization failed")).toBeInTheDocument();
      expect(screen.getByText("Failed to connect to backend service")).toBeInTheDocument();

      const retryBtn = screen.getByRole("button", { name: /Retry/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);
      expect(onRetryMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("PageLoadingView component", () => {
    it("renders compact particle cluster with message", () => {
      render(<PageLoadingView visible={true} message="Synthesizing multi-paper matrix..." />);

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Synthesizing multi-paper matrix...")).toBeInTheDocument();
    });

    it("hides when visible is false", () => {
      render(<PageLoadingView visible={false} message="Loading workspace..." />);

      expect(screen.queryByText("Loading workspace...")).not.toBeInTheDocument();
    });
  });

  describe("AITypingIndicator component", () => {
    it("renders chat variant with contextual message for research_assistant", () => {
      render(
        <AITypingIndicator
          visible={true}
          activityState="generating"
          context="research_assistant"
          variant="chat"
        />
      );

      expect(screen.getByText("Generating an answer")).toBeInTheDocument();
    });

    it("renders matrix_copilot context with specific research synthesis status", () => {
      render(
        <AITypingIndicator
          visible={true}
          activityState="analyzing"
          context="matrix_copilot"
          variant="chat"
        />
      );

      expect(screen.getByText("Comparing selected papers")).toBeInTheDocument();
    });

    it("renders pdf_assistant context with evidence extraction message", () => {
      render(
        <AITypingIndicator
          visible={true}
          activityState="reading_paper"
          context="pdf_assistant"
          variant="chat"
        />
      );

      expect(screen.getByText("Analyzing the selected passage")).toBeInTheDocument();
    });

    it("supports custom statusMessage override", () => {
      render(
        <AITypingIndicator
          visible={true}
          statusMessage="Searching 100+ local paper embeddings..."
          variant="inline"
        />
      );

      expect(screen.getByText("Searching 100+ local paper embeddings...")).toBeInTheDocument();
    });

    it("renders workspace variant with multi-particle orb animation", () => {
      render(
        <AITypingIndicator
          visible={true}
          activityState="analyzing"
          context="paper_understanding"
          variant="workspace"
        />
      );

      expect(screen.getByText("Analyzing methodology and findings")).toBeInTheDocument();
    });

    it("does not render when visible is false", () => {
      render(
        <AITypingIndicator
          visible={false}
          statusMessage="Generating answer..."
        />
      );

      expect(screen.queryByText("Generating answer...")).not.toBeInTheDocument();
    });
  });

  describe("Modernized LoadingState feedback component", () => {
    it("renders particles variant by default", () => {
      render(<LoadingState message="Extracting citations from PDF..." />);

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Extracting citations from PDF...")).toBeInTheDocument();
    });

    it("renders inline variant with pulsing dots", () => {
      render(<LoadingState message="Saving to database..." variant="inline" />);

      expect(screen.getByText("Saving to database...")).toBeInTheDocument();
    });
  });
});

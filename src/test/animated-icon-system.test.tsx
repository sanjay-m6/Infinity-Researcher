import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AppIcon,
  AnimatedIcon,
  IconButton,
  IconRegistry,
  ICON_SIZES,
  resolveIconPixelSize,
  resolveStrokeWidth,
} from "../components/icons";
import { Search, ChevronDown, RefreshCw, Settings, BookOpen } from "lucide-react";

describe("Phase 6 — Animated Icon System Modernization", () => {
  describe("1. AppIcon Primitive & Sizing Standards", () => {
    it("renders default medium icon with aria-hidden='true' when decorative", () => {
      const { container } = render(<AppIcon icon={Search} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).not.toHaveAttribute("role");
      expect(svg).toHaveAttribute("width", "18");
      expect(svg).toHaveAttribute("height", "18");
      expect(svg).toHaveAttribute("stroke-width", "2");
    });

    it("renders semantic token sizes correctly (xs, sm, md, lg, xl, 2xl)", () => {
      const sizes: (keyof typeof ICON_SIZES)[] = ["xs", "sm", "md", "lg", "xl", "2xl"];

      sizes.forEach((size) => {
        const { container } = render(<AppIcon icon={BookOpen} size={size} />);
        const svg = container.querySelector("svg");
        const expectedPx = String(ICON_SIZES[size].px);
        expect(svg).toHaveAttribute("width", expectedPx);
        expect(svg).toHaveAttribute("height", expectedPx);
        expect(svg).toHaveAttribute("stroke-width", String(ICON_SIZES[size].strokeWidth));
      });
    });

    it("supports custom numeric pixel dimensions and stroke width override", () => {
      const { container } = render(
        <AppIcon icon={Search} size={28} strokeWidth={1.5} className="text-indigo-600" />
      );
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "28");
      expect(svg).toHaveAttribute("height", "28");
      expect(svg).toHaveAttribute("stroke-width", "1.5");
      expect(svg).toHaveClass("text-indigo-600");
    });

    it("applies role='img' and aria-label when accessible name is explicitly provided", () => {
      render(<AppIcon icon={Search} aria-label="Search research papers" title="Paper Search" />);
      const icon = screen.getByRole("img", { name: "Search research papers" });
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute("title", "Paper Search");
    });

    it("correctly calculates size and stroke fallbacks via utility helpers", () => {
      expect(resolveIconPixelSize(undefined)).toBe(18);
      expect(resolveIconPixelSize("xl")).toBe(24);
      expect(resolveStrokeWidth(undefined)).toBe(2.0);
      expect(resolveStrokeWidth("2xl")).toBe(1.5);
      expect(resolveStrokeWidth(undefined, 2.5)).toBe(2.5);
    });
  });

  describe("2. AnimatedIcon Micro-Interactions & Reduced-Motion Safety", () => {
    it("renders static icon cleanly when animation='none'", () => {
      const { container } = render(<AnimatedIcon icon={Search} animation="none" />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      // Should not wrap in motion span when animation is none
      expect(container.querySelector("span")).not.toBeInTheDocument();
    });

    it("renders motion span wrapper when animation is enabled", () => {
      const { container } = render(
        <AnimatedIcon icon={RefreshCw} animation="spin" isAnimating={true} />
      );
      const span = container.querySelector("span");
      expect(span).toBeInTheDocument();
      expect(span?.querySelector("svg")).toBeInTheDocument();
    });

    it("handles expand-chevron rotation states", () => {
      const { container: unexpanded } = render(
        <AnimatedIcon icon={ChevronDown} animation="expand-chevron" isExpanded={false} />
      );
      expect(unexpanded.querySelector("svg")).toBeInTheDocument();

      const { container: expanded } = render(
        <AnimatedIcon
          icon={ChevronDown}
          animation="expand-chevron"
          isExpanded={true}
          chevronAngle={180}
        />
      );
      expect(expanded.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("3. IconButton Accessibility & Interaction Standards", () => {
    it("renders button with required accessible name (aria-label) and default ghost variant", () => {
      render(
        <IconButton
          icon={Settings}
          aria-label="Open application settings"
        />
      );
      const button = screen.getByRole("button", { name: "Open application settings" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveClass("w-9 h-9"); // default "md" size
    });

    it("triggers onClick handler when clicked", () => {
      const handleClick = vi.fn();
      render(
        <IconButton
          icon={Settings}
          aria-label="Configure AI"
          onClick={handleClick}
        />
      );
      const button = screen.getByRole("button", { name: "Configure AI" });
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("disables button and prevents clicks when disabled=true", () => {
      const handleClick = vi.fn();
      render(
        <IconButton
          icon={Settings}
          aria-label="Configure AI"
          disabled={true}
          onClick={handleClick}
        />
      );
      const button = screen.getByRole("button", { name: "Configure AI" });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("shows loading state with spinner and sets aria-busy='true'", () => {
      render(
        <IconButton
          icon={RefreshCw}
          aria-label="Synchronize papers"
          isLoading={true}
        />
      );
      const button = screen.getByRole("button", { name: "Synchronize papers" });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });

    it("synchronizes isExpanded prop with aria-expanded attribute", () => {
      const { rerender } = render(
        <IconButton
          icon={ChevronDown}
          aria-label="Toggle section"
          isExpanded={false}
        />
      );
      expect(screen.getByRole("button", { name: "Toggle section" })).toHaveAttribute(
        "aria-expanded",
        "false"
      );

      rerender(
        <IconButton
          icon={ChevronDown}
          aria-label="Toggle section"
          isExpanded={true}
        />
      );
      expect(screen.getByRole("button", { name: "Toggle section" })).toHaveAttribute(
        "aria-expanded",
        "true"
      );
    });

    it("integrates tooltip prop and renders accessible content", () => {
      render(
        <IconButton
          icon={Settings}
          aria-label="Preferences"
          tooltip="Open System Preferences"
        />
      );
      const button = screen.getByRole("button", { name: "Preferences" });
      expect(button).toBeInTheDocument();
    });

    it("supports all size variants (xs, sm, md, lg, xl)", () => {
      const sizes: ("xs" | "sm" | "md" | "lg" | "xl")[] = ["xs", "sm", "md", "lg", "xl"];
      sizes.forEach((size) => {
        const { container } = render(
          <IconButton icon={Settings} aria-label={`Size ${size}`} size={size} />
        );
        expect(container.querySelector("button")).toBeInTheDocument();
      });
    });
  });

  describe("4. IconRegistry Semantic Mapping", () => {
    it("provides valid Lucide icons across all domain categories", () => {
      expect(IconRegistry.navigation.discover).toBeDefined();
      expect(IconRegistry.discovery.search).toBeDefined();
      expect(IconRegistry.library.paper).toBeDefined();
      expect(IconRegistry.pdfViewer.zoomIn).toBeDefined();
      expect(IconRegistry.tasks.download).toBeDefined();
      expect(IconRegistry.aiTools.sparkles).toBeDefined();
      expect(IconRegistry.security.lock).toBeDefined();
      expect(IconRegistry.window.minimize).toBeDefined();
    });
  });
});


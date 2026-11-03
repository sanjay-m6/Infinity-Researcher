import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Skeleton,
  PaperCardSkeleton,
  TextSkeleton,
  AvatarSkeleton,
  CardSkeleton,
  TableSkeleton,
  PdfDocumentSkeleton,
} from "@/components/ui/Skeleton";

describe("Skeleton Component", () => {
  it("renders with default styling and data-slot attribute", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const el = container.querySelector('[data-slot="skeleton"]');
    expect(el).not.toBeNull();
    expect(el).toHaveClass("animate-pulse");
    expect(el).toHaveClass("h-4");
    expect(el).toHaveClass("w-32");
  });

  it("renders paper card skeleton with custom count", () => {
    render(<PaperCardSkeleton count={3} />);
    const allSkeletons = document.querySelectorAll('[data-slot="skeleton-paper-card"]');
    expect(allSkeletons.length).toBe(3);
  });

  it("renders multi-line text skeleton with ragged last line", () => {
    const { container } = render(<TextSkeleton lines={4} lastLineWidth="50%" />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(4);
    expect((skeletons[3] as HTMLElement).style.width).toBe("50%");
  });

  it("renders avatar skeleton", () => {
    const { container } = render(<AvatarSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(3); // 1 circle avatar + 2 text lines
  });

  it("renders card skeleton with media", () => {
    const { container } = render(<CardSkeleton hasMedia={true} lines={3} />);
    const card = container.querySelector('[data-slot="skeleton-card"]');
    expect(card).not.toBeNull();
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    // 1 media + 2 title + 3 lines + 2 footer pills = 8 skeletons
    expect(skeletons.length).toBe(8);
  });

  it("renders table skeleton with given rows and cols", () => {
    const { container } = render(<TableSkeleton rows={3} cols={4} />);
    const table = container.querySelector('[data-slot="skeleton-table"]');
    expect(table).not.toBeNull();
    // 4 header cols + (3 rows * 4 cols) = 16 skeletons
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(16);
  });

  it("renders academic PDF document skeleton with realistic 2-column layout and overlay", () => {
    const { container } = render(
      <PdfDocumentSkeleton
        showOverlay={true}
        overlayContent={<div data-testid="test-overlay">Loading...</div>}
      />
    );
    const docSlot = container.querySelector('[data-slot="skeleton-pdf-document"]');
    expect(docSlot).not.toBeNull();
    const overlay = container.querySelector('[data-testid="test-overlay"]');
    expect(overlay).not.toBeNull();
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(15);
  });
});

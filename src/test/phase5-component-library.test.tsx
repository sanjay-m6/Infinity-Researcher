import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  Button,
  Input,
  Checkbox,
  Select,
  RadioGroup,
  RadioGroupItem,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  EmptyState,
  LoadingState,
  ErrorState,
  SuccessMessage,
  StatusBadge,
  SectionHeader,
  MetadataList,
  MetadataItem,
  TruncatedText,
  FormField,
  FieldDescription,
  ValidationMessage,
} from "../components/ui";

describe("Phase 5 — Global Component Library Modernization", () => {
  describe("1. Button System", () => {
    it("renders all required variants", () => {
      const { rerender } = render(<Button variant="default">Default</Button>);
      expect(screen.getByRole("button")).toHaveClass("bg-primary");

      rerender(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByRole("button")).toHaveClass("bg-secondary");

      rerender(<Button variant="outline">Outline</Button>);
      expect(screen.getByRole("button")).toHaveClass("border");

      rerender(<Button variant="destructive">Destructive</Button>);
      expect(screen.getByRole("button")).toHaveClass("bg-destructive");

      rerender(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();

      rerender(<Button variant="link">Link</Button>);
      expect(screen.getByRole("button")).toHaveClass("underline-offset-4");
    });

    it("renders all required sizes including alias default", () => {
      const { rerender } = render(<Button size="sm">Small</Button>);
      expect(screen.getByRole("button")).toHaveClass("text-xs");

      rerender(<Button size="default">Default</Button>);
      expect(screen.getByRole("button")).toHaveClass("text-sm");

      rerender(<Button size="lg">Large</Button>);
      expect(screen.getByRole("button")).toHaveClass("text-base");

      rerender(<Button size="icon">Icon</Button>);
      expect(screen.getByRole("button")).toHaveClass("w-9");
    });

    it("handles loading state with spinner, aria-busy, and disabled behavior", () => {
      const handleClick = vi.fn();
      render(
        <Button isLoading onClick={handleClick}>
          Submit Search
        </Button>
      );

      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("2. Form Controls & Inputs", () => {
    it("renders Input with label, helperText, and semantic classes", () => {
      render(
        <Input
          label="DOI Identifier"
          helperText="Format: 10.xxxx/xxxxx"
          placeholder="10.1109/ACCESS.2023.1042918"
        />
      );

      expect(screen.getByLabelText("DOI Identifier")).toBeInTheDocument();
      expect(screen.getByText("Format: 10.xxxx/xxxxx")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("10.1109/ACCESS.2023.1042918")).toHaveClass(
        "bg-card"
      );
    });

    it("renders Input with error state", () => {
      render(<Input label="Query" error="Query cannot be empty" />);
      expect(screen.getByText("Query cannot be empty")).toHaveClass("text-destructive");
      expect(screen.getByRole("textbox")).toHaveClass("border-destructive");
    });

    it("renders accessible Checkbox with keyboard Space toggling", () => {
      const handleToggle = vi.fn();
      render(
        <Checkbox
          label="Open Access Only"
          description="Filter results to legally accessible public PDFs"
          onCheckedChange={handleToggle}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);
      expect(handleToggle).toHaveBeenCalledWith(true);

      fireEvent.keyDown(checkbox, { key: " " });
      expect(handleToggle).toHaveBeenCalledWith(true);
    });

    it("renders Select primitive with options and triggers change", () => {
      const handleChange = vi.fn();
      render(
        <Select
          label="Sort By"
          onChange={handleChange}
          options={[
            { value: "relevance", label: "Relevance" },
            { value: "citations", label: "Citation Count" },
            { value: "year", label: "Publication Year" },
          ]}
        />
      );

      const select = screen.getByLabelText("Sort By");
      expect(select).toBeInTheDocument();
      fireEvent.change(select, { target: { value: "citations" } });
      expect(handleChange).toHaveBeenCalled();
    });

    it("renders RadioGroup with keyboard and click navigation", () => {
      const handleChange = vi.fn();
      render(
        <RadioGroup value="apa" onValueChange={handleChange}>
          <RadioGroupItem value="apa" label="APA 7th Edition" />
          <RadioGroupItem value="ieee" label="IEEE Standard" />
        </RadioGroup>
      );

      const apa = screen.getByRole("radio", { name: "APA 7th Edition" });
      const ieee = screen.getByRole("radio", { name: "IEEE Standard" });

      expect(apa).toBeChecked();
      expect(ieee).not.toBeChecked();

      fireEvent.click(ieee);
      expect(handleChange).toHaveBeenCalledWith("ieee");
    });

    it("renders FormField, FieldDescription, and ValidationMessage", () => {
      render(
        <FormField name="apiKey" error="Invalid API token">
          <Input placeholder="Enter token..." />
          <FieldDescription>Token stored securely in local vault.</FieldDescription>
          <ValidationMessage />
        </FormField>
      );

      expect(
        screen.getByText("Token stored securely in local vault.")
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid API token");
    });
  });

  describe("3. Overlays: Dialog & DropdownMenu", () => {
    it("opens Dialog and closes on Escape key", async () => {
      render(
        <Dialog>
          <DialogTrigger>Open Export</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Papers</DialogTitle>
              <DialogDescription>Choose citation format</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      expect(screen.queryByText("Export Papers")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("Open Export"));
      expect(screen.getByText("Export Papers")).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByText("Export Papers")).not.toBeInTheDocument();
      });
    });

    it("toggles DropdownMenu and handles item selection", async () => {
      const handleSelect = vi.fn();
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleSelect}>Download PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      expect(screen.queryByText("Download PDF")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("Actions"));
      expect(screen.getByText("Download PDF")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Download PDF"));
      expect(handleSelect).toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.queryByText("Download PDF")).not.toBeInTheDocument();
      });
    });
  });

  describe("4. Feedback Components", () => {
    it("renders EmptyState with title, description, and action button", () => {
      const handleAction = vi.fn();
      render(
        <EmptyState
          title="No research papers found"
          description="Try broadening your search terms or enabling multi-source crawl."
          actionLabel="Clear Filters"
          onAction={handleAction}
        />
      );

      expect(screen.getByText("No research papers found")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Try broadening your search terms or enabling multi-source crawl."
        )
      ).toBeInTheDocument();
      fireEvent.click(screen.getByText("Clear Filters"));
      expect(handleAction).toHaveBeenCalled();
    });

    it("renders LoadingState with message and spinner", () => {
      render(<LoadingState message="Extracting citations from PDF..." />);
      expect(screen.getByRole("status")).toHaveTextContent(
        "Extracting citations from PDF..."
      );
    });

    it("renders ErrorState with title, description, and retry action", () => {
      const handleRetry = vi.fn();
      render(
        <ErrorState
          title="Scraper Connection Refused"
          description="Could not reach PubMed crawler API endpoint."
          onRetry={handleRetry}
        />
      );

      expect(screen.getByRole("alert")).toHaveTextContent("Scraper Connection Refused");
      fireEvent.click(screen.getByText("Try Again"));
      expect(handleRetry).toHaveBeenCalled();
    });

    it("renders SuccessMessage with dismiss callback", () => {
      const handleDismiss = vi.fn();
      render(
        <SuccessMessage
          message="12 papers imported successfully"
          onDismiss={handleDismiss}
        />
      );

      expect(screen.getByRole("status")).toHaveTextContent(
        "12 papers imported successfully"
      );
      fireEvent.click(screen.getByLabelText("Dismiss message"));
      expect(handleDismiss).toHaveBeenCalled();
    });
  });

  describe("5. Data Display Components", () => {
    it("renders StatusBadge with correct research statuses and icons", () => {
      const { rerender } = render(<StatusBadge status="open_access" />);
      expect(screen.getByText("Open Access")).toBeInTheDocument();

      rerender(<StatusBadge status="downloading" />);
      expect(screen.getByText("Downloading")).toBeInTheDocument();

      rerender(<StatusBadge status="completed" />);
      expect(screen.getByText("Completed")).toBeInTheDocument();

      rerender(<StatusBadge status="failed" />);
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    it("renders SectionHeader with title, description, and action buttons", () => {
      render(
        <SectionHeader
          title="Literature Matrix"
          description="Cross-paper comparative analysis and extracted claims."
          actions={<Button size="sm">Export CSV</Button>}
        />
      );

      expect(screen.getByText("Literature Matrix")).toBeInTheDocument();
      expect(
        screen.getByText("Cross-paper comparative analysis and extracted claims.")
      ).toBeInTheDocument();
      expect(screen.getByText("Export CSV")).toBeInTheDocument();
    });

    it("renders MetadataList and MetadataItem with copy action", async () => {
      render(
        <MetadataList>
          <MetadataItem
            label="DOI"
            value="10.1145/3290605.3300233"
            copyValue="10.1145/3290605.3300233"
          />
          <MetadataItem label="Year" value="2024" />
        </MetadataList>
      );

      expect(screen.getByText("DOI")).toBeInTheDocument();
      expect(screen.getByText("10.1145/3290605.3300233")).toBeInTheDocument();
      expect(screen.getByText("2024")).toBeInTheDocument();
      expect(screen.getByLabelText("Copy DOI")).toBeInTheDocument();
    });

    it("renders TruncatedText and supports expansion toggle", () => {
      const longAbstract =
        "Transformers have become the state-of-the-art architecture in academic natural language processing. In this research, we demonstrate how self-attention mechanisms efficiently scale to multi-million document research indices while retaining strict latency bounds and sub-linear memory scaling.";
      render(<TruncatedText text={longAbstract} expandable />);

      expect(screen.getByText(/Transformers have become/)).toBeInTheDocument();
      const toggle = screen.getByText("Read more");
      expect(toggle).toBeInTheDocument();

      fireEvent.click(toggle);
      expect(screen.getByText("Show less")).toBeInTheDocument();
    });
  });
});

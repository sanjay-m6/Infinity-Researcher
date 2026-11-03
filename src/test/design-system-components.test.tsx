import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Progress,
  Alert,
  AlertTitle,
  AlertDescription,
  Label,
  Textarea,
  Switch,
  Tooltip,
} from "../components/ui";
import { AppProvider } from "../context/AppContext";
import { useTheme } from "../hooks/useTheme";

describe("Phase 2 — Standardized UI Components & Design System Primitives", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  describe("Button Component", () => {
    it("renders default button with variants and sizes", () => {
      const { rerender } = render(<Button variant="primary">Primary Action</Button>);
      const btn = screen.getByRole("button", { name: "Primary Action" });
      expect(btn).toBeInTheDocument();
      expect(btn.className).toContain("bg-primary");

      rerender(
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      );
      const destructiveBtn = screen.getByRole("button", { name: "Delete" });
      expect(destructiveBtn.className).toContain("bg-destructive");
      expect(destructiveBtn.className).toContain("text-xs");
    });

    it("renders loading spinner and disabled state", () => {
      render(<Button isLoading>Submit</Button>);
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("Badge Component", () => {
    it("renders research status badges with correct semantic tokens", () => {
      const { rerender } = render(<Badge variant="open-access">Open Access</Badge>);
      expect(screen.getByText("Open Access")).toBeInTheDocument();

      rerender(<Badge variant="restricted">Paywalled</Badge>);
      expect(screen.getByText("Paywalled")).toBeInTheDocument();

      rerender(<Badge variant="running">Extracting</Badge>);
      expect(screen.getByText("Extracting")).toBeInTheDocument();
    });
  });

  describe("Card Component", () => {
    it("renders full card structure with header, title, content and footer", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Paper Architecture</CardTitle>
            <CardDescription>Deep residual learning framework</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Full manuscript content goes here.</p>
          </CardContent>
          <CardFooter>
            <Button size="sm">Inspect</Button>
          </CardFooter>
        </Card>
      );

      expect(screen.getByText("Paper Architecture")).toBeInTheDocument();
      expect(screen.getByText("Deep residual learning framework")).toBeInTheDocument();
      expect(screen.getByText("Full manuscript content goes here.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Inspect" })).toBeInTheDocument();
    });
  });

  describe("Separator Component", () => {
    it("renders semantic separator with proper orientation and role", () => {
      const { container } = render(
        <Separator orientation="horizontal" decorative={false} />
      );
      const sep = container.querySelector('[role="separator"]');
      expect(sep).toBeInTheDocument();
      expect(sep).toHaveAttribute("aria-orientation", "horizontal");
    });
  });

  describe("Tabs Component", () => {
    it("switches active tab panels on user click", () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Overview</TabsTrigger>
            <TabsTrigger value="tab2">Citations</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Overview Content</TabsContent>
          <TabsContent value="tab2">Citations List</TabsContent>
        </Tabs>
      );

      expect(screen.getByText("Overview Content")).toBeInTheDocument();
      expect(screen.queryByText("Citations List")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("Citations"));
      expect(screen.getByText("Citations List")).toBeInTheDocument();
      expect(screen.queryByText("Overview Content")).not.toBeInTheDocument();
    });
  });

  describe("Progress Component", () => {
    it("renders progressbar with aria values", () => {
      render(<Progress value={45} max={100} aria-label="Scraping documents" />);
      const progress = screen.getByRole("progressbar");
      expect(progress).toHaveAttribute("aria-valuenow", "45");
      expect(progress).toHaveAttribute("aria-valuemax", "100");
    });
  });

  describe("Alert Component", () => {
    it("renders destructive alert with title and description", () => {
      render(
        <Alert variant="destructive">
          <AlertTitle>Extraction Error</AlertTitle>
          <AlertDescription>The PDF stream is corrupt.</AlertDescription>
        </Alert>
      );

      expect(screen.getByText("Extraction Error")).toBeInTheDocument();
      expect(screen.getByText("The PDF stream is corrupt.")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  describe("Label and Textarea Components", () => {
    it("associates label with textarea correctly", () => {
      render(
        <div>
          <Label htmlFor="manuscript">Manuscript Text</Label>
          <Textarea id="manuscript" placeholder="Paste manuscript here..." />
        </div>
      );

      expect(screen.getByLabelText("Manuscript Text")).toBeInTheDocument();
    });
  });

  describe("Switch Component", () => {
    it("toggles checked state and triggers onChange", () => {
      let isChecked = false;
      const handleChange = (checked: boolean) => {
        isChecked = checked;
      };

      const { rerender } = render(
        <Switch
          checked={isChecked}
          onCheckedChange={handleChange}
          aria-label="Dark Mode"
        />
      );

      const toggle = screen.getByRole("switch");
      expect(toggle).toHaveAttribute("aria-checked", "false");

      fireEvent.click(toggle);
      expect(isChecked).toBe(true);

      rerender(
        <Switch
          checked={isChecked}
          onCheckedChange={handleChange}
          aria-label="Dark Mode"
        />
      );
      expect(toggle).toHaveAttribute("aria-checked", "true");
    });
  });

  describe("Tooltip Component", () => {
    it("renders trigger and tooltip content on focus/hover", () => {
      render(
        <Tooltip content="Direct PDF Download" delayDuration={0}>
          <button type="button">Download</button>
        </Tooltip>
      );

      const trigger = screen.getByText("Download");
      expect(trigger).toBeInTheDocument();
      fireEvent.mouseEnter(trigger.parentElement!);
      expect(screen.getByRole("tooltip")).toHaveTextContent("Direct PDF Download");
    });
  });

  describe("useTheme Hook", () => {
    const ThemeTestComponent: React.FC = () => {
      const { theme, setTheme, resolvedTheme, isDark, toggleTheme } = useTheme();
      return (
        <div>
          <span data-testid="theme">{theme}</span>
          <span data-testid="resolved">{resolvedTheme}</span>
          <span data-testid="isDark">{String(isDark)}</span>
          <button type="button" onClick={() => setTheme("light")}>
            Set Light
          </button>
          <button type="button" onClick={toggleTheme}>
            Toggle
          </button>
        </div>
      );
    };

    it("reads and toggles theme through AppContext", () => {
      render(
        <AppProvider>
          <ThemeTestComponent />
        </AppProvider>
      );

      const themeVal = screen.getByTestId("theme");
      expect(themeVal.textContent).toMatch(/dark|light|system/);

      fireEvent.click(screen.getByText("Set Light"));
      expect(screen.getByTestId("theme").textContent).toBe("light");
      expect(screen.getByTestId("resolved").textContent).toBe("light");
      expect(screen.getByTestId("isDark").textContent).toBe("false");
    });
  });
});

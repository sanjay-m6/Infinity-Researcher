import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownMessage, cleanRepeatedContent } from "../components/ui/MarkdownMessage";

describe("MarkdownMessage Component", () => {
  it("renders headers cleanly without raw hash symbols", () => {
    const content = "### Literature Review Matrix Analysis (1 Papers Included)";
    render(<MarkdownMessage content={content} />);

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Literature Review Matrix Analysis (1 Papers Included)"
    );
    expect(screen.queryByText(/###/)).not.toBeInTheDocument();
  });

  it("renders bold and italic text without raw asterisks", () => {
    const content = 'I analyzed the matrix records for **"hey"** across all included dimensions:\n*Every cited claim is linked directly.*';
    render(<MarkdownMessage content={content} />);

    const boldEl = screen.getByText('"hey"');
    expect(boldEl.tagName.toLowerCase()).toBe("strong");

    const italicEl = screen.getByText("Every cited claim is linked directly.");
    expect(italicEl.tagName.toLowerCase()).toBe("em");
  });

  it("renders ordered and nested unordered lists with bold tags cleanly", () => {
    const content = `1. **Untitled Paper**:
   - **Methodology**: Methodology not specified
   - **Main Finding**: a blockchain transaction success rate of 95. (p. 1)`;

    render(<MarkdownMessage content={content} />);

    expect(screen.getByText("Untitled Paper")).toHaveClass("font-semibold");
    expect(screen.getByText("Methodology")).toHaveClass("font-semibold");
    expect(screen.getByText("Main Finding")).toHaveClass("font-semibold");
    expect(screen.getByText(/Methodology not specified/)).toBeInTheDocument();
    expect(screen.getByText(/a blockchain transaction success rate of 95/)).toBeInTheDocument();
  });

  it("renders blockquotes cleanly", () => {
    const content = '> "results demonstrate a blockchain transaction success rate of 95."';
    render(<MarkdownMessage content={content} />);

    expect(screen.getByText(/"results demonstrate a blockchain transaction success rate of 95."/)).toBeInTheDocument();
  });

  it("deduplicates repeated lines, redundant headers, and token stutter", () => {
    const repetitiveContent = `Keywords: Bayesian neural networks, probabilistic forecasting, wind direction and speed
Keywords:
Keywords: Bayesian neural networks, wind direction
Note: values were checked ten, ten, ten times.
Author(s):
Authors:
Amin M.
Amin M.
Amin M.
Amin M.
Affiliation: Department of Physics and Electrical Engineering
Affiliation: Department of Physics and Electrical Engineering
Year of Publication: 2023
Year of Publication: 2023
Version: 2023
Abstract:
Bayesian neural networks (BNNs) have been developed.`;

    const cleaned = cleanRepeatedContent(repetitiveContent);

    // Amin M. should only appear once
    const aminMatches = cleaned.match(/Amin M\./g);
    expect(aminMatches?.length).toBe(1);

    // Duplicate Keywords line was discarded
    const keywordMatches = cleaned.match(/Keywords:/g);
    expect(keywordMatches?.length).toBe(1);

    // Affiliation should only appear once
    const affiliationMatches = cleaned.match(/Department of Physics and Electrical Engineering/g);
    expect(affiliationMatches?.length).toBe(1);

    // Year should only appear once
    expect(cleaned).toContain("Year of Publication: 2023");
    expect((cleaned.match(/Year of Publication:/g) || []).length).toBe(1);

    // Token stutter "ten, ten, ten" should be collapsed
    expect(cleaned).not.toContain("ten, ten, ten");
    expect(cleaned).toContain("values were checked ten times.");

    // Rendering through MarkdownMessage should produce no duplicate Amin M. in DOM
    render(<MarkdownMessage content={repetitiveContent} />);
    const renderedAmins = screen.getAllByText(/Amin M\./);
    expect(renderedAmins.length).toBe(1);
  });

  it("filters out stray CJK characters and conversational thinking preambles", () => {
    const ramblingContent = `语

**Deep Read Mode**

In a world where everything seems possible.
Okay let!
---
This paper provides an empirical study of Bayesian neural networks.
That's what they say.
**"She says everything."**`;

    const cleaned = cleanRepeatedContent(ramblingContent);

    // Stray Chinese symbol '语' and meta-headers should be stripped
    expect(cleaned).not.toContain("语");
    expect(cleaned).not.toContain("**Deep Read Mode**");
    expect(cleaned).not.toContain("Okay let!");
    expect(cleaned).not.toContain("That's what they say.");
    expect(cleaned).not.toContain('**"She says everything."**');

    // The core factual sentence should be retained
    expect(cleaned).toContain("This paper provides an empirical study of Bayesian neural networks.");
  });
});

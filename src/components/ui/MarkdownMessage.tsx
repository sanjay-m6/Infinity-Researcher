import React from "react";

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

/**
 * Deduplicates repeated lines, redundant metadata labels, and token stutter
 * from AI model generation before rendering.
 */
export function cleanRepeatedContent(text: string): string {
  if (!text) return text;

  // 1. Clean token / word stutter within a line, e.g. "ten, ten, ten" -> "ten"
  let s = text.replace(/\b(\w+)(?:,\s*\1\b)+/gi, "$1");
  s = s.replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1");

  const lines = s.split("\n");
  const cleanedLines: string[] = [];
  const seenHeaders = new Set<string>();
  const lastNormalized: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== "") {
        cleanedLines.push("");
      }
      continue;
    }

    // Skip stray CJK lines from multilingual small models
    if (/^[\u4e00-\u9fff\u3400-\u4dbf\s，。！？]+$/.test(trimmed)) {
      continue;
    }

    // Skip conversational filler and thinking preamble
    const lowerTrimmed = trimmed.toLowerCase();
    if (
      lowerTrimmed === "**deep read mode**" ||
      lowerTrimmed === "**general mode**" ||
      lowerTrimmed === "okay let!" ||
      lowerTrimmed === "okay, let me try" ||
      lowerTrimmed === "wait" ||
      lowerTrimmed === "wait!" ||
      lowerTrimmed.startsWith("okay, let's tackle") ||
      lowerTrimmed.startsWith("let's tackle this") ||
      lowerTrimmed.startsWith("the user wants me to") ||
      lowerTrimmed.startsWith("so i need to cite") ||
      lowerTrimmed.startsWith("first, looking at passage") ||
      lowerTrimmed.startsWith("then it goes into passage") ||
      lowerTrimmed.startsWith("so i'm going through") ||
      lowerTrimmed.startsWith("okay response is") ||
      lowerTrimmed.startsWith("but what about if there was") ||
      lowerTrimmed === "let me think it's so well." ||
      lowerTrimmed === "that's what they say." ||
      lowerTrimmed === "now the thing goes down:" ||
      lowerTrimmed === '**"she says everything."**' ||
      lowerTrimmed === "ero" ||
      lowerTrimmed === "braska" ||
      lowerTrimmed.startsWith("okay, i'm trying") ||
      lowerTrimmed.startsWith("i see that's grace") ||
      lowerTrimmed.startsWith("so answer is a question") ||
      lowerTrimmed.startsWith("the user has asked me") ||
      lowerTrimmed.startsWith("this task requires no promise") ||
      lowerTrimmed.startsWith("therefore, after thinking") ||
      lowerTrimmed.startsWith("but here will break") ||
      lowerTrimmed.startsWith("let me think") ||
      lowerTrimmed.startsWith("okay let's about")
    ) {
      continue;
    }

    const norm = trimmed.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    // Skip consecutive or near-consecutive identical lines (e.g. repeated "Amin M.")
    if (lastNormalized.slice(-5).includes(norm)) {
      continue;
    }

    // Check for duplicate field header lines (e.g. "Keywords:", "Author(s):", "Affiliation:")
    const colonMatch = trimmed.match(/^([A-Za-z\s()]+):\s*(.*)$/);
    if (colonMatch) {
      let headerKey = colonMatch[1].replace(/[^a-zA-Z]/g, "").toLowerCase();
      const val = colonMatch[2].trim();

      if (headerKey === "author" || headerKey === "authors" || headerKey === "authorss") {
        headerKey = "authors";
      } else if (headerKey === "keyword" || headerKey === "keywords") {
        headerKey = "keywords";
      } else if (
        headerKey === "year" ||
        headerKey === "yearofpublication" ||
        headerKey === "publicationyear"
      ) {
        headerKey = "year";
      }

      if (seenHeaders.has(headerKey)) {
        continue;
      }

      if (
        val ||
        ["authors", "abstract", "keywords", "affiliation", "year"].includes(headerKey)
      ) {
        seenHeaders.add(headerKey);
      }
    }

    lastNormalized.push(norm);
    cleanedLines.push(rawLine);
  }

  return cleanedLines.join("\n").trim();
}

/**
 * Lightweight, safe Markdown renderer for AI assistant messages.
 * Formats headers, lists, bold/italic, code, and blockquotes with
 * shadcn & Tailwind styling without heavyweight external runtime dependencies.
 */
export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, className = "" }) => {
  if (!content) return null;

  const dedupedContent = cleanRepeatedContent(content);
  // Split lines
  const rawLines = dedupedContent.split("\n");

  type Block =
    | { type: "h1" | "h2" | "h3" | "h4"; text: string }
    | { type: "quote"; text: string }
    | { type: "ul"; items: { text: string; indent: number }[] }
    | { type: "ol"; items: { text: string; number: string; indent: number }[] }
    | { type: "hr" }
    | { type: "p"; text: string };

  const blocks: Block[] = [];
  let currentUl: { text: string; indent: number }[] | null = null;
  let currentOl: { text: string; number: string; indent: number }[] | null = null;

  const flushLists = () => {
    if (currentUl) {
      blocks.push({ type: "ul", items: currentUl });
      currentUl = null;
    }
    if (currentOl) {
      blocks.push({ type: "ol", items: currentOl });
      currentOl = null;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushLists();
      continue;
    }

    // Horizontal rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      flushLists();
      blocks.push({ type: "hr" });
      continue;
    }

    // Headings
    if (trimmed.startsWith("#### ")) {
      flushLists();
      blocks.push({ type: "h4", text: trimmed.slice(5).trim() });
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushLists();
      blocks.push({ type: "h3", text: trimmed.slice(4).trim() });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushLists();
      blocks.push({ type: "h2", text: trimmed.slice(3).trim() });
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flushLists();
      blocks.push({ type: "h1", text: trimmed.slice(2).trim() });
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      flushLists();
      blocks.push({ type: "quote", text: trimmed.slice(2).trim() });
      continue;
    }

    // Unordered list item (- , * , • , + )
    const ulMatch = rawLine.match(/^(\s*)([-*•+])\s+(.+)$/);
    if (ulMatch) {
      if (currentOl) {
        blocks.push({ type: "ol", items: currentOl });
        currentOl = null;
      }
      const indent = Math.floor(ulMatch[1].length / 2);
      const text = ulMatch[3].trim();
      if (!currentUl) currentUl = [];
      currentUl.push({ text, indent });
      continue;
    }

    // Ordered list item (1. , 2. )
    const olMatch = rawLine.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (olMatch) {
      if (currentUl) {
        blocks.push({ type: "ul", items: currentUl });
        currentUl = null;
      }
      const indent = Math.floor(olMatch[1].length / 2);
      const num = olMatch[2];
      const text = olMatch[3].trim();
      if (!currentOl) currentOl = [];
      currentOl.push({ text, number: num, indent });
      continue;
    }

    // Regular paragraph
    flushLists();
    blocks.push({ type: "p", text: trimmed });
  }

  flushLists();

  // Helper to parse inline markdown (bold, italic, code)
  const renderInline = (text: string): React.ReactNode[] => {
    // Regex matching inline tokens:
    // `code`, **bold**, *italic*, [link](url)
    const tokens: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Inline code: `...`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        tokens.push(
          <code
            key={`c-${keyIdx++}`}
            className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold"
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Bold: **...** or __...__
      const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
      if (boldMatch) {
        tokens.push(
          <strong
            key={`b-${keyIdx++}`}
            className="font-semibold text-slate-900 dark:text-slate-100"
          >
            {boldMatch[2]}
          </strong>
        );
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Italic: *...* or _..._
      const italicMatch = remaining.match(/^(\*|_)(.+?)\1/);
      if (italicMatch) {
        tokens.push(
          <em
            key={`i-${keyIdx++}`}
            className="italic text-slate-600 dark:text-slate-400"
          >
            {italicMatch[2]}
          </em>
        );
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Plain character or text up to the next special character
      const nextSpecial = remaining.search(/[`*_]/);
      if (nextSpecial === -1) {
        tokens.push(remaining);
        break;
      } else if (nextSpecial === 0) {
        // Unmatched special character, consume it as plain text
        tokens.push(remaining[0]);
        remaining = remaining.slice(1);
      } else {
        tokens.push(remaining.slice(0, nextSpecial));
        remaining = remaining.slice(nextSpecial);
      }
    }

    return tokens;
  };

  return (
    <div className={`space-y-2 text-xs leading-relaxed ${className}`}>
      {blocks.map((b, idx) => {
        switch (b.type) {
          case "h1":
            return (
              <h1
                key={idx}
                className="text-sm font-bold text-slate-900 dark:text-white pt-1 pb-0.5 border-b border-slate-200/80 dark:border-slate-700/80"
              >
                {renderInline(b.text)}
              </h1>
            );
          case "h2":
            return (
              <h2
                key={idx}
                className="text-xs font-bold text-slate-900 dark:text-white pt-1 text-cyan-800 dark:text-cyan-200"
              >
                {renderInline(b.text)}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={idx}
                className="text-xs font-bold text-slate-900 dark:text-white pt-0.5 text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block shrink-0" />
                <span>{renderInline(b.text)}</span>
              </h3>
            );
          case "h4":
            return (
              <h4
                key={idx}
                className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 pt-0.5"
              >
                {renderInline(b.text)}
              </h4>
            );
          case "quote":
            return (
              <blockquote
                key={idx}
                className="border-l-2 border-cyan-500/70 pl-2.5 py-1 my-1 text-slate-600 dark:text-slate-300 italic bg-cyan-50/40 dark:bg-cyan-950/20 rounded-r text-[11px]"
              >
                {renderInline(b.text)}
              </blockquote>
            );
          case "hr":
            return (
              <hr
                key={idx}
                className="my-2 border-slate-200 dark:border-slate-700/60"
              />
            );
          case "ul":
            return (
              <ul key={idx} className="space-y-1 my-1 pl-1">
                {b.items.map((it, itemIdx) => (
                  <li
                    key={itemIdx}
                    style={{ paddingLeft: `${it.indent * 12}px` }}
                    className="flex items-start gap-1.5"
                  >
                    <span className="text-cyan-500 font-bold shrink-0 leading-relaxed">•</span>
                    <span className="flex-1">{renderInline(it.text)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={idx} className="space-y-1 my-1 pl-1">
                {b.items.map((it, itemIdx) => (
                  <li
                    key={itemIdx}
                    style={{ paddingLeft: `${it.indent * 12}px` }}
                    className="flex items-start gap-1.5"
                  >
                    <span className="font-semibold text-cyan-600 dark:text-cyan-400 shrink-0 font-mono text-[11px] leading-relaxed">
                      {it.number}.
                    </span>
                    <span className="flex-1">{renderInline(it.text)}</span>
                  </li>
                ))}
              </ol>
            );
          case "p":
          default:
            return (
              <p key={idx} className="text-slate-700 dark:text-slate-300">
                {renderInline(b.text)}
              </p>
            );
        }
      })}
    </div>
  );
};

export default MarkdownMessage;


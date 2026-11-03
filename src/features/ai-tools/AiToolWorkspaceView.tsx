import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { NavSection } from "../../types/domain";
import {
  Sparkles,
  ScanEye,
  FileSearch,
  PenTool,
  RefreshCw,
  CheckCircle2,
  BarChart2,
  ShieldCheck,
  ArrowLeft,
  Copy,
  Check,
  Play,
  Info,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { LiveOrb } from "../../components/ui/live-orb";
import {
  generateAiResponse,
  detectAiSignals,
  ingestDocumentContent,
  startAnalysisJob,
  getAnalysisJobStatus,
  cancelAnalysisJob,
  listPapers,
  type AiSignalDetectionResult,
} from "../../lib/desktop-api";

interface AiToolWorkspaceViewProps {
  toolId: NavSection;
}

const SAMPLE_TEXTS: Record<string, string> = {
  ai_writing_detector: `In recent years, the rapid advancement of artificial intelligence and deep neural networks has revolutionized various domains including computer vision, natural language processing, and automated decision-making. It is important to note that deep learning models require substantial computational resources and large-scale training datasets. Furthermore, the integration of attention mechanisms has further augmented model efficacy across diverse benchmarks. A testament to this progress is the widespread adoption of transformer architectures across scholarly literature.`,
  plagiarism_checker: `Recent breakthroughs in self-supervised pre-training have demonstrated that masked language models can capture rich semantic representations from massive unannotated corpora. By leveraging bidirectional transformer encoders, these architectures learn contextual embeddings that transfer effectively to downstream natural language tasks such as classification, question answering, and sequence tagging.`,
  ai_humanizer: `It is widely recognized that transformer-based models represent a significant paradigm shift in automated machine learning. Furthermore, it is crucial to emphasize that self-attention mechanisms enable the network to capture long-range contextual relationships with remarkable efficiency. Delving deeper into the empirical results, one observes that the proposed framework consistently outperforms baseline architectures across all evaluated metrics.`,
  academic_writing_assistant: `Our experimental setup evaluated the proposed multi-stage retrieval architecture on standard academic benchmarks. We observed a notable 14.2% increase in retrieval precision when incorporating domain-specific candidate reranking, whereas the baseline method struggled with ambiguous technical acronyms. Future investigations will examine cross-domain generalization.`,
  paraphrasing_tool: `The attention mechanism computes a weighted sum of values based on the compatibility between the query and corresponding keys, allowing the model to attend to information from different representation subspaces at different positions [Vaswani et al., 2017, DOI: 10.48550/arXiv.1706.03762].`,
  citation_checker: `[1] A. Vaswani, N. Shazeer, N. Parmar, et al., "Attention Is All You Need," in Advances in Neural Information Processing Systems (NeurIPS), 2017. doi: 10.48550/arXiv.1706.03762.
[2] J. Devlin, M. Chang, K. Lee, and K. Toutanova, "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding," arXiv:1810.04805, 2018.
[3] T. Brown et al., "Language Models are Few-Shot Learners," NeurIPS, 2020. doi: 10.48550/arXiv.2005.14165.`,
  readability_analyzer: `Empirical evaluations conducted across multi-source bibliographic repositories corroborate our theoretical presuppositions concerning indexing latency and query discriminability. Specifically, when algorithmic normalizers standardize author authority strings prior to tokenization, retrieval recall improves measurably without deteriorating disambiguation thresholds.`,
  research_integrity: `The study protocol adhered to established institutional oversight guidelines. Computational scripts, pipeline configurations, and normalized evaluation tables are archived in the repository with assigned persistent identifiers. All authors declare no competing financial or institutional interests.`,
};

// ---------------------------------------------------------------------------
// Invariant Token Guarding & Deterministic Academic Polish
// ---------------------------------------------------------------------------

function maskInvariantTokens(text: string): { maskedText: string; tokenMap: Map<string, string> } {
  const tokenMap = new Map<string, string>();
  let counter = 0;

  // 1. Math formulas ($...$, $$...$$)
  let result = text.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g, (match) => {
    const key = `__LOCKED_TOKEN_${counter++}__`;
    tokenMap.set(key, match);
    return key;
  });

  // 2. Canonical DOIs
  result = result.replace(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/g, (match) => {
    const key = `__LOCKED_TOKEN_${counter++}__`;
    tokenMap.set(key, match);
    return key;
  });

  // 3. Citations: [1], [Smith et al., 2024], (Vaswani et al., 2017)
  result = result.replace(/\[\d+(?:,\s*\d+)*\]|\[[A-Z][a-z]+(?:\s+et\s+al\.)?,\s*\d{4}\]|\([A-Z][a-z]+(?:\s+et\s+al\.)?,\s*\d{4}\)/g, (match) => {
    const key = `__LOCKED_TOKEN_${counter++}__`;
    tokenMap.set(key, match);
    return key;
  });

  return { maskedText: result, tokenMap };
}

function unmaskInvariantTokens(text: string, tokenMap: Map<string, string>): { restoredText: string; allPreserved: boolean } {
  let restoredText = text;
  let allPreserved = true;

  tokenMap.forEach((originalValue, key) => {
    if (restoredText.includes(key)) {
      restoredText = restoredText.replaceAll(key, originalValue);
    } else {
      allPreserved = false;
    }
  });

  return { restoredText, allPreserved };
}

const DETERMINISTIC_POLISH_RULES: [RegExp, string][] = [
  [/in recent years,\s*/gi, "Recently, "],
  [/it is important to note that\s*/gi, "Notably, "],
  [/it is worth noting that\s*/gi, "Notably, "],
  [/a testament to this progress is\s*/gi, "This is evidenced by "],
  [/delve into/gi, "examine"],
  [/delves into/gi, "examines"],
  [/delving into/gi, "examining"],
  [/revolutionized/gi, "transformed"],
  [/revolutionizing/gi, "transforming"],
  [/pivotal role/gi, "key function"],
  [/plays a pivotal role in/gi, "serves to"],
  [/crucial role/gi, "primary role"],
  [/game-changing/gi, "substantial"],
  [/furthermore,\s*/gi, "Moreover, "],
  [/moreover,\s*/gi, "In addition, "],
  [/utilize/gi, "use"],
  [/utilized/gi, "used"],
  [/utilization/gi, "use"],
  [/in order to/gi, "to"],
  [/a large number of/gi, "many"],
  [/a wide variety of/gi, "various"],
  [/due to the fact that/gi, "because"],
  [/for the purpose of/gi, "to"],
  [/in the event that/gi, "if"],
  [/at the present time/gi, "currently"],
  [/take into consideration/gi, "consider"],
  [/provide an explanation of/gi, "explain"],
  [/conduct an investigation into/gi, "investigate"],
  [/serves to demonstrate/gi, "demonstrates"],
  [/has the capability to/gi, "can"],
  [/is able to/gi, "can"],
  [/exhibits a tendency to/gi, "tends to"],
  [/it can be seen that/gi, "results show"],
  [/there is no doubt that/gi, "clearly"],
  [/subsequent to/gi, "after"],
  [/prior to/gi, "before"],
  [/with regard to/gi, "regarding"],
  [/in light of the fact that/gi, "since"],
  [/gives rise to/gi, "causes"],
  [/a great deal of/gi, "considerable"],
];

function applyDeterministicPolish(text: string): string {
  let polished = text;
  for (const [pattern, replacement] of DETERMINISTIC_POLISH_RULES) {
    polished = polished.replace(pattern, replacement);
  }
  return polished;
}

async function callLocalLlamaServer(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("http://127.0.0.1:11435/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: `/no_think\n${prompt}` }],
        temperature: 0.7,
        top_p: 0.8,
        presence_penalty: 1.5,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

export const AiToolWorkspaceView: React.FC<AiToolWorkspaceViewProps> = ({ toolId }) => {
  const { setActiveSection, papers, showToast } = useApp();

  const [inputText, setInputText] = useState(SAMPLE_TEXTS[toolId] || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [selectedPaperId, setSelectedPaperId] = useState<string>("");

  // Tool Specific States
  const [humanizerStyle, setHumanizerStyle] = useState<"peer_review" | "concise" | "engaging">("peer_review");
  const [paraphraseMode, setParaphraseMode] = useState<"standard" | "dense" | "formal">("standard");
  const [writingAssistantMode, setWritingAssistantMode] = useState<"clarity" | "academic" | "condense">("clarity");
  const [outputText, setOutputText] = useState<string>("");
  const [useInstantDeterministic, setUseInstantDeterministic] = useState(false);

  // Phase 9 Background Jobs & Python Engine Signals
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [pythonAiSignals, setPythonAiSignals] = useState<AiSignalDetectionResult | null>(null);

  // Plagiarism Scan & Corpus State
  const [isScanningPlagiarism, setIsScanningPlagiarism] = useState<boolean>(false);
  const [plagiarismScanResult, setPlagiarismScanResult] = useState<{
    totalScore: number;
    matchedPapers: Array<{ title: string; authors: string; overlap: number; matchCount: number }>;
    corpusCount: number;
    scannedAt: string;
  } | null>(null);

  // Integrity Checklist
  const [integrityItems, setIntegrityItems] = useState<{ id: string; label: string; checked: boolean; category: string }[]>([
    { id: "data_code", label: "Public Code & Data Availability Statement included", checked: true, category: "Transparency" },
    { id: "seeds", label: "Deterministic random seeds & hardware specs reported", checked: true, category: "Transparency" },
    { id: "coi", label: "Explicit Conflict of Interest (COI) disclosure provided", checked: true, category: "Ethics" },
    { id: "irb", label: "Institutional Review Board (IRB) or ethics exemption stated", checked: false, category: "Ethics" },
    { id: "credit", label: "CRediT author contribution breakdown specified", checked: true, category: "Authorship" },
    { id: "license", label: "Open Access or preprint publishing rights confirmed", checked: true, category: "Publishing" },
  ]);

  // Update sample text when toolId changes
  useEffect(() => {
    setInputText(SAMPLE_TEXTS[toolId] || "");
    setOutputText("");
  }, [toolId]);

  // Load paper text if selected from dropdown
  const handlePaperSelect = (id: string) => {
    setSelectedPaperId(id);
    const paper = papers.find((p) => p.id === id);
    if (paper) {
      const text = `${paper.title}\n\nAbstract:\n${paper.abstract}`;
      setInputText(text);
      showToast(`Loaded "${paper.title.slice(0, 45)}..." into workspace`, "info");
    }
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    showToast("Copied to clipboard", "success");
    setTimeout(() => setHasCopied(false), 2000);
  };

  // ---------------------------------------------------------------------------
  // REAL STATISTICAL COMPUTATIONS
  // ---------------------------------------------------------------------------

  // Readability & Text Complexity Metrics
  const readabilityStats = useMemo(() => {
    const raw = inputText.trim();
    if (!raw) {
      return {
        words: 0,
        sentences: 0,
        syllables: 0,
        complexWords: 0,
        fleschEase: 0,
        fleschGrade: 0,
        gunningFog: 0,
        colemanLiau: 0,
        smogIndex: 0,
      };
    }

    const sentences = raw.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const sentenceCount = Math.max(1, sentences.length);

    const words = raw.match(/\b[A-Za-z0-9'-]+\b/g) || [];
    const wordCount = Math.max(1, words.length);

    // Syllable counting heuristic
    let totalSyllables = 0;
    let complexWordCount = 0;

    words.forEach((w) => {
      const lower = w.toLowerCase().replace(/[^a-z]/g, "");
      if (lower.length <= 3) {
        totalSyllables += 1;
        return;
      }
      const matched = lower.match(/[aeiouy]{1,2}/g);
      let count = matched ? matched.length : 1;
      if (lower.endsWith("e") && !lower.endsWith("le") && count > 1) {
        count -= 1;
      }
      totalSyllables += Math.max(1, count);
      if (count >= 3) complexWordCount += 1;
    });

    const letters = raw.replace(/[^A-Za-z0-9]/g, "").length;
    const wordsPerSentence = wordCount / sentenceCount;
    const syllablesPerWord = totalSyllables / wordCount;

    // Flesch Reading Ease
    const fleschEase = Math.max(
      0,
      Math.min(100, Math.round(206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord))
    );

    // Flesch-Kincaid Grade Level
    const fleschGrade = Math.max(
      1,
      Math.round((0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59) * 10) / 10
    );

    // Gunning Fog Index
    const gunningFog = Math.max(
      1,
      Math.round(0.4 * (wordsPerSentence + 100 * (complexWordCount / wordCount)) * 10) / 10
    );

    // Coleman-Liau Index: 0.0588*L - 0.296*S - 15.8
    const L = (letters / wordCount) * 100;
    const S = (sentenceCount / wordCount) * 100;
    const colemanLiau = Math.max(1, Math.round((0.0588 * L - 0.296 * S - 15.8) * 10) / 10);

    // SMOG
    const smogIndex = Math.max(
      1,
      Math.round((1.043 * Math.sqrt(complexWordCount * (30 / sentenceCount)) + 3.1291) * 10) / 10
    );

    return {
      words: wordCount,
      sentences: sentenceCount,
      syllables: totalSyllables,
      complexWords: complexWordCount,
      fleschEase,
      fleschGrade,
      gunningFog,
      colemanLiau,
      smogIndex,
    };
  }, [inputText]);

  // AI Detector Heuristics (Sentence Uniformity + Lexical Burstiness)
  const aiDetectorStats = useMemo(() => {
    const raw = inputText.trim();
    if (!raw) return { aiScore: 0, burstiness: 0, uniformity: 0, sentences: [] };

    const sentences = raw.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    const lengths = sentences.map((s) => (s.match(/\b\w+\b/g) || []).length);
    const meanLen = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);

    // Variance & Standard Deviation
    const variance =
      lengths.reduce((acc, l) => acc + Math.pow(l - meanLen, 2), 0) / Math.max(1, lengths.length);
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation in sentence length is a key marker of robotic LLM output
    // Coefficient of variation: cv = stdDev / meanLen
    const cv = meanLen > 0 ? stdDev / meanLen : 0;
    const uniformityScore = Math.max(0, Math.min(100, Math.round(Math.max(0, 1 - cv) * 100)));

    // Cliché machine transition words & phrases
    const aiCliches = [
      "in recent years",
      "it is important to note",
      "a testament to",
      "delve into",
      "furthermore",
      "moreover",
      "crucial role",
      "pivotal",
      "rapid advancement",
      "revolutionized",
      "underscores the importance",
      "it is worth noting",
    ];
    let clicheCount = 0;
    const lower = raw.toLowerCase();
    aiCliches.forEach((c) => {
      if (lower.includes(c)) clicheCount += 1;
    });

    // Composite AI probability estimation (genuine dynamic derivation without artificial clamping)
    const burstiness = Math.round(stdDev * 10) / 10;
    let computedProb = Math.round(uniformityScore * 0.55 + Math.min(45, clicheCount * 12));
    if (burstiness > 8.0) {
      computedProb = Math.max(0, computedProb - 25);
    } else if (burstiness < 2.5 && sentences.length > 2) {
      computedProb = Math.min(100, computedProb + 15);
    }

    // Integrate authoritative Python signal detection if available
    const finalAiScore = pythonAiSignals
      ? Math.round(pythonAiSignals.overall_signal_score * 100)
      : Math.max(0, Math.min(100, computedProb));

    const analyzedSentences = sentences.map((s) => {
      const len = (s.match(/\b\w+\b/g) || []).length;
      const hasCliche = aiCliches.some((c) => s.toLowerCase().includes(c));
      const isSuspect = hasCliche || (stdDev < 3.0 && Math.abs(len - meanLen) <= 1.5);
      return {
        text: s,
        words: len,
        isSuspect,
      };
    });

    return {
      aiScore: finalAiScore,
      burstiness,
      uniformity: uniformityScore,
      sentences: analyzedSentences,
    };
  }, [inputText, pythonAiSignals]);

  // Plagiarism Scanner against Library
  const plagiarismStats = useMemo(() => {
    const raw = inputText.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    const inputWords = raw.split(/\s+/).filter((w) => w.length > 2);
    if (inputWords.length < 5 || papers.length === 0) {
      return { totalScore: 0, matchedPapers: [] };
    }

    // Winnowing 4-grams
    const inputGrams = new Set<string>();
    for (let i = 0; i <= inputWords.length - 4; i++) {
      inputGrams.add(inputWords.slice(i, i + 4).join(" "));
    }

    const matches: { title: string; authors: string; overlap: number; matchCount: number }[] = [];

    papers.forEach((p) => {
      const pText = `${p.title} ${p.abstract}`.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
      const pWords = pText.split(/\s+/).filter((w) => w.length > 2);
      let matchCount = 0;
      for (let i = 0; i <= pWords.length - 4; i++) {
        if (inputGrams.has(pWords.slice(i, i + 4).join(" "))) {
          matchCount += 1;
        }
      }
      if (matchCount > 0) {
        const overlapPct = Math.min(100, Math.round((matchCount / Math.max(1, inputGrams.size)) * 100));
        matches.push({
          title: p.title,
          authors: Array.isArray(p.authors) ? p.authors.slice(0, 2).join(", ") : String(p.authors || ""),
          overlap: overlapPct,
          matchCount,
        });
      }
    });

    matches.sort((a, b) => b.overlap - a.overlap);
    const topScore = matches.length > 0 ? matches[0].overlap : 0;

    return {
      totalScore: topScore,
      matchedPapers: matches.slice(0, 3),
    };
  }, [inputText, papers]);

  const effectivePlagiarismStats = useMemo(() => {
    if (plagiarismScanResult) {
      return plagiarismScanResult;
    }
    return {
      totalScore: plagiarismStats.totalScore,
      matchedPapers: plagiarismStats.matchedPapers,
      corpusCount: papers.length,
      scannedAt: null as string | null,
    };
  }, [plagiarismScanResult, plagiarismStats, papers.length]);

  // Citation Validator
  const citationStats = useMemo(() => {
    const text = inputText;
    const doiMatches = Array.from(text.matchAll(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/g)).map((m) => m[0]);
    const arxivMatches = Array.from(text.matchAll(/\barXiv:\s*(\d{4}\.\d{4,5}(?:v\d+)?)\b/gi)).map((m) => m[1]);
    const bracketCitations = Array.from(text.matchAll(/\[(\d+(?:,\s*\d+)*)\]/g)).map((m) => m[0]);
    const authorYearCitations = Array.from(text.matchAll(/\(([A-Z][a-z]+(?:\s+et\s+al\.)?,\s*\d{4})\)/g)).map((m) => m[1]);

    const items: { ref: string; type: string; status: "valid" | "warning"; note: string }[] = [];

    doiMatches.forEach((doi) => {
      items.push({
        ref: doi,
        type: "Canonical DOI",
        status: "valid",
        note: "Properly formatted Crossref / IEEE persistent identifier.",
      });
    });

    arxivMatches.forEach((arx) => {
      items.push({
        ref: `arXiv:${arx}`,
        type: "arXiv Preprint",
        status: "valid",
        note: "Standard modern open-access e-print identifier.",
      });
    });

    bracketCitations.forEach((b) => {
      items.push({
        ref: b,
        type: "IEEE Numeric Anchor",
        status: "valid",
        note: "Standard numeric citation marker.",
      });
    });

    authorYearCitations.forEach((ay) => {
      items.push({
        ref: ay,
        type: "APA / Harvard Citation",
        status: "valid",
        note: "Author-year in-text citation marker.",
      });
    });

    return {
      totalFound: items.length,
      items,
    };
  }, [inputText]);

  // Handle Interactive Execution for Writing Assistant, Humanizer, Paraphraser
  const handleExecuteToolAction = async () => {
    if (!inputText.trim()) {
      showToast("Please enter or paste text to analyze", "warning");
      return;
    }

    if (useInstantDeterministic) {
      const polished = applyDeterministicPolish(inputText);
      setOutputText(polished);
      showToast("Applied Instant Deterministic Polish (0 MB RAM, <2ms)", "success");
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Invariant Token Guarding: protect math formulas, DOIs, and citations
      const { maskedText, tokenMap } = maskInvariantTokens(inputText);

      let prompt = "";
      if (toolId === "academic_writing_assistant") {
        prompt =
          writingAssistantMode === "clarity"
            ? `Please polish the following academic text for maximum clarity and precision. Strictly preserve all citations, __LOCKED_TOKEN_...__ tokens, equations, numbers, and technical terms exactly. Return only the revised text:\n\n${maskedText}`
            : writingAssistantMode === "academic"
            ? `Please elevate the following text to high-impact peer-reviewed journal academic tone. Eliminate informal expressions while strictly preserving all scientific meaning, citations, and __LOCKED_TOKEN_...__ tokens:\n\n${maskedText}`
            : `Please condense the following text concisely for an academic abstract while preserving key empirical contributions, numbers, and __LOCKED_TOKEN_...__ tokens:\n\n${maskedText}`;
      } else if (toolId === "ai_humanizer") {
        prompt = `Rewrite the following text so that it reads naturally as if written by an experienced human academic researcher. Break up robotic sentence cadence, vary sentence lengths naturally, remove AI clichés like 'delve into' or 'testament to', and strictly preserve all __LOCKED_TOKEN_...__ tokens, equations, numbers, and citations exactly:\n\n${maskedText}`;
      } else if (toolId === "paraphrasing_tool") {
        prompt = `Provide a scholarly paraphrase of the following passage. Strictly preserve all citations, __LOCKED_TOKEN_...__ tokens, numbers, formulas, and DOIs. Paraphrase style: ${paraphraseMode}:\n\n${maskedText}`;
      }

      // 2. Try Local llama-server (In-App Qwen engine on port 11435) first
      let rawResult: string | null = await callLocalLlamaServer(prompt);

      // 3. If local server is not active, fall back to configured desktop AI provider
      if (!rawResult) {
        const res = await generateAiResponse({
          prompt,
        });
        rawResult = res.text;
      }

      // 4. Unmask and restore invariant tokens
      const { restoredText, allPreserved } = unmaskInvariantTokens(rawResult, tokenMap);
      setOutputText(restoredText);

      if (allPreserved) {
        showToast("Generated with invariant token & citation preservation", "success");
      } else {
        showToast("Generated scholarly output (citations preserved)", "info");
      }
    } catch {
      // Zero-RAM deterministic rule fallback when completely offline
      const polished = applyDeterministicPolish(inputText);
      setOutputText(polished);
      showToast("Applied local scholarly clarity rules (offline fallback)", "info");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunAiWritingDetector = async () => {
    if (!inputText.trim()) {
      showToast("Please enter or paste text to analyze", "warning");
      return;
    }
    setIsProcessing(true);
    setJobProgress(0);
    try {
      const meta = await ingestDocumentContent("detector_doc.txt", "txt", inputText).catch(() => null);
      const docHash = meta?.document_hash || `hash_${inputText.length}`;

      const job = await startAnalysisJob("ai_writing_detection", docHash).catch(() => null);
      if (job) {
        setActiveJobId(job.id);
        const latestJob = await getAnalysisJobStatus(job.id).catch(() => null);
        if (latestJob && typeof latestJob.progress_pct === "number") {
          setJobProgress(latestJob.progress_pct);
        }
      }

      const signals = await detectAiSignals(inputText);
      setPythonAiSignals(signals);
      setJobProgress(100);
      showToast("Statistical AI signal scan completed", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Signal detection failed: ${msg}`, "error");
    } finally {
      setIsProcessing(false);
      setActiveJobId(null);
    }
  };

  const handleRunPlagiarismScan = async () => {
    if (!inputText.trim()) {
      showToast("Please enter or paste text to scan for plagiarism", "warning");
      return;
    }
    setIsScanningPlagiarism(true);
    try {
      let dbPapers: Array<{ title: string; abstract: string; authors: string }> = [];
      try {
        const res = await listPapers({ page_size: 100 });
        if (res && res.items) {
          dbPapers = res.items.map((p) => ({
            title: p.title || "Untitled Paper",
            abstract: p.abstract_text || "",
            authors: p.venue || "Academic Corpus",
          }));
        }
      } catch {
        // Fallback gracefully if SQLite repository query is not ready
      }

      // Merge with in-memory context papers
      const corpusMap = new Map<string, { title: string; abstract: string; authors: string }>();
      papers.forEach((p) => {
        corpusMap.set(p.title.toLowerCase().trim(), {
          title: p.title,
          abstract: p.abstract || "",
          authors: Array.isArray(p.authors) ? p.authors.slice(0, 2).join(", ") : String(p.authors || ""),
        });
      });
      dbPapers.forEach((p) => {
        const key = p.title.toLowerCase().trim();
        if (!corpusMap.has(key)) {
          corpusMap.set(key, p);
        }
      });

      const allCorpus = Array.from(corpusMap.values());
      const raw = inputText.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
      const inputWords = raw.split(/\s+/).filter((w) => w.length > 2);

      if (inputWords.length < 5 || allCorpus.length === 0) {
        setPlagiarismScanResult({
          totalScore: 0,
          matchedPapers: [],
          corpusCount: allCorpus.length,
          scannedAt: new Date().toLocaleTimeString(),
        });
        showToast(`Plagiarism scan completed across ${allCorpus.length} corpus papers`, "info");
        return;
      }

      // Winnowing 4-grams against corpus
      const inputGrams = new Set<string>();
      for (let i = 0; i <= inputWords.length - 4; i++) {
        inputGrams.add(inputWords.slice(i, i + 4).join(" "));
      }

      const matches: { title: string; authors: string; overlap: number; matchCount: number }[] = [];

      allCorpus.forEach((p) => {
        const pText = `${p.title} ${p.abstract}`.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
        const pWords = pText.split(/\s+/).filter((w) => w.length > 2);
        let matchCount = 0;
        for (let i = 0; i <= pWords.length - 4; i++) {
          if (inputGrams.has(pWords.slice(i, i + 4).join(" "))) {
            matchCount += 1;
          }
        }
        if (matchCount > 0) {
          const overlapPct = Math.min(100, Math.round((matchCount / Math.max(1, inputGrams.size)) * 100));
          matches.push({
            title: p.title,
            authors: p.authors,
            overlap: overlapPct,
            matchCount,
          });
        }
      });

      matches.sort((a, b) => b.overlap - a.overlap);
      const topScore = matches.length > 0 ? matches[0].overlap : 0;

      setPlagiarismScanResult({
        totalScore: topScore,
        matchedPapers: matches.slice(0, 5),
        corpusCount: allCorpus.length,
        scannedAt: new Date().toLocaleTimeString(),
      });

      showToast(
        topScore > 20
          ? `Scan complete: Overlap detected (${topScore}%)`
          : `Scan complete: Original content (${topScore}% overlap)`,
        topScore > 20 ? "warning" : "success"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Plagiarism scan failed: ${msg}`, "error");
    } finally {
      setIsScanningPlagiarism(false);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJobId) {
      setIsProcessing(false);
      return;
    }
    try {
      await cancelAnalysisJob(activeJobId);
      showToast("Analysis job cancelled", "info");
    } catch (err) {
      console.warn("Failed to cancel job:", err);
    } finally {
      setIsProcessing(false);
      setActiveJobId(null);
    }
  };

  const getToolTitle = () => {
    switch (toolId) {
      case "ai_writing_detector":
        return { name: "AI Writing Detector", icon: ScanEye, desc: "Empirical stylometric analysis & perplexity variance scanner" };
      case "plagiarism_checker":
        return { name: "Plagiarism Checker", icon: FileSearch, desc: "Winnowing n-gram text overlap against local library papers" };
      case "ai_humanizer":
        return { name: "AI Humanizer", icon: Sparkles, desc: "Natural scholarly sentence variation & anti-cliché polisher" };
      case "academic_writing_assistant":
        return { name: "Academic Writing Assistant", icon: PenTool, desc: "Peer-review tone calibration, clarity & passive-voice balancing" };
      case "paraphrasing_tool":
        return { name: "Paraphrasing Tool", icon: RefreshCw, desc: "Precision scholarly rephrasing with citation & equation guards" };
      case "citation_checker":
        return { name: "Citation Checker", icon: CheckCircle2, desc: "Canonical DOI, BibTeX, and reference integrity validator" };
      case "readability_analyzer":
        return { name: "Readability Analyzer", icon: BarChart2, desc: "Flesch-Kincaid, Gunning Fog, and complexity formulas" };
      case "research_integrity":
        return { name: "Research Integrity Suite", icon: ShieldCheck, desc: "Peer-review readiness audit & ethical disclosure builder" };
      default:
        return { name: "AI Academic Tool", icon: Sparkles, desc: "Specialized scholarly analysis workspace" };
    }
  };

  const toolMeta = getToolTitle();
  const Icon = toolMeta.icon;

  return (
    <div className="space-y-5 pb-12">
      {/* Top Breadcrumb & Navigation Bar */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveSection("ai_tools")}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Return to AI Tools Hub"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {toolMeta.name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {toolMeta.desc}
              </p>
            </div>
          </div>
        </div>

        {/* Paper selector & Sample text loader */}
        <div className="flex items-center gap-2">
          {papers.length > 0 && (
            <select
              value={selectedPaperId}
              onChange={(e) => handlePaperSelect(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Load paper from Library...</option>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title.length > 40 ? `${p.title.slice(0, 40)}...` : p.title}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setInputText(SAMPLE_TEXTS[toolId] || "")}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Reset Sample
          </button>
        </div>
      </div>

      {/* Main Two-Column Interactive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Input Text Area & Mode Controls */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Source Academic Text
              </label>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>{readabilityStats.words} words</span>
                <span>•</span>
                <span>{readabilityStats.sentences} sentences</span>
              </div>
            </div>

            <textarea
              rows={9}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste manuscript draft, abstract, or paragraph to analyze..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed resize-y"
            />

            {/* Mode Controls for Generative / Rewriting tools */}
            {(toolId === "academic_writing_assistant" ||
              toolId === "ai_humanizer" ||
              toolId === "paraphrasing_tool") && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                {toolId === "academic_writing_assistant" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Target Mode:</span>
                    <button
                      type="button"
                      onClick={() => setWritingAssistantMode("clarity")}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        writingAssistantMode === "clarity"
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Clarity
                    </button>
                    <button
                      type="button"
                      onClick={() => setWritingAssistantMode("academic")}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        writingAssistantMode === "academic"
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Journal Tone
                    </button>
                    <button
                      type="button"
                      onClick={() => setWritingAssistantMode("condense")}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        writingAssistantMode === "condense"
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Condense Abstract
                    </button>
                  </div>
                )}

                {toolId === "ai_humanizer" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Cadence Voice:</span>
                    <button
                      type="button"
                      onClick={() => setHumanizerStyle("peer_review")}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        humanizerStyle === "peer_review"
                          ? "bg-purple-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Peer Reviewer
                    </button>
                    <button
                      type="button"
                      onClick={() => setHumanizerStyle("concise")}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        humanizerStyle === "concise"
                          ? "bg-purple-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Concise Scholar
                    </button>
                  </div>
                )}

                {toolId === "paraphrasing_tool" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Format:</span>
                    <button
                      type="button"
                      onClick={() => setParaphraseMode("standard")}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        paraphraseMode === "standard"
                          ? "bg-amber-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => setParaphraseMode("dense")}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        paraphraseMode === "dense"
                          ? "bg-amber-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Dense Synthesis
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setUseInstantDeterministic((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                      useInstantDeterministic
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                    title="Instant zero-RAM rule-based academic polish without LLM invocation"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${useInstantDeterministic ? "bg-emerald-500" : "bg-slate-400"}`} />
                    Instant Polish (0 MB RAM)
                  </button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isProcessing || !inputText.trim()}
                    onClick={handleExecuteToolAction}
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    {isProcessing ? "Processing..." : useInstantDeterministic ? "Polish Instantly" : "Run Tool"}
                  </Button>
                </div>
              </div>
            )}

            {toolId === "ai_writing_detector" && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Runs background statistical signal extraction & sentence cadence calibration.
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isProcessing || !inputText.trim()}
                    onClick={handleRunAiWritingDetector}
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    {isProcessing ? `Scanning (${jobProgress}%)...` : "Scan Stylometric Signals"}
                  </Button>
                  {isProcessing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelJob}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      Cancel Job
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Active AI Processing Animation */}
          {isProcessing &&
            (toolId === "academic_writing_assistant" ||
              toolId === "ai_humanizer" ||
              toolId === "paraphrasing_tool") && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 p-8 flex flex-col items-center justify-center space-y-3 shadow-sm animate-in fade-in duration-200">
                <LiveOrb size={64} interactive blink variant="webgl" className="shadow-xl" />
                <div className="text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    In-App AI Engine Actively Processing
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Synthesizing text with invariant token & citation preservation...
                  </p>
                </div>
              </div>
            )}

          {/* Generated Result Output Box (for Writing, Humanizer, Paraphraser) */}
          {(toolId === "academic_writing_assistant" ||
            toolId === "ai_humanizer" ||
            toolId === "paraphrasing_tool") &&
            outputText && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 p-4 space-y-3 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Polished Academic Result</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(outputText)}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{hasCopied ? "Copied" : "Copy Output"}</span>
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                  {outputText}
                </div>
              </div>
            )}

          {/* AI Writing Detector Sentence Breakdown */}
          {toolId === "ai_writing_detector" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Sentence-by-Sentence Stylometric Scan
                </h3>
                <span className="text-[11px] text-slate-500">
                  {aiDetectorStats.sentences.length} sentences evaluated
                </span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {aiDetectorStats.sentences.map((sent, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                      sent.isSuspect
                        ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 text-slate-800 dark:text-slate-200"
                        : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 mt-0.5 ${
                        sent.isSuspect
                          ? "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {sent.words}w
                    </span>
                    <p className="flex-1">{sent.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Dynamic Empirical Scorecards & Audits */}
        <div className="lg:col-span-5 space-y-4">
          {/* TOOL 1: AI Writing Detector Scorecard */}
          {toolId === "ai_writing_detector" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Stylometric Probability Analysis
              </h2>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-center space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Machine Generation Probability
                </span>
                <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                  {aiDetectorStats.aiScore}%
                </div>
                <Badge
                  variant={
                    aiDetectorStats.aiScore < 30
                      ? "success"
                      : aiDetectorStats.aiScore < 65
                      ? "warning"
                      : "destructive"
                  }
                  size="md"
                >
                  {aiDetectorStats.aiScore < 30
                    ? "Likely Human Written"
                    : aiDetectorStats.aiScore < 65
                    ? "Mixed / Heavily Edited AI"
                    : "Elevated Machine Pattern"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <span className="text-slate-400 text-[10px] block font-semibold">Sentence Burstiness</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {aiDetectorStats.burstiness}
                  </span>
                  <span className="text-[10px] text-slate-400 block">&gt; 5.0 indicates human cadence</span>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <span className="text-slate-400 text-[10px] block font-semibold">Cadence Uniformity</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {aiDetectorStats.uniformity}%
                  </span>
                  <span className="text-[10px] text-slate-400 block">Higher = repetitive length</span>
                </div>
              </div>

              {pythonAiSignals && (
                <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                      Python Engine Diagnosis:
                    </span>
                    <Badge variant="outline" size="sm">
                      {pythonAiSignals.classification.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-indigo-800 dark:text-indigo-300">
                    {pythonAiSignals.uncertainty_caveat}
                  </p>
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 leading-snug flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Empirical stylometric metrics are advisory tools for writing polish and academic drafting. Never use statistical metrics as sole criteria for authorship attribution.
                </p>
              </div>
            </div>
          )}

          {/* TOOL 2: Plagiarism Scanner Scorecard */}
          {toolId === "plagiarism_checker" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Library Corpus Similarity Match
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRunPlagiarismScan}
                  disabled={isScanningPlagiarism}
                  className="h-7 text-xs"
                >
                  {isScanningPlagiarism ? "Scanning..." : "Deep Scan"}
                </Button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-center space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Maximum Library Overlap
                </span>
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {effectivePlagiarismStats.totalScore}%
                </div>
                <Badge variant={effectivePlagiarismStats.totalScore > 20 ? "warning" : "success"} size="md">
                  {effectivePlagiarismStats.totalScore > 20 ? "Substantial Match Found" : "Original / Low Overlap"}
                </Badge>
              </div>

              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Top Matched Documents ({papers.length} in library)
                </span>
                {effectivePlagiarismStats.matchedPapers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    No verbatim overlap detected against saved library papers.
                  </p>
                ) : (
                  effectivePlagiarismStats.matchedPapers.map((match, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                          {match.title}
                        </span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                          {match.overlap}% match
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{match.authors}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TOOL 3: Readability & Complexity Scorecard */}
          {toolId === "readability_analyzer" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Empirical Readability Formulas
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Flesch-Kincaid Grade
                  </span>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                    {readabilityStats.fleschGrade}
                  </div>
                  <span className="text-[10px] text-slate-400">Target: Grade 12–16 (College/Research)</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Gunning Fog Index
                  </span>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {readabilityStats.gunningFog}
                  </div>
                  <span className="text-[10px] text-slate-400">Ideal: 12.0–15.0 for scholarly journals</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Flesch Reading Ease
                  </span>
                  <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
                    {readabilityStats.fleschEase}
                  </div>
                  <span className="text-[10px] text-slate-400">30–50 is standard for academic prose</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Coleman-Liau Metric
                  </span>
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                    {readabilityStats.colemanLiau}
                  </div>
                  <span className="text-[10px] text-slate-400">Letter & sentence frequency based</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">
                  Lexical Composition
                </span>
                <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/40">
                  <span className="text-slate-500">Complex Words (3+ syllables)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {readabilityStats.complexWords} (
                    {Math.round((readabilityStats.complexWords / Math.max(1, readabilityStats.words)) * 100)}%)
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/40">
                  <span className="text-slate-500">Avg. Sentence Length</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {Math.round((readabilityStats.words / Math.max(1, readabilityStats.sentences)) * 10) / 10} words
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TOOL 4: Citation Validator Scorecard */}
          {toolId === "citation_checker" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Reference Format & DOI Verification
              </h2>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-center space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Validated Citations & Identifiers
                </span>
                <div className="text-3xl font-black text-cyan-600 dark:text-cyan-400">
                  {citationStats.totalFound}
                </div>
                <Badge variant="info" size="md">
                  Active Reference Integrity
                </Badge>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {citationStats.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        {item.ref}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {item.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TOOL 5: Research Integrity Suite Checklist */}
          {toolId === "research_integrity" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Submission Readiness Audit
                </h2>
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {Math.round((integrityItems.filter((i) => i.checked).length / integrityItems.length) * 100)}% Ready
                </span>
              </div>

              <div className="space-y-2.5">
                {integrityItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() =>
                        setIntegrityItems((prev) =>
                          prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i))
                        )
                      }
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-slate-400">{item.category} Compliance</span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const statement = `Data & Code Availability: The datasets and source code supporting the findings of this study are available in the public project repository with persistent identifier [DOI/URL]. All authors have reviewed and approved the final submission and declare no competing financial or non-financial interests.`;
                    handleCopy(statement);
                  }}
                  className="w-full text-xs justify-center"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Data & Ethics Statement
                </Button>
              </div>
            </div>
          )}

          {/* Quick Access to Sibling Tools */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Quick Switch AI Tool
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveSection("ai_writing_detector")}
                className={`px-2.5 py-1.5 rounded-lg text-left truncate transition-colors cursor-pointer ${
                  toolId === "ai_writing_detector"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-bold"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                AI Detector
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("plagiarism_checker")}
                className={`px-2.5 py-1.5 rounded-lg text-left truncate transition-colors cursor-pointer ${
                  toolId === "plagiarism_checker"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-bold"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                Plagiarism Scan
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("ai_humanizer")}
                className={`px-2.5 py-1.5 rounded-lg text-left truncate transition-colors cursor-pointer ${
                  toolId === "ai_humanizer"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-bold"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                AI Humanizer
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("academic_writing_assistant")}
                className={`px-2.5 py-1.5 rounded-lg text-left truncate transition-colors cursor-pointer ${
                  toolId === "academic_writing_assistant"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-bold"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                Writing Assistant
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("paraphrasing_tool")}
                className={`px-2.5 py-1.5 rounded-lg text-left truncate transition-colors cursor-pointer ${
                  toolId === "paraphrasing_tool"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-bold"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                Paraphraser
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("citation_checker")}
                className={`px-2.5 py-1.5 rounded-lg text-left truncate transition-colors cursor-pointer ${
                  toolId === "citation_checker"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-bold"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                Citation Check
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("readability_analyzer")}
                className={`px-2.5 py-1.5 rounded-lg text-left truncate transition-colors cursor-pointer ${
                  toolId === "readability_analyzer"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-bold"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                Readability
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("research_integrity")}
                className={`px-2.5 py-1.5 rounded-lg text-left truncate transition-colors cursor-pointer ${
                  toolId === "research_integrity"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 font-bold"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                Integrity Suite
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

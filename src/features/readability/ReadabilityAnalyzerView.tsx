import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import {
  BarChart2,
  Sparkles,
  Upload,
  Download,
  Info,
} from "lucide-react";
import { ReadabilityReport } from "./types";
import { analyzeReadability, READABILITY_DEMO_SAMPLE } from "./readabilityEngine";
import { Button } from "../../components/ui/Button";
import {
  ingestDocumentContent,
  saveReadabilityReportDb,
  getReadabilityReportByHashDb,
  extractDocumentText,
} from "../../lib/desktop-api";

export const ReadabilityAnalyzerView: React.FC = () => {
  const { papers, showToast } = useApp();

  const [inputText, setInputText] = useState<string>(READABILITY_DEMO_SAMPLE);
  const [report, setReport] = useState<ReadabilityReport | null>(() => {
    try {
      return analyzeReadability(READABILITY_DEMO_SAMPLE, "Demo Document");
    } catch {
      return null;
    }
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"sentences" | "paragraphs" | "vocabulary">("sentences");
  const [fileName, setFileName] = useState<string>("sample-document.txt");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const runAnalysis = useCallback(async (text: string, title = "Manuscript") => {
    if (!text.trim()) {
      setReport(null);
      return;
    }

    setIsProcessing(true);
    try {
      const meta = await ingestDocumentContent(
        fileName || "manuscript.txt",
        "txt",
        text
      ).catch(() => null);

      const docHash = meta?.document_hash || `hash_${text.length}`;

      const cached = await getReadabilityReportByHashDb(docHash).catch(() => null);
      if (cached) {
        try {
          const metrics = JSON.parse(cached.metrics_json);
          const vocabulary = JSON.parse(cached.vocabulary_json);
          const paragraphs = JSON.parse(cached.paragraphs_json);
          const recs = JSON.parse(cached.recommendations_json);
          setReport({
            id: cached.id,
            rawText: text,
            title: cached.document_title,
            analyzedAt: cached.created_at,
            language: {
              detectedCode: cached.language_code,
              languageName: cached.language_code === "en" ? "English" : "Non-English",
              confidence: 0.98,
              isEnglish: cached.language_code === "en",
              limitationNotice: undefined,
            },
            metrics,
            vocabulary,
            paragraphs,
            sentences: [],
            totalParagraphs: paragraphs.length,
            actionableClarityRecommendations: recs,
            totalSentences: cached.sentence_count,
            avgSentenceLength: cached.sentence_count
              ? Math.round(cached.word_count / cached.sentence_count)
              : 0,
            longSentencesCount: 0,
          });
          setIsProcessing(false);
          return;
        } catch (e) {
          console.warn("Failed to parse cached readability report:", e);
        }
      }

      const res = analyzeReadability(text, title);
      setReport(res);

      saveReadabilityReportDb({
        id: `read_${Date.now()}`,
        document_hash: docHash,
        document_title: title,
        language_code: res.language.detectedCode,
        word_count: res.vocabulary.totalWords,
        sentence_count: res.totalSentences,
        flesch_reading_ease: res.metrics.fleschReadingEase,
        flesch_kincaid_grade: res.metrics.fleschKincaidGrade,
        gunning_fog_index: res.metrics.gunningFogIndex,
        metrics_json: JSON.stringify(res.metrics),
        vocabulary_json: JSON.stringify(res.vocabulary),
        paragraphs_json: JSON.stringify(res.paragraphs),
        recommendations_json: JSON.stringify(res.actionableClarityRecommendations),
        created_at: new Date(res.analyzedAt).toISOString(),
      }).catch((err) => console.warn("Failed to save readability report:", err));
    } finally {
      setIsProcessing(false);
    }
  }, [fileName]);

  useEffect(() => {
    runAnalysis(READABILITY_DEMO_SAMPLE, "Demo Document");
  }, [runAnalysis]);

  const handleManualRun = () => {
    if (!inputText.trim()) {
      showToast("Please enter or import text to analyze.", "warning");
      return;
    }
    runAnalysis(inputText, fileName);
    showToast("Readability analysis updated.", "success");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const isBinary = /\.(pdf|docx)$/i.test(file.name);

    if (isBinary) {
      try {
        setIsProcessing(true);
        const filePath = (file as unknown as { path?: string }).path || file.name;
        const res = await extractDocumentText(filePath);
        if (res && res.text && res.text.trim()) {
          setInputText(res.text);
          runAnalysis(res.text, file.name);
          showToast(`Extracted and analyzed "${file.name}"`, "info");
        } else {
          showToast(`No readable text extracted from "${file.name}".`, "warning");
        }
      } catch (err) {
        console.warn("Backend document extraction failed:", err);
        showToast(`Failed to extract text from binary document "${file.name}".`, "error");
      } finally {
        setIsProcessing(false);
        e.target.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setInputText(content);
        runAnalysis(content, file.name);
        showToast(`Loaded "${file.name}"`, "info");
      }
    };
    reader.onerror = () => {
      showToast("Failed to read file.", "error");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExport = (format: "md" | "json") => {
    if (!report) return;
    let content: string;
    let mimeType = "text/plain";

    if (format === "json") {
      content = JSON.stringify(report, null, 2);
      mimeType = "application/json";
    } else {
      content = `# Readability Analysis Report: ${report.title}
Date: ${new Date(report.analyzedAt).toLocaleString()}
Language: ${report.language.languageName} (${report.language.isEnglish ? "English" : "Non-English"})

## Readability Scores
- Flesch Reading Ease: ${report.metrics.fleschReadingEase} (${report.metrics.scoreBand.replace("_", " ").toUpperCase()})
- Flesch-Kincaid Grade: ${report.metrics.fleschKincaidGrade}
- Gunning Fog Index: ${report.metrics.gunningFogIndex}
- Coleman-Liau Index: ${report.metrics.colemanLiauIndex}
- SMOG Index: ${report.metrics.smogIndex}
- Automated Readability Index (ARI): ${report.metrics.automatedReadabilityIndex}
- Academic Classification: ${report.metrics.academicSuitabilityLabel}

## Vocabulary & Sentence Statistics
- Total Words: ${report.vocabulary.totalWords}
- Total Sentences: ${report.totalSentences}
- Average Sentence Length: ${report.avgSentenceLength} words
- Complex Words (3+ syllables): ${report.vocabulary.complexWordsCount} (${report.vocabulary.complexWordPercentage}%)
- Passive Voice Sentences: ${report.vocabulary.passiveSentencesCount} (${report.vocabulary.passiveVoiceRatio}%)
- Long Sentences (>35 words): ${report.longSentencesCount}

## Actionable Recommendations
${report.actionableClarityRecommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}
`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `readability-report-${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported report as .${format}`, "success");
  };

  return (
    <div className="space-y-5 pb-16">
      {/* 1. Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl border shrink-0 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400">
              <BarChart2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Readability & Clarity Analyzer
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Classical & Academic Metrics
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
                Evaluates sentence cadences, paragraph densities, vocabulary complexity, passive-voice distribution, and classical readability metrics (Flesch, Gunning Fog, Kincaid, SMOG) with language-appropriate calibrations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.md,.tex,.bib,.docx,.pdf"
              className="hidden"
            />

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs h-9 gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import File</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("md")}
              disabled={!report}
              className="text-xs h-9 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .MD</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleManualRun}
              isLoading={isProcessing}
              className="text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analyze</span>
            </Button>
          </div>
        </div>

        {/* Language & Formula Limitations Banner */}
        {report && (
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
              report.language.isEnglish
                ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
            }`}
          >
            <Info className={`w-4 h-4 shrink-0 mt-0.5 ${report.language.isEnglish ? "text-indigo-500" : "text-amber-600"}`} />
            <div className="space-y-0.5">
              <span className="font-bold block">
                Detected Language: {report.language.languageName} ({Math.round(report.language.confidence * 100)}% confidence)
              </span>
              <p>
                {report.language.limitationNotice ||
                  "Formulas Explained: Flesch Reading Ease scores between 30–50 represent standard peer-reviewed scientific literature. Gunning Fog and Flesch-Kincaid measure estimated years of formal education required for comprehension."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Top KPI Metric Cards */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Flesch Reading Ease */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Flesch Reading Ease
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {report.metrics.fleschReadingEase}
              </span>
              <span className="text-xs text-slate-400 font-semibold">/100</span>
            </div>
            <span className="text-[10px] text-slate-500 block capitalize">
              {report.metrics.scoreBand.replace("_", " ")}
            </span>
          </div>

          {/* Flesch-Kincaid Grade */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Grade Level
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {report.metrics.fleschKincaidGrade}
            </div>
            <span className="text-[10px] text-slate-500 block">
              Kincaid Scale
            </span>
          </div>

          {/* Gunning Fog Index */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Gunning Fog Index
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {report.metrics.gunningFogIndex}
            </div>
            <span className="text-[10px] text-slate-500 block">
              College Level ({report.metrics.gunningFogIndex >= 14 ? "Peer Review" : "General"})
            </span>
          </div>

          {/* Average Sentence Length */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Avg Sentence Length
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {report.avgSentenceLength}
            </div>
            <span className="text-[10px] text-slate-500 block">
              Words / Sentence
            </span>
          </div>

          {/* Complex Words % */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Complex Words
            </span>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {report.vocabulary.complexWordPercentage}%
            </div>
            <span className="text-[10px] text-slate-500 block">
              {report.vocabulary.complexWordsCount} words (3+ syllables)
            </span>
          </div>

          {/* Passive Voice % */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Passive Voice
            </span>
            <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
              {report.vocabulary.passiveVoiceRatio}%
            </div>
            <span className="text-[10px] text-slate-500 block">
              {report.vocabulary.passiveSentencesCount} sentence(s)
            </span>
          </div>
        </div>
      )}

      {/* 3. Main Split Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (5 Cols): Manuscript Editor */}
        <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Source Document
              </span>
              <span className="text-slate-400 text-[11px] font-mono">({fileName})</span>
            </div>

            <div className="flex items-center gap-2">
              {papers.length > 0 && (
                <select
                  onChange={(e) => {
                    const p = papers.find((paper) => paper.id === e.target.value);
                    if (p) {
                      const text = `${p.title}\n\nAbstract:\n${p.abstract}`;
                      setInputText(text);
                      setFileName(`${p.title.slice(0, 20)}.txt`);
                      runAnalysis(text, p.title);
                      showToast(`Loaded "${p.title.slice(0, 35)}..."`, "info");
                    }
                  }}
                  defaultValue=""
                  className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  <option value="" disabled>
                    Load Library Paper...
                  </option>
                  {papers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title.slice(0, 35)}...
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => {
                  setInputText(READABILITY_DEMO_SAMPLE);
                  setFileName("sample-document.txt");
                  runAnalysis(READABILITY_DEMO_SAMPLE, "Demo Document");
                  showToast("Loaded sample document", "info");
                }}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Sample
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputText("");
                  setReport(null);
                  setFileName("empty.txt");
                }}
                className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste text or import a research document to analyze readability..."
            rows={18}
            className="w-full flex-1 p-4 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs leading-relaxed font-sans resize-y focus:outline-hidden"
          />

          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              {report ? `${report.vocabulary.totalWords} words · ${report.totalSentences} sentences` : "0 words"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRun}
              className="text-xs h-6 px-2"
            >
              Update Metrics
            </Button>
          </div>
        </div>

        {/* Right (7 Cols): Tabs for Sentence Inspector, Paragraph Breakdown, and Vocabulary */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("sentences")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === "sentences"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Sentences & Clarity ({report?.sentences.length || 0})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("paragraphs")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === "paragraphs"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Paragraph-Level Breakdown ({report?.paragraphs.length || 0})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("vocabulary")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === "vocabulary"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Vocabulary & Repetition
            </button>
          </div>

          {/* TAB 1: SENTENCE-BY-SENTENCE & CLARITY INSPECTOR */}
          {activeTab === "sentences" && (
            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {report?.actionableClarityRecommendations && report.actionableClarityRecommendations.length > 0 && (
                <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                  <span className="font-bold uppercase tracking-wider text-[10px] block text-indigo-600 dark:text-indigo-400">
                    Actionable Clarity Directives
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {report.actionableClarityRecommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {report?.sentences.map((sent) => (
                <div
                  key={sent.index}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-3.5 space-y-2 transition-all ${
                    sent.isOverlyLong
                      ? "border-amber-200 dark:border-amber-900/60 bg-amber-50/15"
                      : sent.isPassive
                      ? "border-sky-200 dark:border-sky-900/60 bg-sky-50/15"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px] flex items-center justify-center">
                        {sent.index}
                      </span>
                      <span className="font-semibold text-slate-500">
                        {sent.wordCount} words · {sent.syllableCount} syllables
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {sent.isOverlyLong && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                          Long (&gt;35 words)
                        </span>
                      )}
                      {sent.isPassive && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                          Passive Voice
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                    {sent.text}
                  </p>

                  {sent.claritySuggestion && (
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                      <span>{sent.claritySuggestion}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: PARAGRAPH-LEVEL BREAKDOWN TABLE */}
          {activeTab === "paragraphs" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400 font-bold">
                    <tr>
                      <th className="px-4 py-2.5">Para #</th>
                      <th className="px-4 py-2.5">Sentences</th>
                      <th className="px-4 py-2.5">Words</th>
                      <th className="px-4 py-2.5">Avg Sent Len</th>
                      <th className="px-4 py-2.5">Flesch Ease</th>
                      <th className="px-4 py-2.5">Gunning Fog</th>
                      <th className="px-4 py-2.5">Complexity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {report?.paragraphs.map((p) => (
                      <tr key={p.index} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-bold font-mono">Paragraph {p.index}</td>
                        <td className="px-4 py-3">{p.sentenceCount}</td>
                        <td className="px-4 py-3 font-semibold">{p.wordCount}</td>
                        <td className="px-4 py-3">{p.avgSentenceLength}</td>
                        <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">
                          {p.fleschEase}
                        </td>
                        <td className="px-4 py-3">{p.gunningFog}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {p.complexityBand.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: VOCABULARY & REPETITION */}
          {activeTab === "vocabulary" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Lexical Diversity (TTR)
                  </span>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {report?.vocabulary.lexicalDiversity}%
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {report?.vocabulary.uniqueWords} unique / {report?.vocabulary.totalWords} total words
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Syllables Per Word
                  </span>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    {report?.vocabulary.avgSyllablesPerWord}
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {report?.vocabulary.complexWordPercentage}% complex (&gt;=3 syllables)
                  </span>
                </div>
              </div>

              {/* Repeated Phrases List */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider block">
                  Repeated 2–4 Word Phrases (3+ Occurrences)
                </span>

                {report?.vocabulary.frequentPhrases && report.vocabulary.frequentPhrases.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {report.vocabulary.frequentPhrases.map((rp, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between"
                      >
                        <span className="font-mono text-slate-800 dark:text-slate-200">"{rp.phrase}"</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          {rp.count}x
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No excessive repeated multi-word phrases detected in this sample.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

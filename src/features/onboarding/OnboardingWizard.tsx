import React, { useState, useEffect } from "react";
import applicationIcon from "../../assets/application.png";
import {
  Sparkles,
  Compass,
  BookOpen,
  TableProperties,
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Database,
  Cpu,
  Bot,
  Plus,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useApp } from "../../context/AppContext";
import { getAppSetting, setAppSetting } from "../../lib/desktop-api";
import { NavSection } from "../../types/domain";

export interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const PRESET_TOPICS = [
  "Computer Science",
  "Artificial Intelligence & ML",
  "Medicine & Healthcare",
  "Engineering & Robotics",
  "Mathematics",
  "Quantum Computing",
  "Natural Sciences",
  "Social Sciences",
  "Humanities",
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { setActiveSection, showToast, theme, setTheme } = useApp();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([
    "Computer Science",
    "Artificial Intelligence & ML",
  ]);
  const [customTopicInput, setCustomTopicInput] = useState<string>("");
  const [primaryWorkflow, setPrimaryWorkflow] = useState<NavSection>("discover");
  const [aiPreference, setAiPreference] = useState<"local" | "hosted" | "later" | "skip">("later");

  // Load saved progress if interrupted
  useEffect(() => {
    if (!isOpen) return;

    void (async () => {
      try {
        const savedStep = await getAppSetting("onboarding_current_step");
        if (savedStep) {
          const parsed = parseInt(savedStep, 10);
          if (parsed >= 1 && parsed <= 6) setCurrentStep(parsed);
        }

        const savedTopics = await getAppSetting("research_interests");
        if (savedTopics) {
          try {
            setSelectedTopics(JSON.parse(savedTopics));
          } catch {}
        }

        const savedWorkflow = await getAppSetting("primary_workflow");
        if (savedWorkflow) setPrimaryWorkflow(savedWorkflow as NavSection);
      } catch {
        // Fallback to localStorage
        const lsStep = localStorage.getItem("rps_onboarding_step");
        if (lsStep) setCurrentStep(parseInt(lsStep, 10) || 1);
      }
    })();
  }, [isOpen]);

  const persistStep = async (step: number) => {
    setCurrentStep(step);
    try {
      await setAppSetting("onboarding_current_step", String(step));
    } catch {
      localStorage.setItem("rps_onboarding_step", String(step));
    }
  };

  const handleToggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleAddCustomTopic = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customTopicInput.trim();
    if (trimmed && !selectedTopics.includes(trimmed)) {
      setSelectedTopics((prev) => [...prev, trimmed]);
      setCustomTopicInput("");
    }
  };

  const handleFinishOnboarding = async () => {
    try {
      await setAppSetting("onboarding_completed", "true");
      await setAppSetting("onboarding_version", "1.0.0");
      await setAppSetting("research_interests", JSON.stringify(selectedTopics));
      await setAppSetting("primary_workflow", primaryWorkflow);
      await setAppSetting("ai_preference", aiPreference);
    } catch {
      localStorage.setItem("rps_onboarding_completed", "true");
      localStorage.setItem("rps_onboarding_version", "1.0.0");
      localStorage.setItem("rps_interests", JSON.stringify(selectedTopics));
    }

    setActiveSection(primaryWorkflow);
    showToast("Welcome to Infinity Researcher!", "success");
    onComplete();
  };

  const handleSkip = async () => {
    try {
      await setAppSetting("onboarding_completed", "true");
      await setAppSetting("onboarding_version", "1.0.0");
    } catch {
      localStorage.setItem("rps_onboarding_completed", "true");
    }
    showToast("Setup skipped. You can reopen it anytime from Settings.", "info");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800">
              <img src={applicationIcon} alt="Infinity Researcher" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Infinity Researcher
              </span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium ml-2">
                Setup Wizard (Step {currentStep} of 6)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* White / Black / Auto Theme Quick Switcher */}
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 p-0.5">
              <button
                type="button"
                onClick={() => setTheme("light")}
                aria-label="White theme"
                title="White (Light) Theme"
                className={`px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-white text-indigo-600 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Sun className="w-3 h-3 text-amber-500" />
                <span className="text-[10px]">White</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                aria-label="Black theme"
                title="Black (Dark) Theme"
                className={`px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-slate-900 text-indigo-400 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Moon className="w-3 h-3 text-indigo-400" />
                <span className="text-[10px]">Black</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                aria-label="System theme"
                title="Sync with System Theme"
                className={`p-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  theme === "system"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Laptop className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium cursor-pointer"
            >
              Skip setup
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1">
          <div
            className="bg-indigo-600 h-1 transition-all duration-300"
            style={{ width: `${(currentStep / 6) * 100}%` }}
          />
        </div>

        {/* Dynamic Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: WELCOME */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="text-center space-y-2 max-w-lg mx-auto pt-2">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 p-2 mx-auto flex items-center justify-center shadow-md">
                  <img src={applicationIcon} alt="Infinity Researcher" className="w-full h-full object-contain" />
                </div>
                <h1 id="onboarding-title" className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Welcome to Infinity Researcher
                </h1>
                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  Discover. Understand. Research.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Created by Sanjay · Infinity Web Technology
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 space-y-2 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center">
                    <Compass className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Discover Papers
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Search across OpenAlex, Crossref, Semantic Scholar, arXiv, Europe PMC, and IEEE.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 space-y-2 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-500 flex items-center justify-center">
                    <TableProperties className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Review Matrix
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Extract 9 empirical dimensions with verifiable claim-to-page evidence links.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 space-y-2 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Research Integrity
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Local-first text similarity checker, AI-writing signals, and academic writing polish.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: RESEARCH INTERESTS */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Select Your Research Interests
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose topics you study. This helps tailor default discovery queries and literature filters.
                  Stored strictly locally in your private SQLite database.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {Array.from(new Set([...PRESET_TOPICS, ...selectedTopics])).map((topic) => {
                  const isSelected = selectedTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => handleToggleTopic(topic)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-slate-300"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{topic}</span>
                    </button>
                  );
                })}
              </div>

              {/* Add Custom Topic Input */}
              <form onSubmit={handleAddCustomTopic} className="flex items-center gap-2 pt-3">
                <input
                  type="text"
                  value={customTopicInput}
                  onChange={(e) => setCustomTopicInput(e.target.value)}
                  placeholder="Add custom topic (e.g. CRISPR, Photovoltaics)..."
                  className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button variant="secondary" size="sm" type="button" onClick={() => handleAddCustomTopic()}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Add</span>
                </Button>
              </form>
            </div>
          )}

          {/* STEP 3: WORKFLOW */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  What is your primary goal today?
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose where you'd like to start. You can switch sections anytime from the sidebar.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  {
                    id: "discover" as NavSection,
                    title: "Discover New Papers",
                    desc: "Search 6 academic repositories and scrape open-access PDFs.",
                    icon: <Compass className="w-4 h-4 text-indigo-500" />,
                  },
                  {
                    id: "review_matrix" as NavSection,
                    title: "Build Literature Review",
                    desc: "Compare papers side-by-side with claim-to-page citations.",
                    icon: <TableProperties className="w-4 h-4 text-sky-500" />,
                  },
                  {
                    id: "library" as NavSection,
                    title: "Organize Paper Library",
                    desc: "Manage collections, read PDFs offline, and track reading progress.",
                    icon: <BookOpen className="w-4 h-4 text-emerald-500" />,
                  },
                  {
                    id: "integrity" as NavSection,
                    title: "Check Research Integrity",
                    desc: "Inspect text similarity, AI signals, and polish academic tone.",
                    icon: <FileCheck2 className="w-4 h-4 text-purple-500" />,
                  },
                ].map((wf) => {
                  const isSelected = primaryWorkflow === wf.id;
                  return (
                    <div
                      key={wf.id}
                      onClick={() => setPrimaryWorkflow(wf.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 shadow-xs ring-1 ring-indigo-500"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors ${
                            isSelected
                              ? "bg-indigo-100 dark:bg-indigo-900/60 border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                          }`}>
                            {wf.icon}
                          </div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {wf.title}
                          </span>
                        </div>
                        {isSelected ? (
                          <div className="w-4 h-4 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-2xs">
                            <CheckCircle2 className="w-3 h-3" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal pl-9">
                        {wf.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: AI SETUP */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  AI & Copilot Configuration (Optional)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Infinity Researcher never requires a cloud AI key to operate. All scraping,
                  reading, and matrix structuring function completely locally.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                {[
                  {
                    id: "later",
                    title: "Configure AI Later (Recommended)",
                    desc: "Start using the application immediately; connect an AI provider later in Settings.",
                    icon: <Bot className="w-4 h-4 text-indigo-500" />,
                  },
                  {
                    id: "local",
                    title: "Local Offline Models Only",
                    desc: "Use local quantized embeddings and text analysis with 100% offline privacy.",
                    icon: <Cpu className="w-4 h-4 text-emerald-500" />,
                  },
                  {
                    id: "hosted",
                    title: "Connect Cloud Provider (OpenAI, Anthropic, Gemini)",
                    desc: "Enter your own API key in Settings for advanced section synthesis.",
                    icon: <Sparkles className="w-4 h-4 text-purple-500" />,
                  },
                  {
                    id: "skip",
                    title: "Disable AI Features",
                    desc: "Use Infinity Researcher purely as an academic scraper, PDF reader, and organizer.",
                    icon: <X className="w-4 h-4 text-slate-400" />,
                  },
                ].map((opt) => {
                  const isSelected = aiPreference === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setAiPreference(opt.id as any)}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                        isSelected
                          ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 shadow-xs ring-1 ring-indigo-500"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                          isSelected
                            ? "bg-indigo-100 dark:bg-indigo-900/60 border-indigo-200 dark:border-indigo-700"
                            : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        }`}>
                          {opt.icon}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {opt.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {opt.desc}
                          </p>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: STORAGE, SOVEREIGNTY & THEME */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Storage, Sovereignty & Theme
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Infinity Researcher is engineered with a strict local-first philosophy and flexible appearance.
                </p>
              </div>

              {/* Theme Selection Section */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Workspace Theme Appearance</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      theme === "light"
                        ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 ring-1 ring-indigo-500 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                        <Sun className="w-4 h-4" />
                      </div>
                      {theme === "light" && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">White Theme</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Clean daylight canvas</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      theme === "dark"
                        ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 ring-1 ring-indigo-500 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                        <Moon className="w-4 h-4" />
                      </div>
                      {theme === "dark" && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Black Theme</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Deep dark mode</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      theme === "system"
                        ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 ring-1 ring-indigo-500 shadow-xs"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-500 flex items-center justify-center">
                        <Laptop className="w-4 h-4" />
                      </div>
                      {theme === "system" && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">System Auto</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Syncs with OS</p>
                  </button>
                </div>
              </div>

              {/* Data Storage Points */}
              <div className="space-y-2.5 pt-1">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Database className="w-4 h-4 text-indigo-500" />
                    <span>Local SQLite Database (WAL Mode)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6 leading-relaxed">
                    All paper metadata, citations, review matrix tables, and reading notes reside on your
                    machine. Backups can be exported anytime via Settings.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Zero Remote Telemetry</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6 leading-relaxed">
                    We never track searches, paper titles, reading habits, or document contents. No
                    telemetry pings are sent to any server.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: FINISH */}
          {currentStep === 6 && (
            <div className="space-y-5 animate-in fade-in duration-150 text-center py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Setup Complete!
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Your workspace is ready. You have configured {selectedTopics.length} research topics
                  and selected <strong>{primaryWorkflow}</strong> as your initial landing area.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-left text-xs space-y-2.5 max-w-md mx-auto shadow-2xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Selected Topics:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTopics.slice(0, 3).join(", ")}{selectedTopics.length > 3 ? "..." : ""}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Starting Destination:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{primaryWorkflow.replace("_", " ")}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>AI Preference:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{aiPreference}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Workspace Theme:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{theme === "dark" ? "Black Theme" : theme === "light" ? "White Theme" : "System Auto"}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div>
            {currentStep > 1 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => persistStep(currentStep - 1)}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                <span>Back</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 6 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => persistStep(currentStep + 1)}
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinishOnboarding}
              >
                <span>Open Infinity Researcher</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

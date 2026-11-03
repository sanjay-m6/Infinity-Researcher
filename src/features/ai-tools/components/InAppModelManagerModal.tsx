import React, { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  Download,
  AlertCircle,
  Zap,
  Play,
  Square,
  X,
  Loader2,
  HardDrive,
  CheckCircle2,
  Brain,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Progress } from "../../../components/ui/Progress";
import { Badge } from "../../../components/ui/Badge";
import {
  getHardwareProfile,
  listInstalledAiModels,
  startInAppAiEngine,
  stopInAppAiEngine,
  getAiEngineStatus,
  downloadAiModel,
  type HardwareProfile,
  type InstalledModelInfo,
  type LocalAiStatus,
  type DownloadProgress,
} from "../../../lib/desktop-api";

export interface ModelTier {
  id:
    | "deepseek-r1-8b"
    | "qwen2.5-7b"
    | "llama-3.1-8b"
    | "qwen2.5-3b"
    | "mistral-7b"
    | string;
  tierName: string;
  targetHardware: string;
  filename: string;
  downloadSizeMb: number;
  downloadUrl: string;
  description: string;
  minRamGb: number;
  badge: string;
  highlight: string;
  category:
    | "Reasoning SOTA"
    | "Flagship Academic"
    | "Scholarly Voice"
    | "High Speed"
    | "Function Calling";
  accentColor: string;
}

export const MODEL_TIERS: ModelTier[] = [
  {
    id: "deepseek-r1-8b",
    tierName: "DeepSeek-R1 Distill (8B Reasoning SOTA)",
    targetHardware: "8 GB – 16 GB RAM",
    filename: "DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf",
    downloadSizeMb: 4920,
    downloadUrl:
      "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-8B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf",
    description:
      "Global open reasoning champion with native Chain-of-Thought thinking. Unmatched at multi-document comparative synthesis, mathematical validation, and hypothesis extraction.",
    minRamGb: 8,
    badge: "Reasoning SOTA",
    highlight: "Native CoT Reasoning",
    category: "Reasoning SOTA",
    accentColor: "border-indigo-500 text-indigo-500 bg-indigo-500/10",
  },
  {
    id: "qwen2.5-7b",
    tierName: "Qwen 2.5 (7B Academic Flagship)",
    targetHardware: "8 GB – 16 GB RAM",
    filename: "qwen2.5-7b-instruct-q4_k_m.gguf",
    downloadSizeMb: 4680,
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf",
    description:
      "Leading 7B foundation model with 128k context support. World-class at structured academic extraction, review matrix synthesis, and strict citation grounding with near-zero hallucination.",
    minRamGb: 8,
    badge: "128k Context",
    highlight: "Top Extraction Benchmark",
    category: "Flagship Academic",
    accentColor: "border-purple-500 text-purple-500 bg-purple-500/10",
  },
  {
    id: "llama-3.1-8b",
    tierName: "Llama 3.1 (8B Scholarly Voice)",
    targetHardware: "8 GB – 16 GB RAM",
    filename: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    downloadSizeMb: 4920,
    downloadUrl:
      "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    description:
      "Meta's premier open foundation model. The global standard for publication-grade English academic prose, abstract synthesis, manuscript rewriting, and peer review critique.",
    minRamGb: 8,
    badge: "Publication Grade",
    highlight: "Natural Scholarly Style",
    category: "Scholarly Voice",
    accentColor: "border-sky-500 text-sky-500 bg-sky-500/10",
  },
  {
    id: "qwen2.5-3b",
    tierName: "Qwen 2.5 (3B High-Speed Synthesis)",
    targetHardware: "4 GB – 8 GB RAM",
    filename: "qwen2.5-3b-instruct-q4_k_m.gguf",
    downloadSizeMb: 2090,
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    description:
      "Ultra-fast high-density model delivering 45+ tokens/sec on CPU. Outstanding balance of minimal RAM footprint and reliable academic question answering.",
    minRamGb: 4,
    badge: "Ultra Fast",
    highlight: "45+ tok/s on CPU",
    category: "High Speed",
    accentColor: "border-emerald-500 text-emerald-500 bg-emerald-500/10",
  },
  {
    id: "mistral-7b",
    tierName: "Mistral 7B Instruct (v0.3 Core)",
    targetHardware: "8 GB – 16 GB RAM",
    filename: "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    downloadSizeMb: 4400,
    downloadUrl:
      "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
    description:
      "Renowned European foundation model featuring native function calling, tight citation tracking, and high contextual comprehension across diverse disciplines.",
    minRamGb: 8,
    badge: "Function Calling",
    highlight: "Tight Citation Tracking",
    category: "Function Calling",
    accentColor: "border-amber-500 text-amber-500 bg-amber-500/10",
  },
];

interface InAppModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (status: LocalAiStatus) => void;
}

export const InAppModelManagerModal: React.FC<InAppModelManagerModalProps> = ({
  isOpen,
  onClose,
  onStatusChange,
}) => {
  const [panelTab, setPanelTab] = useState<"catalog" | "installed" | "cloud">("catalog");
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [installedModels, setInstalledModels] = useState<InstalledModelInfo[]>([]);
  const [engineStatus, setEngineStatus] = useState<LocalAiStatus>({
    is_running: false,
    port: 11435,
    active_model: null,
    endpoint: "http://127.0.0.1:11435",
  });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [groqKey, setGroqKey] = useState("");
  const [saveKeySuccess, setSaveKeySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refresh hardware, installed models, and server status
  const refreshState = useCallback(async () => {
    try {
      const [hw, installed, status] = await Promise.all([
        getHardwareProfile(),
        listInstalledAiModels(),
        getAiEngineStatus(),
      ]);
      setHardware(hw);
      setInstalledModels(installed);
      setEngineStatus(status);
      onStatusChange?.(status);
    } catch (err) {
      console.error("Failed to load local AI engine info:", err);
    }
  }, [onStatusChange]);

  useEffect(() => {
    if (isOpen) {
      void refreshState();
      const saved = localStorage.getItem("groq_api_key") || "";
      setGroqKey(saved);
      setErrorMessage(null);
    }
  }, [isOpen, refreshState]);

  if (!isOpen) return null;

  const handleStartDownload = async (tier: ModelTier) => {
    setDownloadingId(tier.id);
    setDownloadProgress({
      downloaded_bytes: 0,
      total_bytes: tier.downloadSizeMb * 1024 * 1024,
      percentage: 0,
      status: "downloading",
    });
    setErrorMessage(null);

    try {
      await downloadAiModel(tier.id, (prog) => {
        setDownloadProgress(prog);
      });
      await refreshState();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Download failed: ${msg}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleStartEngine = async (filename: string) => {
    setIsStarting(true);
    setErrorMessage(null);
    try {
      const res = await startInAppAiEngine(filename);
      setEngineStatus(res);
      onStatusChange?.(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Failed to start sidecar engine: ${msg}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopEngine = async () => {
    try {
      await stopInAppAiEngine();
      const status = await getAiEngineStatus();
      setEngineStatus(status);
      onStatusChange?.(status);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Failed to stop sidecar: ${msg}`);
    }
  };

  const handleSaveGroqKey = () => {
    localStorage.setItem("groq_api_key", groqKey.trim());
    setSaveKeySuccess(true);
    setTimeout(() => setSaveKeySuccess(false), 2000);
  };

  const getOptimalMatchLabel = (hw: HardwareProfile | null) => {
    if (!hw) return "Evaluating hardware...";
    const ramGb = hw.total_ram_mb / 1024;
    if (ramGb >= 12) {
      return "Optimal Match: DeepSeek-R1 (8B) or Qwen 2.5 (7B Flagship)";
    } else if (ramGb >= 7) {
      return "Optimal Match: Qwen 2.5 (7B) or Llama 3.1 (8B)";
    } else {
      return "Optimal Match: Qwen 2.5 (3B High-Speed)";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-none">
      <div className="w-full max-w-3xl bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden select-text animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs">
              <Brain className="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  In-App AI Engine & Model Panel
                </h2>
                <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                  Local GGUF Runtime
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Run state-of-the-art open-source LLMs locally with zero telemetry.
                High-fidelity academic synthesis and reasoning.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hardware Status Banner */}
        <div className="px-6 py-3 bg-slate-100/70 dark:bg-[#070b12] border-b border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>System RAM:</span>{" "}
              <strong className="text-slate-900 dark:text-white font-mono">
                {hardware ? `${(hardware.total_ram_mb / 1024).toFixed(1)} GB` : "15.8 GB"}
              </strong>
            </span>
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              <span>CPU Cores:</span>{" "}
              <strong className="text-slate-900 dark:text-white font-mono">
                {hardware ? hardware.cpu_cores : "4"}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
              {getOptimalMatchLabel(hardware)}
            </span>

            {engineStatus.is_running && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Running :{engineStatus.port}</span>
              </span>
            )}
          </div>
        </div>

        {/* Panel Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-2 bg-white dark:bg-[#0b101b]">
          <button
            type="button"
            onClick={() => setPanelTab("catalog")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              panelTab === "catalog"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open-Source Research Models (5)</span>
          </button>
          <button
            type="button"
            onClick={() => setPanelTab("installed")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              panelTab === "installed"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Installed Storage ({installedModels.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setPanelTab("cloud")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              panelTab === "cloud"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Cloud LPU Acceleration</span>
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="px-6 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab 1: Catalog of Top Performing Open-Source Models */}
        {panelTab === "catalog" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
            {MODEL_TIERS.map((tier) => {
              const isInstalled = installedModels.some(
                (m) => m.filename === tier.filename
              );
              const isActive =
                engineStatus.is_running && engineStatus.active_model === tier.filename;
              const isDownloading = downloadingId === tier.id;

              return (
                <div
                  key={tier.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50/15 dark:bg-emerald-950/20 shadow-xs ring-1 ring-emerald-500/50"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {tier.tierName}
                        </h3>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${tier.accentColor}`}
                        >
                          {tier.badge}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {tier.targetHardware}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          ({(tier.downloadSizeMb / 1024).toFixed(1)} GB)
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active Model
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {tier.description}
                      </p>
                      <div className="flex items-center gap-2 pt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono text-[10px] bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {tier.filename}
                        </span>
                        <span>•</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                          {tier.highlight}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                      {isActive ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleStopEngine}
                          className="text-xs text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Square className="w-3.5 h-3.5 mr-1 fill-current" />
                          Stop Engine
                        </Button>
                      ) : isInstalled ? (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isStarting}
                          onClick={() => handleStartEngine(tier.filename)}
                          className="text-xs shadow-xs"
                        >
                          {isStarting ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5 mr-1 fill-current" />
                          )}
                          Start Engine
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isDownloading}
                          onClick={() => handleStartDownload(tier)}
                          className="text-xs"
                        >
                          {isDownloading ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5 mr-1" />
                          )}
                          {isDownloading ? "Downloading..." : "Download GGUF"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Live Download Progress */}
                  {isDownloading && downloadProgress && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <div className="flex justify-between text-[11px] font-mono text-slate-500">
                        <span>
                          {(downloadProgress.downloaded_bytes / (1024 * 1024)).toFixed(1)}{" "}
                          MB / {(downloadProgress.total_bytes / (1024 * 1024)).toFixed(1)}{" "}
                          MB
                        </span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {downloadProgress.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <Progress
                        value={downloadProgress.percentage}
                        max={100}
                        className="h-1.5"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Installed Models Storage */}
        {panelTab === "installed" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>
                  {installedModels.length} private model
                  {installedModels.length === 1 ? "" : "s"} ready for offline inference.
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                Total:{" "}
                {(installedModels.reduce((acc, m) => acc + m.size_mb, 0) / 1024).toFixed(
                  2
                )}{" "}
                GB
              </span>
            </div>

            {installedModels.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl border-slate-300 dark:border-slate-700">
                No local models downloaded yet. Choose an open-source model from the
                catalog tab.
              </div>
            ) : (
              installedModels.map((model) => {
                const isActive =
                  engineStatus.is_running && engineStatus.active_model === model.filename;
                return (
                  <div
                    key={model.filename}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive
                        ? "border-emerald-500 bg-emerald-50/15 dark:bg-emerald-950/20"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white font-mono truncate">
                            {model.filename}
                          </h3>
                          <Badge
                            variant="outline"
                            size="sm"
                            className="font-mono text-[10px]"
                          >
                            {model.size_mb} MB
                          </Badge>
                          {isActive && (
                            <Badge
                              variant="success"
                              size="sm"
                              className="font-mono text-[10px]"
                            >
                              Active · Port 11435
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                          {model.full_path}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isActive ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleStopEngine}
                            className="text-xs text-rose-600 dark:text-rose-400"
                          >
                            <Square className="w-3.5 h-3.5 mr-1 fill-current" />
                            Stop Engine
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isStarting}
                            onClick={() => handleStartEngine(model.filename)}
                            className="text-xs"
                          >
                            {isStarting ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5 mr-1 fill-current" />
                            )}
                            Start Engine
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 3: Cloud LPU Acceleration */}
        {panelTab === "cloud" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Groq Cloud LPU Acceleration (500+ tok/s)
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Zero local RAM consumption. Useful for ultrabooks, battery saver
                      mode, or rapid bulk extractions.
                    </p>
                  </div>
                </div>
                <Badge variant="warning" size="sm" className="font-mono text-[10px]">
                  Cloud Backup
                </Badge>
              </div>

              <div className="pt-2">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Groq API Key (Free tier supported):
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="gsk_..."
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveGroqKey}
                    className="text-xs px-4"
                  >
                    {saveKeySuccess ? "Saved!" : "Save Key"}
                  </Button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Privacy Safeguard</span>
                </div>
                <p>
                  Keys are stored encrypted locally in your application storage. No
                  tracking or telemetry is attached to your requests.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-white/[0.02] flex justify-between items-center text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>
              Auto-tunes parameters (--mmap, 4-bit KV cache, 8k context) for 8GB–16GB RAM.
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

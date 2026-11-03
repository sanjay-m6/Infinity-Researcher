import React, { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Shield,
  Key,
  Play,
  Terminal,
  Sliders,
} from "lucide-react";
import {
  AiDiagnosticReport,
  DiagnosticTestGenResult,
  ProviderTestResult,
  diagnoseAiSystem,
  testAiGeneration,
  testAiProvider,
  setAiProviderCredential,
  setAiProviderEnabled,
  setAiProviderModel,
} from "../../lib/desktop-api";
import { Button } from "../../components/ui/Button";

export const AiDiagnosticsView: React.FC = () => {
  const [reports, setReports] = useState<AiDiagnosticReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null);
  const [testingGenId, setTestingGenId] = useState<string | null>(null);
  const [genResults, setGenResults] = useState<Record<string, DiagnosticTestGenResult>>(
    {}
  );
  const [connResults, setConnResults] = useState<Record<string, ProviderTestResult>>({});
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [isEditingKey, setIsEditingKey] = useState<Record<string, boolean>>({});
  const [modelInputs, setModelInputs] = useState<Record<string, string>>({});
  const [isEditingModel, setIsEditingModel] = useState<Record<string, boolean>>({});

  const loadDiagnostics = async () => {
    setIsLoading(true);
    try {
      const data = await diagnoseAiSystem();
      setReports(data);
    } catch (err) {
      console.error("Failed to load AI system diagnostics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const handleTestConnection = async (providerId: string) => {
    setTestingConnectionId(providerId);
    try {
      const res = await testAiProvider(providerId);
      setConnResults((prev) => ({ ...prev, [providerId]: res }));
      await loadDiagnostics();
    } catch (err) {
      console.error("Test connection failed:", err);
    } finally {
      setTestingConnectionId(null);
    }
  };

  const handleTestGeneration = async (providerId: string) => {
    setTestingGenId(providerId);
    try {
      const res = await testAiGeneration(providerId);
      setGenResults((prev) => ({ ...prev, [providerId]: res }));
    } catch (err) {
      console.error("Test generation failed:", err);
    } finally {
      setTestingGenId(null);
    }
  };

  const handleSaveKey = async (providerId: string) => {
    const key = apiKeyInputs[providerId]?.trim();
    if (!key) return;
    try {
      await setAiProviderCredential(providerId, key);
      setIsEditingKey((prev) => ({ ...prev, [providerId]: false }));
      setApiKeyInputs((prev) => ({ ...prev, [providerId]: "" }));
      await loadDiagnostics();
    } catch (err) {
      console.error("Failed to save credential:", err);
    }
  };

  const handleSaveModel = async (providerId: string) => {
    const model = modelInputs[providerId]?.trim();
    if (!model) return;
    try {
      await setAiProviderModel(providerId, model);
      setIsEditingModel((prev) => ({ ...prev, [providerId]: false }));
      await loadDiagnostics();
    } catch (err) {
      console.error("Failed to save model:", err);
    }
  };

  const handleToggleEnabled = async (providerId: string, current: boolean) => {
    try {
      await setAiProviderEnabled(providerId, !current);
      await loadDiagnostics();
    } catch (err) {
      console.error("Failed to toggle provider:", err);
    }
  };

  const readyCount = reports.filter((r) => r.is_ready).length;
  const connectedCount = reports.filter(
    (r) => r.connection_status === "connected"
  ).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-white dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-slate-900 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                AI System Reliability & Diagnostics
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inspect model configurations, verify credentials in the local secure vault,
              test live inference, and troubleshoot routing failures.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadDiagnostics}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh Status</span>
            </Button>
          </div>
        </div>

        {/* Quick Health Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900/40 text-xs">
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 block">Total Providers</span>
            <span className="text-base font-bold text-slate-800 dark:text-slate-100">
              {reports.length}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 block">Configured & Ready</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {readyCount}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 block">Active Health Check</span>
            <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
              {connectedCount} Online
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 block">Vault Security</span>
            <span className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-500" /> AES Protected
            </span>
          </div>
        </div>
      </div>

      {/* Troubleshooting Alert If No Provider Ready */}
      {readyCount === 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">
              No AI Provider is currently configured and ready
            </span>
            <p className="text-[11px] leading-relaxed">
              To use the AI Research Assistant, Literature Matrix Copilot, or Project
              Planner, configure an API key for a cloud provider (such as{" "}
              <strong>NVIDIA NIM</strong> or <strong>Google Gemini</strong>) or launch a
              local model server (<strong>Ollama</strong> or <strong>LM Studio</strong>).
            </p>
          </div>
        </div>
      )}

      {/* Provider Matrix Cards */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Configured AI Providers & Inference Endpoints
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((p) => {
            const isConnTesting = testingConnectionId === p.provider_id;
            const isGenTesting = testingGenId === p.provider_id;
            const connRes = connResults[p.provider_id];
            const genRes = genResults[p.provider_id];
            const isEditingThisKey = !!isEditingKey[p.provider_id];
            const isEditingThisModel = !!isEditingModel[p.provider_id];

            return (
              <div
                key={p.provider_id}
                className={`p-4 rounded-xl border bg-white dark:bg-slate-900 shadow-2xs space-y-3.5 transition-all ${
                  p.is_ready
                    ? "border-slate-200 dark:border-slate-800"
                    : "border-slate-200/60 dark:border-slate-800/50 opacity-80"
                }`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {p.display_name}
                      </span>
                      {p.is_local ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          LOCAL
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                          CLOUD
                        </span>
                      )}
                      {p.is_ready ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> READY
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" /> NEEDS SETUP
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 capitalize">
                      {p.access_category.replace(/_/g, " ")} • ID: {p.provider_id}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant={p.is_enabled ? "outline" : "secondary"}
                    size="sm"
                    onClick={() => handleToggleEnabled(p.provider_id, p.is_enabled)}
                    className="text-xs h-7 px-2"
                  >
                    {p.is_enabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                {/* Endpoint & Model Specs */}
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium text-[11px]">Model:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                        {p.selected_model}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingModel((prev) => ({
                            ...prev,
                            [p.provider_id]: !prev[p.provider_id],
                          }));
                          setModelInputs((prev) => ({
                            ...prev,
                            [p.provider_id]: p.selected_model,
                          }));
                        }}
                        className="text-slate-400 hover:text-indigo-600 p-0.5 rounded"
                        title="Change model identifier"
                      >
                        <Sliders className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {isEditingThisModel && (
                    <div className="flex gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700">
                      <input
                        type="text"
                        value={modelInputs[p.provider_id] || ""}
                        onChange={(e) =>
                          setModelInputs({
                            ...modelInputs,
                            [p.provider_id]: e.target.value,
                          })
                        }
                        placeholder="Model ID (e.g. mistralai/mistral-large-4-1t-a52b)"
                        className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-slate-900 dark:text-slate-100"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => handleSaveModel(p.provider_id)}
                        className="text-xs px-2.5 h-6"
                      >
                        Save
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center justify-between truncate">
                    <span className="text-slate-500 text-[11px]">Endpoint:</span>
                    <span className="font-mono text-[11px] truncate max-w-[210px] text-slate-600 dark:text-slate-400">
                      {p.endpoint_url}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Vault Credential:</span>
                    {p.has_credential ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <Key className="w-3 h-3" /> Saved in Vault
                      </span>
                    ) : (
                      <span className="text-rose-500 font-medium flex items-center gap-1">
                        <Key className="w-3 h-3" /> Missing Key
                      </span>
                    )}
                  </div>
                </div>

                {/* API Key Form for Cloud Providers */}
                {!p.is_local && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-slate-500">
                        API Key / Token:
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setIsEditingKey((prev) => ({
                            ...prev,
                            [p.provider_id]: !prev[p.provider_id],
                          }))
                        }
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {isEditingThisKey
                          ? "Cancel"
                          : p.has_credential
                            ? "Update Key"
                            : "Add Key"}
                      </button>
                    </div>

                    {isEditingThisKey ? (
                      <div className="flex gap-1.5">
                        <input
                          type="password"
                          placeholder="Enter new API key"
                          value={apiKeyInputs[p.provider_id] || ""}
                          onChange={(e) =>
                            setApiKeyInputs({
                              ...apiKeyInputs,
                              [p.provider_id]: e.target.value,
                            })
                          }
                          className="flex-1 px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => handleSaveKey(p.provider_id)}
                          className="text-xs px-2.5"
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 font-mono">
                        {p.has_credential
                          ? "••••••••••••••••••••••••"
                          : "No credential entered"}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isConnTesting}
                    onClick={() => handleTestConnection(p.provider_id)}
                    className="flex-1 text-xs flex items-center justify-center gap-1.5"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>{isConnTesting ? "Probing..." : "Test Connection"}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isGenTesting || !p.is_ready}
                    onClick={() => handleTestGeneration(p.provider_id)}
                    className="flex-1 text-xs flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isGenTesting ? "Generating..." : "Test Generation"}</span>
                  </Button>
                </div>

                {/* Connection Probe Outcome */}
                {connRes && (
                  <div
                    className={`p-2.5 rounded-lg text-xs space-y-1 border ${
                      connRes.success
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>
                        {connRes.success ? "Probe Successful" : "Connection Failed"}
                      </span>
                      <span>{connRes.latency_ms} ms</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{connRes.message}</p>
                  </div>
                )}

                {/* Generation Test Outcome */}
                {genRes && (
                  <div
                    className={`p-2.5 rounded-lg text-xs space-y-1.5 border ${
                      genRes.success
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800"
                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>
                        {genRes.success ? "Inference Verified" : "Generation Error"}
                      </span>
                      <span className="font-mono text-[10px]">
                        {genRes.latency_ms} ms
                      </span>
                    </div>
                    {genRes.response_text && (
                      <p className="p-2 rounded bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                        {genRes.response_text}
                      </p>
                    )}
                    {genRes.error_message && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">
                        {genRes.error_message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

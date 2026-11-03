import React, { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Trash2,
  Upload,
  Layers,
} from "lucide-react";
import {
  loadSavedLicense,
  saveLicense,
  clearSavedLicense,
  validateLicense,
  generateDiagnosticReport,
} from "./licensing-service";
import { LicenseValidationResult, SignedLicense } from "./types";
import { getErrorMessage } from "../../lib/desktop-api";

export interface LicenseSettingsCardProps {
  appVersion?: string;
  osPlatform?: string;
}

export const LicenseSettingsCard: React.FC<LicenseSettingsCardProps> = ({
  appVersion = "0.1.0",
  osPlatform = "Windows 10/11 x64",
}) => {
  const [result, setResult] = useState<LicenseValidationResult>({
    valid: true,
    tier: "community",
    status: "community_default",
    entitlements: [],
  });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [licenseInputText, setLicenseInputText] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  const refreshLicenseStatus = async () => {
    const saved = loadSavedLicense();
    const res = await validateLicense(saved);
    setResult(res);
  };

  useEffect(() => {
    refreshLicenseStatus();
  }, []);

  const handleApplyLicense = async () => {
    setInputError(null);
    try {
      const parsed = JSON.parse(licenseInputText.trim());
      if (!parsed.payload || !parsed.signature) {
        throw new Error(
          'Invalid format: Signed license must contain "payload" and "signature" fields.'
        );
      }
      const validation = await validateLicense(parsed as SignedLicense);
      if (!validation.valid && validation.status !== "expired") {
        throw new Error(
          validation.errorMessage || "Failed to validate cryptographic license signature."
        );
      }
      saveLicense(parsed as SignedLicense);
      setResult(validation);
      setIsImportModalOpen(false);
      setLicenseInputText("");
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Invalid license JSON format.");
      setInputError(msg);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setLicenseInputText(text);
      try {
        const parsed = JSON.parse(text);
        const validation = await validateLicense(parsed as SignedLicense);
        if (validation.valid) {
          saveLicense(parsed as SignedLicense);
          setResult(validation);
          setIsImportModalOpen(false);
        } else {
          setInputError(validation.errorMessage || "Invalid license content.");
        }
      } catch {
        setInputError("Could not parse license file as JSON.");
      }
    };
    reader.readAsText(file);
  };

  const handleDeactivate = () => {
    clearSavedLicense();
    refreshLicenseStatus();
  };

  const handleCopyReport = () => {
    const report = generateDiagnosticReport(
      {
        appVersion,
        osPlatform,
      },
      result
    );
    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const tierBadgeVariant = (tier: string) => {
    switch (tier) {
      case "enterprise":
      case "pro":
        return "primary";
      case "trial":
        return "warning";
      default:
        return "outline";
    }
  };

  return (
    <section
      aria-label="Software Licensing & Tiers"
      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary-500" />
              Software Licensing & Feature Entitlements
            </h3>
            <Badge variant={tierBadgeVariant(result.tier)} size="sm">
              {result.tier.toUpperCase()} EDITION
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Offline cryptographic verification using Ed25519 public-key signatures.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {result.license ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeactivate}
              className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30"
              title="Deactivate license and return to Community edition"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Deactivate
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Activate License
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyReport}
            title="Copy redacted diagnostic report for support"
            className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            {copiedReport ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Diagnostic Report
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Validation Alert (if invalid/tampered/expired) */}
      {!result.valid && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              License Status: {result.status.replace(/_/g, " ").toUpperCase()}
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {result.errorMessage ||
                "The current license could not be validated. Premium entitlements are disabled."}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Data Guarantee: Your saved research papers, notes, PDFs, and local SQLite
              library remain 100% accessible.
            </p>
          </div>
        </div>
      )}

      {/* Active License Details Card */}
      {result.license && result.valid && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">License ID</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
              {result.license.payload.licenseId}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Licensee</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {result.license.payload.customer?.name || "Authorized Scholar"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Key Fingerprint</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-200">
              {result.license.payload.keyId}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Expiration</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {result.license.payload.expiresAt
                ? new Date(result.license.payload.expiresAt).toLocaleDateString()
                : "Perpetual (No Expiration)"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Organization</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {result.license.payload.customer?.organization || "Individual Researcher"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Signature Cryptographically Verified
          </div>
        </div>
      )}

      {/* Entitlements Grid */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          Feature Entitlements
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Local Library & SQLite WAL Storage
            </span>
            <Badge variant="success" size="sm">
              Always Included
            </Badge>
          </div>
          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Multi-Source Paper Discovery (7 Engines)
            </span>
            <Badge variant="success" size="sm">
              Always Included
            </Badge>
          </div>
          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Batch Synthesis & Deep Matrix
            </span>
            {result.entitlements.includes("feature:batch_synthesis") ||
            result.tier === "pro" ||
            result.tier === "enterprise" ? (
              <Badge variant="primary" size="sm">
                Unlocked
              </Badge>
            ) : (
              <Badge variant="outline" size="sm">
                Pro Tier
              </Badge>
            )}
          </div>
          <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Automated Integrity & Retraction Auditing
            </span>
            {result.entitlements.includes("feature:deep_integrity_audit") ||
            result.tier === "pro" ||
            result.tier === "enterprise" ? (
              <Badge variant="primary" size="sm">
                Unlocked
              </Badge>
            ) : (
              <Badge variant="outline" size="sm">
                Pro Tier
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Offline Guarantee Footer */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span>
          Infinity Researcher operates completely offline. No telemetry, account tracking,
          or periodic server phone-homes are required.
        </span>
      </div>

      {/* Modal for importing/entering license */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary-500" />
                Activate Infinity Researcher License
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Paste your signed license JSON payload or import an offline license file (
              <code className="font-mono">.lic</code> /{" "}
              <code className="font-mono">.json</code>).
            </p>

            <div className="space-y-2">
              <textarea
                value={licenseInputText}
                onChange={(e) => setLicenseInputText(e.target.value)}
                placeholder='{\n  "payload": { ... },\n  "signature": "..."\n}'
                rows={6}
                className="w-full font-mono text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />

              {inputError && (
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {inputError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium">
                <Upload className="w-3.5 h-3.5" />
                <span>Import from file...</span>
                <input
                  type="file"
                  accept=".json,.lic"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApplyLicense}
                  disabled={!licenseInputText.trim()}
                >
                  Verify & Activate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

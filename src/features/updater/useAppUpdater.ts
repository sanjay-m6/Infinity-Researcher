/**
 * Infinity Researcher — In-App Updater Service Hook
 * Integrates with official Tauri v2 @tauri-apps/plugin-updater & @tauri-apps/plugin-process.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getErrorMessage } from "../../lib/desktop-api";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

export interface UpdateDetails {
  version: string;
  body?: string;
  date?: string;
  downloadUrl?: string;
  isExternalDownload?: boolean;
}

export interface UseAppUpdaterReturn {
  status: UpdateStatus;
  updateInfo: UpdateDetails | null;
  progress: UpdateProgress | null;
  errorMessage: string | null;
  lastChecked: string | null;
  autoCheckEnabled: boolean;
  channel: "stable" | "beta";
  isTauri: boolean;
  checkForUpdates: (force?: boolean) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  restartToApply: () => Promise<void>;
  dismissUpdate: () => void;
  setAutoCheckEnabled: (enabled: boolean) => void;
  setChannel: (channel: "stable" | "beta") => void;
}

const STORAGE_LAST_CHECKED = "infinity_updater_last_checked";
const STORAGE_DISMISSED_VER = "infinity_updater_dismissed_version";
const STORAGE_AUTO_CHECK = "infinity_updater_auto_check";
const STORAGE_CHANNEL = "infinity_updater_channel";

function isNewerVersion(remoteVer: string, currentVer: string): boolean {
  const parseParts = (v: string) =>
    v.replace(/^v/, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  const r = parseParts(remoteVer);
  const c = parseParts(currentVer);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rVal = r[i] || 0;
    const cVal = c[i] || 0;
    if (rVal > cVal) return true;
    if (rVal < cVal) return false;
  }
  return false;
}

export function useAppUpdater(currentVersion = "0.1.2"): UseAppUpdaterReturn {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateDetails | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(() => {
    return typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_LAST_CHECKED)
      : null;
  });

  const [autoCheckEnabled, setAutoCheckState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem(STORAGE_AUTO_CHECK);
    return saved === null ? true : saved === "true";
  });

  const [channel, setChannelState] = useState<"stable" | "beta">(() => {
    if (typeof window === "undefined") return "stable";
    const saved = localStorage.getItem(STORAGE_CHANNEL);
    return saved === "beta" ? "beta" : "stable";
  });

  const updateRef = useRef<Update | null>(null);
  const isCheckingRef = useRef<boolean>(false);
  const statusRef = useRef<UpdateStatus>(status);
  statusRef.current = status;
  const hasAutoCheckedRef = useRef<boolean>(false);

  const isTauri =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

  const setAutoCheckEnabled = (enabled: boolean) => {
    setAutoCheckState(enabled);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_AUTO_CHECK, String(enabled));
    }
  };

  const setChannel = (newChannel: "stable" | "beta") => {
    setChannelState(newChannel);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_CHANNEL, newChannel);
    }
  };

  const dismissUpdate = () => {
    if (updateInfo?.version && typeof window !== "undefined") {
      const payload = JSON.stringify({
        version: updateInfo.version,
        timestamp: Date.now(),
      });
      localStorage.setItem(STORAGE_DISMISSED_VER, payload);
    }
    setStatus("idle");
    setUpdateInfo(null);
  };

  const checkForUpdates = useCallback(
    async (force = false) => {
      // Guard against concurrent executions
      if (isCheckingRef.current || statusRef.current === "downloading") return;

      isCheckingRef.current = true;
      setStatus("checking");
      setErrorMessage(null);

      const nowStr = new Date().toLocaleString();
      setLastChecked(nowStr);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_LAST_CHECKED, nowStr);
      }

      try {
        if (!isTauri) {
          // In browser preview / test environment, mark up-to-date safely
          setStatus("up-to-date");
          return;
        }

        // Step 1: Try native Tauri updater plugin with explicit headers and timeout
        try {
          const update = await check({
            headers: {
              "User-Agent": "Infinity-Researcher-Desktop",
              Accept: "application/json",
            },
            timeout: 15000,
          });

          if (update && update.available) {
            // Check if previously dismissed
            if (!force && typeof window !== "undefined") {
              const raw = localStorage.getItem(STORAGE_DISMISSED_VER);
              if (raw) {
                try {
                  const parsed = JSON.parse(raw);
                  if (parsed.version === update.version) {
                    const ONE_DAY = 24 * 60 * 60 * 1000;
                    if (Date.now() - parsed.timestamp < ONE_DAY) {
                      setStatus("idle");
                      return;
                    }
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }

            updateRef.current = update;
            setUpdateInfo({
              version: update.version,
              body: update.body,
              date: update.date,
            });
            setStatus("available");
            return;
          } else if (update && !update.available) {
            updateRef.current = null;
            setUpdateInfo(null);
            setStatus("up-to-date");
            return;
          }
        } catch (tauriErr) {
          console.warn("Tauri native updater check failed, trying fallback:", tauriErr);
          // Fall through to resilient fallback!
        }

        // Step 2: Fallback Web Fetch — checks raw GitHub latest.json or GitHub Releases API
        try {
          let releaseData: {
            tag_name?: string;
            name?: string;
            body?: string;
            published_at?: string;
            html_url?: string;
            assets?: Array<{ name: string; browser_download_url: string }>;
          } | null = null;

          // Try raw GitHub latest.json first (fast, direct, no redirects)
          try {
            const rawManifestRes = await fetch(
              "https://raw.githubusercontent.com/sanjay-m6/Infinity-Researcher/main/latest.json",
              {
                headers: { Accept: "application/json" },
                cache: "no-store",
              }
            );
            if (rawManifestRes.ok) {
              const manifest = await rawManifestRes.json();
              if (manifest && manifest.version) {
                releaseData = {
                  tag_name: manifest.version,
                  body: manifest.notes,
                  published_at: manifest.pub_date,
                  html_url: "https://github.com/sanjay-m6/Infinity-Researcher/releases/latest",
                };
              }
            }
          } catch {
            // Fall through to GitHub Releases API
          }

          // Try GitHub Releases API if raw manifest was unavailable
          if (!releaseData) {
            const apiRes = await fetch(
              "https://api.github.com/repos/sanjay-m6/Infinity-Researcher/releases/latest",
              {
                headers: {
                  Accept: "application/vnd.github.v3+json",
                  "User-Agent": "Infinity-Researcher",
                },
                cache: "no-store",
              }
            );
            if (apiRes.ok) {
              releaseData = await apiRes.json();
            }
          }

          if (releaseData && releaseData.tag_name) {
            const remoteVersion = releaseData.tag_name.replace(/^v/, "");
            const currentVer = (currentVersion || "0.1.1").replace(/^v/, "");

            if (isNewerVersion(remoteVersion, currentVer)) {
              // Find platform-specific installer
              let directUrl =
                releaseData.html_url ||
                "https://github.com/sanjay-m6/Infinity-Researcher/releases/latest";
              if (Array.isArray(releaseData.assets)) {
                const setupAsset = releaseData.assets.find(
                  (a) =>
                    a.name.toLowerCase().endsWith("-setup.exe") ||
                    a.name.toLowerCase().endsWith(".exe") ||
                    a.name.toLowerCase().endsWith(".msi") ||
                    a.name.toLowerCase().endsWith(".dmg") ||
                    a.name.toLowerCase().endsWith(".appimage")
                );
                if (setupAsset) {
                  directUrl = setupAsset.browser_download_url;
                }
              }

              updateRef.current = null;
              setUpdateInfo({
                version: releaseData.tag_name.replace(/^v/, ""),
                body: releaseData.body,
                date: releaseData.published_at,
                downloadUrl: directUrl,
                isExternalDownload: true,
              });
              setStatus("available");
              return;
            } else {
              updateRef.current = null;
              setUpdateInfo(null);
              setStatus("up-to-date");
              return;
            }
          }
        } catch (fallbackErr) {
          console.warn("Fallback update check failed:", fallbackErr);
        }

        // Only set error if both native updater and fallback checks could not reach the server
        setErrorMessage(
          "Could not reach update server. Check your network or download directly from GitHub."
        );
        setStatus("error");
      } finally {
        isCheckingRef.current = false;
      }
    },
    [isTauri, currentVersion]
  );

  const downloadAndInstall = useCallback(async () => {
    if (updateInfo?.isExternalDownload && updateInfo.downloadUrl) {
      if (typeof window !== "undefined") {
        window.open(updateInfo.downloadUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (!updateRef.current) {
      setErrorMessage("No update payload available to install.");
      setStatus("error");
      return;
    }

    setStatus("downloading");
    setErrorMessage(null);
    setProgress({ downloaded: 0, total: 0, percentage: 0 });

    try {
      let totalBytes = 0;
      let downloadedBytes = 0;

      await updateRef.current.downloadAndInstall((event) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength || 0;
          setProgress({
            downloaded: 0,
            total: totalBytes,
            percentage: 0,
          });
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          const percentage =
            totalBytes > 0
              ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
              : 0;
          setProgress({
            downloaded: downloadedBytes,
            total: totalBytes,
            percentage,
          });
        } else if (event.event === "Finished") {
          setProgress({
            downloaded: totalBytes,
            total: totalBytes,
            percentage: 100,
          });
        }
      });

      setStatus("downloaded");
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to download and apply update.");
      setErrorMessage(msg);
      setStatus("error");
    }
  }, []);

  const restartToApply = useCallback(async () => {
    try {
      await relaunch();
    } catch (err: unknown) {
      const msg = getErrorMessage(
        err,
        "Unable to automatically restart. Please restart the app manually."
      );
      setErrorMessage(msg);
      setStatus("error");
    }
  }, []);

  // Run auto-check once on mount if enabled
  useEffect(() => {
    if (autoCheckEnabled && !hasAutoCheckedRef.current) {
      hasAutoCheckedRef.current = true;
      const timer = setTimeout(() => {
        void checkForUpdates(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [autoCheckEnabled, checkForUpdates]);

  return {
    status,
    updateInfo,
    progress,
    errorMessage,
    lastChecked,
    autoCheckEnabled,
    channel,
    isTauri,
    checkForUpdates,
    downloadAndInstall,
    restartToApply,
    dismissUpdate,
    setAutoCheckEnabled,
    setChannel,
  };
}

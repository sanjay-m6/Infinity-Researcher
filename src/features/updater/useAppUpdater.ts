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

export function useAppUpdater(): UseAppUpdaterReturn {
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

      try {
        if (!isTauri) {
          // Graceful browser / test environment behavior
          await new Promise((r) => setTimeout(r, 600));
          const nowStr = new Date().toLocaleString();
          setLastChecked(nowStr);
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_LAST_CHECKED, nowStr);
          }
          setStatus("up-to-date");
          return;
        }

        const update = await check();
        const nowStr = new Date().toLocaleString();
        setLastChecked(nowStr);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_LAST_CHECKED, nowStr);
        }

        if (update && update.available) {
          // Check if previously dismissed
          if (!force && typeof window !== "undefined") {
            const raw = localStorage.getItem(STORAGE_DISMISSED_VER);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed.version === update.version) {
                  // If dismissed in the last 24 hours and not forced, remain idle
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
        } else {
          updateRef.current = null;
          setUpdateInfo(null);
          setStatus("up-to-date");
        }
      } catch (err: unknown) {
        updateRef.current = null;
        let msg = getErrorMessage(
          err,
          "Failed to connect to the update server. Please check your network."
        );
        if (
          msg.toLowerCase().includes("status code") ||
          msg.toLowerCase().includes("endpoint did not respond") ||
          msg.includes("404")
        ) {
          msg = "No release payload found on the update server (404 Not Found).";
        }
        setErrorMessage(msg);
        setStatus("error");
      } finally {
        isCheckingRef.current = false;
      }
    },
    [isTauri]
  );

  const downloadAndInstall = useCallback(async () => {
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

import { invoke } from "@tauri-apps/api/core";
import { CommandError, HealthResponse } from "../types/health";

/**
 * Checks if the application is currently running inside the Tauri native desktop window.
 */
export function isTauriEnvironment(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  // Tauri 2 injects __TAURI_INTERNALS__ or __TAURI__ on the window object
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

/**
 * Safely parses any error returned across the Tauri IPC boundary into a typed CommandError.
 */
export function normalizeCommandError(error: unknown): CommandError {
  if (typeof error === "object" && error !== null) {
    const candidate = error as Partial<CommandError>;
    if (typeof candidate.code === "string" && typeof candidate.message === "string") {
      return {
        code: candidate.code,
        message: candidate.message,
        retryable: Boolean(candidate.retryable),
      };
    }
  }

  if (typeof error === "string") {
    return {
      code: "ERR_COMMAND",
      message: error,
      retryable: true,
    };
  }

  if (error instanceof Error) {
    return {
      code: "ERR_EXCEPTION",
      message: error.message,
      retryable: true,
    };
  }

  return {
    code: "ERR_UNKNOWN",
    message: "An unknown error occurred while communicating with the native backend.",
    retryable: true,
  };
}

/**
 * Extracts a human-readable error message string from any error object, CommandError, or exception.
 * Guarantees that "[object Object]" is NEVER returned to the user interface.
 */
export function getErrorMessage(
  error: unknown,
  fallbackMessage = "An unexpected error occurred."
): string {
  if (!error) return fallbackMessage;
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : fallbackMessage;
  }
  if (error instanceof Error) {
    const msg = error.message.trim();
    return msg && msg !== "[object Object]" ? msg : fallbackMessage;
  }
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (
      typeof obj.message === "string" &&
      obj.message.trim() &&
      obj.message.trim() !== "[object Object]"
    ) {
      return obj.message.trim();
    }
    if (
      typeof obj.error === "string" &&
      obj.error.trim() &&
      obj.error.trim() !== "[object Object]"
    ) {
      return obj.error.trim();
    }
    if (
      typeof obj.reason === "string" &&
      obj.reason.trim() &&
      obj.reason.trim() !== "[object Object]"
    ) {
      return obj.reason.trim();
    }
    if (
      typeof obj.details === "string" &&
      obj.details.trim() &&
      obj.details.trim() !== "[object Object]"
    ) {
      return obj.details.trim();
    }
  }
  return fallbackMessage;
}

/**
 * Invokes the Rust app_health command to probe backend status and subsystem states.
 */
export async function getAppHealth(): Promise<HealthResponse> {
  if (!isTauriEnvironment()) {
    throw {
      code: "ERR_RUNTIME_UNAVAILABLE",
      message:
        "Desktop runtime unavailable. You are viewing this page in a web browser without Tauri native IPC.",
      retryable: false,
    } as CommandError;
  }

  try {
    return await invoke<HealthResponse>("app_health");
  } catch (err) {
    throw normalizeCommandError(err);
  }
}

/**
 * Invokes the Rust app_ping command for round-trip latency checks.
 */
export async function pingBackend(): Promise<string> {
  if (!isTauriEnvironment()) {
    throw {
      code: "ERR_RUNTIME_UNAVAILABLE",
      message: "Desktop runtime unavailable.",
      retryable: false,
    } as CommandError;
  }

  try {
    return await invoke<string>("app_ping");
  } catch (err) {
    throw normalizeCommandError(err);
  }
}

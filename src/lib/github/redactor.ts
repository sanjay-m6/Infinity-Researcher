/**
 * Strict privacy-conscious redaction engine for system diagnostics and logs.
 * Guarantees that personal tokens, API keys, file paths, and email addresses are sanitized
 * before ever reaching a GitHub issue payload.
 */

const GITHUB_TOKEN_REGEX = /(ghp|github_pat|gho|ghs|ghu)_[a-zA-Z0-9_]{20,}/g;
const GENERIC_API_KEY_REGEX = /(sk-[a-zA-Z0-9_-]{20,})/g;
const BEARER_AUTH_REGEX = /Bearer\s+[a-zA-Z0-9_.-]{16,}/gi;
const AUTH_HEADER_REGEX = /Authorization:\s*[^\r\n]+/gi;
const WINDOWS_USER_DIR_REGEX = /[a-zA-Z]:\\[Uu]sers\\[^\\]+/g;
const UNIX_USER_DIR_REGEX = /\/(home|Users)\/[a-zA-Z0-9_.-]+/g;
const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;

const MAX_DIAGNOSTIC_LINES = 60;
const MAX_DIAGNOSTIC_BYTES = 12 * 1024; // 12 KB limit

export function redactDiagnostics(raw: string): string {
  if (!raw) return "";

  let sanitized = raw;

  // 1. Redact GitHub personal access tokens and OAuth tokens
  sanitized = sanitized.replace(GITHUB_TOKEN_REGEX, "[REDACTED_GH_TOKEN]");

  // 2. Redact common AI provider keys (OpenAI, Anthropic, etc.)
  sanitized = sanitized.replace(GENERIC_API_KEY_REGEX, "[REDACTED_API_KEY]");

  // 3. Redact Bearer tokens & Authorization headers
  sanitized = sanitized.replace(BEARER_AUTH_REGEX, "Bearer [REDACTED_AUTH_TOKEN]");
  sanitized = sanitized.replace(AUTH_HEADER_REGEX, "Authorization: [REDACTED_AUTH_HEADER]");

  // 4. Sanitize user profile directories in paths
  sanitized = sanitized.replace(WINDOWS_USER_DIR_REGEX, "C:\\Users\\<user>");
  sanitized = sanitized.replace(UNIX_USER_DIR_REGEX, "/Users/<user>");

  // 5. Sanitize email addresses
  sanitized = sanitized.replace(EMAIL_REGEX, "<redacted-email>");

  // 6. Cap lines and byte limits
  const lines = sanitized.split(/\r?\n/);
  if (lines.length > MAX_DIAGNOSTIC_LINES) {
    const truncated = lines.slice(lines.length - MAX_DIAGNOSTIC_LINES);
    sanitized = `[... earlier logs truncated ...]\n` + truncated.join("\n");
  }

  if (sanitized.length > MAX_DIAGNOSTIC_BYTES) {
    sanitized = sanitized.slice(0, MAX_DIAGNOSTIC_BYTES) + "\n[... truncated at byte limit ...]";
  }

  return sanitized.trim();
}

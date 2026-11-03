/**
 * Infinity Researcher — Offline Cryptographic Licensing Service
 * Validates Ed25519-signed offline licenses, manages license lifecycle,
 * and maintains fail-closed entitlement access without ever blocking local papers.
 */

import type {
  SignedLicense,
  LicenseValidationResult,
  DiagnosticReportOptions,
} from "./types";

export const TRUSTED_PUBLIC_KEYS: Record<string, string> = {
  // Production verification key for Infinity Researcher 2026 releases
  "ir-pubkey-2026": "e68689321226181074f999df5781e265a780ad2aeb26c0fe6c10b480985f01ba",
};

export const PRODUCT_ID = "infinity-researcher";
const STORAGE_KEY = "infinity_researcher_license";

/**
 * Deterministically serialize a license payload into canonical JSON.
 * Sorts all object keys lexicographically to ensure signature reproducibility.
 */
export function canonicalizePayload(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalizePayload).join(",") + "]";
  }
  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const pairs = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${canonicalizePayload(record[k])}`
  );
  return "{" + pairs.join(",") + "}";
}

/**
 * Convert hex string to Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Verify an Ed25519 signature over canonical payload bytes using WebCrypto.
 */
export async function verifySignature(
  publicKeyHex: string,
  signatureHex: string,
  dataString: string
): Promise<boolean> {
  try {
    const rawPublicKey = hexToBytes(publicKeyHex);
    const signatureBytes = hexToBytes(signatureHex);
    const dataBytes = new TextEncoder().encode(dataString);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      rawPublicKey as unknown as BufferSource,
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      { name: "Ed25519" },
      cryptoKey,
      signatureBytes as unknown as BufferSource,
      dataBytes as unknown as BufferSource
    );
  } catch (err) {
    console.warn("[Licensing] Cryptographic verification failed:", err);
    return false;
  }
}

/**
 * Validate a signed license against product rules, validity dates, and public keys.
 */
export async function validateLicense(
  signedLicense: SignedLicense | null | undefined
): Promise<LicenseValidationResult> {
  // Default Community fallback
  if (!signedLicense || !signedLicense.payload) {
    return {
      valid: true,
      tier: "community",
      status: "community_default",
      entitlements: [],
    };
  }

  const { payload, signature } = signedLicense;

  // 1. Schema check
  if (payload.schemaVersion !== 1) {
    return {
      valid: false,
      tier: "community",
      status: "unsupported_schema",
      errorMessage: `Unsupported license schema version: ${payload.schemaVersion}. Please upgrade Infinity Researcher.`,
      entitlements: [],
    };
  }

  // 2. Product ID check
  if (payload.productId !== PRODUCT_ID) {
    return {
      valid: false,
      tier: "community",
      status: "product_mismatch",
      errorMessage: `License product identifier mismatch: expected "${PRODUCT_ID}", found "${payload.productId}".`,
      entitlements: [],
    };
  }

  // 3. Key ID check
  const publicKeyHex = TRUSTED_PUBLIC_KEYS[payload.keyId];
  if (!publicKeyHex) {
    return {
      valid: false,
      tier: "community",
      status: "unknown_key",
      errorMessage: `License was signed by unknown or retired key "${payload.keyId}".`,
      entitlements: [],
    };
  }

  // 4. Temporal checks
  const nowMs = Date.now();
  const issuedAtMs = Date.parse(payload.issuedAt);
  // Allow 5 minutes clock skew
  if (!isNaN(issuedAtMs) && issuedAtMs > nowMs + 5 * 60 * 1000) {
    return {
      valid: false,
      tier: "community",
      status: "not_yet_valid",
      errorMessage: `License is not valid yet (issued: ${payload.issuedAt}).`,
      entitlements: [],
    };
  }

  if (payload.expiresAt) {
    const expiresAtMs = Date.parse(payload.expiresAt);
    if (!isNaN(expiresAtMs) && nowMs > expiresAtMs) {
      return {
        valid: false,
        tier: "community",
        status: "expired",
        errorMessage: `License expired on ${payload.expiresAt}. Reverted to Community edition.`,
        license: signedLicense,
        entitlements: [],
      };
    }
  }

  // 5. Cryptographic signature check
  const canonicalData = canonicalizePayload(payload);
  const isSignatureValid = await verifySignature(publicKeyHex, signature, canonicalData);

  if (!isSignatureValid) {
    return {
      valid: false,
      tier: "community",
      status: "invalid_signature",
      errorMessage: "Invalid cryptographic signature or tampered license payload.",
      entitlements: [],
    };
  }

  // All checks passed
  return {
    valid: true,
    tier: payload.tier,
    status: "valid",
    license: signedLicense,
    entitlements: Array.isArray(payload.entitlements) ? payload.entitlements : [],
  };
}

/**
 * Load current signed license from local storage.
 */
export function loadSavedLicense(): SignedLicense | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SignedLicense;
  } catch (err) {
    console.warn("[Licensing] Failed to read stored license:", err);
    return null;
  }
}

/**
 * Save signed license to local storage.
 */
export function saveLicense(signedLicense: SignedLicense): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(signedLicense));
}

/**
 * Remove saved license (deactivate) and return to Community.
 */
export function clearSavedLicense(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Redact sensitive customer details for privacy in diagnostic reports.
 */
function redactString(val: string): string {
  if (!val || val.length <= 4) return "***";
  return val.substring(0, 2) + "***" + val.substring(val.length - 2);
}

function redactEmail(email?: string): string {
  if (!email || !email.includes("@")) return "N/A";
  const [local, domain] = email.split("@");
  return `${local.substring(0, 2)}***@${domain}`;
}

/**
 * Generate a privacy-conscious support diagnostic report.
 * Guaranteed zero secret leaks, zero document content leaks.
 */
export function generateDiagnosticReport(
  options: DiagnosticReportOptions,
  result: LicenseValidationResult
): string {
  const timestamp = new Date().toISOString();
  const customer = result.license?.payload.customer;

  return [
    "================================================================",
    "       INFINITY RESEARCHER — SUPPORT DIAGNOSTIC REPORT         ",
    "================================================================",
    `Timestamp:        ${timestamp}`,
    `Application:      Infinity Researcher v${options.appVersion}`,
    `OS Target:        ${options.osPlatform}`,
    `Data Directory:   ${options.storagePath || "%APPDATA%\\com.infinitywebtechnology.infinityresearcher"}`,
    "----------------------------------------------------------------",
    "LICENSING STATUS:",
    `  Active Tier:    ${result.tier.toUpperCase()}`,
    `  Status:         ${result.status}`,
    `  Valid:          ${result.valid ? "YES" : "NO"}`,
    result.errorMessage ? `  Notice:         ${result.errorMessage}` : null,
    "----------------------------------------------------------------",
    "LICENSE DETAILS (IF ACTIVATED):",
    `  License ID:     ${result.license?.payload.licenseId || "N/A (Community Mode)"}`,
    `  Key ID:         ${result.license?.payload.keyId || "N/A"}`,
    `  Issued At:      ${result.license?.payload.issuedAt || "N/A"}`,
    `  Expires At:     ${result.license?.payload.expiresAt || "Perpetual / N/A"}`,
    `  Licensee:       ${customer ? redactString(customer.name) : "N/A"}`,
    `  Contact:        ${customer?.email ? redactEmail(customer.email) : "N/A"}`,
    `  Organization:   ${customer?.organization ? redactString(customer.organization) : "N/A"}`,
    "----------------------------------------------------------------",
    "ACTIVE ENTITLEMENTS:",
    result.entitlements.length > 0
      ? result.entitlements.map((e) => `  * ${e}`).join("\n")
      : "  (Community feature set: local library, paper discovery, SQLite WAL)",
    "================================================================",
    "CONFIDENTIALITY: All secrets, private keys, API credentials, and",
    "scholarly paper contents have been completely excluded or redacted.",
    "================================================================",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Infinity Researcher — Licensing System Types
 * Defines data structures for cryptographic offline license verification,
 * tiers, feature entitlements, and diagnostic reporting.
 */

export type LicenseTier = 'community' | 'pro' | 'trial' | 'enterprise';

export type FeatureEntitlement =
  | 'feature:batch_synthesis'
  | 'feature:advanced_export'
  | 'feature:priority_crawling'
  | 'feature:unlimited_corpus'
  | 'feature:deep_integrity_audit'
  | 'feature:custom_llm_endpoints';

export interface CustomerInfo {
  name: string;
  email?: string;
  organization?: string;
}

export interface LicensePayload {
  schemaVersion: number;
  productId: string;
  licenseId: string;
  tier: LicenseTier;
  issuedAt: string; // ISO 8601
  expiresAt?: string | null; // ISO 8601 or null for perpetual
  keyId: string;
  entitlements: string[];
  customer?: CustomerInfo;
  deviceBinding?: string | null;
}

export interface SignedLicense {
  payload: LicensePayload;
  signature: string; // Hex-encoded Ed25519 signature over canonical JSON payload string
}

export type LicenseValidationStatus =
  | 'valid'
  | 'expired'
  | 'not_yet_valid'
  | 'invalid_signature'
  | 'tampered'
  | 'product_mismatch'
  | 'unsupported_schema'
  | 'unknown_key'
  | 'community_default';

export interface LicenseValidationResult {
  valid: boolean;
  tier: LicenseTier;
  status: LicenseValidationStatus;
  errorMessage?: string;
  license?: SignedLicense;
  entitlements: string[];
}

export interface DiagnosticReportOptions {
  appVersion: string;
  osPlatform: string;
  storagePath?: string;
}

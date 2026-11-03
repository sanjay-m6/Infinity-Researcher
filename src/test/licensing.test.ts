import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateLicense,
  canonicalizePayload,
  generateDiagnosticReport,
  saveLicense,
  loadSavedLicense,
  clearSavedLicense,
  PRODUCT_ID,
} from '../features/licensing/licensing-service';
import { LicensePayload, SignedLicense } from '../features/licensing/types';

// Ephemeral test signing key matching public key 'ir-pubkey-2026'
const TEST_SIGNING_KEY_PKCS8 =
  '302e020100300506032b65700422042000ba12b0697437c1c5262440a434884c8414da6d3b3fee1696b0e6b98af9abb7';

async function signTestPayload(payload: LicensePayload): Promise<SignedLicense> {
  const canonical = canonicalizePayload(payload);
  const privBytes = new Uint8Array(
    (TEST_SIGNING_KEY_PKCS8.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
  );
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privBytes as unknown as BufferSource,
    { name: 'Ed25519' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign(
    { name: 'Ed25519' },
    cryptoKey,
    new TextEncoder().encode(canonical)
  );
  const sigHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    payload,
    signature: sigHex,
  };
}

describe('Licensing Architecture & Validation', () => {
  beforeEach(() => {
    clearSavedLicense();
  });

  it('defaults to Community tier when no license is supplied', async () => {
    const res = await validateLicense(null);
    expect(res.valid).toBe(true);
    expect(res.tier).toBe('community');
    expect(res.status).toBe('community_default');
    expect(res.entitlements).toEqual([]);
  });

  it('validates a properly signed Pro offline license', async () => {
    const payload: LicensePayload = {
      schemaVersion: 1,
      productId: PRODUCT_ID,
      licenseId: 'LIC-TEST-2026-001',
      tier: 'pro',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2028-01-01T00:00:00.000Z',
      keyId: 'ir-pubkey-2026',
      entitlements: ['feature:batch_synthesis', 'feature:advanced_export'],
      customer: {
        name: 'Alice Researcher',
        email: 'alice@institution.edu',
        organization: 'Institute of AI',
      },
    };

    const signed = await signTestPayload(payload);
    const res = await validateLicense(signed);

    expect(res.valid).toBe(true);
    expect(res.tier).toBe('pro');
    expect(res.status).toBe('valid');
    expect(res.entitlements).toContain('feature:batch_synthesis');
    expect(res.entitlements).toContain('feature:advanced_export');
  });

  it('rejects tampered license payloads and fails closed to Community', async () => {
    const payload: LicensePayload = {
      schemaVersion: 1,
      productId: PRODUCT_ID,
      licenseId: 'LIC-TEST-2026-002',
      tier: 'pro',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2028-01-01T00:00:00.000Z',
      keyId: 'ir-pubkey-2026',
      entitlements: ['feature:batch_synthesis'],
    };

    const signed = await signTestPayload(payload);
    // Tamper with entitlement without resigning
    signed.payload.entitlements.push('feature:unlimited_corpus');

    const res = await validateLicense(signed);
    expect(res.valid).toBe(false);
    expect(res.tier).toBe('community');
    expect(res.status).toBe('invalid_signature');
    expect(res.entitlements).toEqual([]);
  });

  it('rejects mismatched product identifiers', async () => {
    const payload: LicensePayload = {
      schemaVersion: 1,
      productId: 'another-software-product',
      licenseId: 'LIC-TEST-2026-003',
      tier: 'pro',
      issuedAt: '2026-01-01T00:00:00.000Z',
      keyId: 'ir-pubkey-2026',
      entitlements: ['feature:batch_synthesis'],
    };

    const signed = await signTestPayload(payload);
    const res = await validateLicense(signed);
    expect(res.valid).toBe(false);
    expect(res.tier).toBe('community');
    expect(res.status).toBe('product_mismatch');
  });

  it('rejects expired licenses and reverts to Community', async () => {
    const payload: LicensePayload = {
      schemaVersion: 1,
      productId: PRODUCT_ID,
      licenseId: 'LIC-TEST-2026-004',
      tier: 'pro',
      issuedAt: '2020-01-01T00:00:00.000Z',
      expiresAt: '2021-01-01T00:00:00.000Z', // in the past
      keyId: 'ir-pubkey-2026',
      entitlements: ['feature:batch_synthesis'],
    };

    const signed = await signTestPayload(payload);
    const res = await validateLicense(signed);
    expect(res.valid).toBe(false);
    expect(res.tier).toBe('community');
    expect(res.status).toBe('expired');
  });

  it('rejects licenses with unknown or untrusted key IDs', async () => {
    const payload: LicensePayload = {
      schemaVersion: 1,
      productId: PRODUCT_ID,
      licenseId: 'LIC-TEST-2026-005',
      tier: 'enterprise',
      issuedAt: '2026-01-01T00:00:00.000Z',
      keyId: 'unknown-key-9999',
      entitlements: ['feature:unlimited_corpus'],
    };

    const signed = await signTestPayload(payload);
    const res = await validateLicense(signed);
    expect(res.valid).toBe(false);
    expect(res.tier).toBe('community');
    expect(res.status).toBe('unknown_key');
  });

  it('persists and loads license via local storage', async () => {
    const payload: LicensePayload = {
      schemaVersion: 1,
      productId: PRODUCT_ID,
      licenseId: 'LIC-TEST-2026-006',
      tier: 'trial',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2029-01-01T00:00:00.000Z',
      keyId: 'ir-pubkey-2026',
      entitlements: ['feature:batch_synthesis'],
    };

    const signed = await signTestPayload(payload);
    saveLicense(signed);

    const loaded = loadSavedLicense();
    expect(loaded).not.toBeNull();
    expect(loaded?.payload.licenseId).toBe('LIC-TEST-2026-006');

    clearSavedLicense();
    expect(loadSavedLicense()).toBeNull();
  });

  it('generates a diagnostic support report with redacted customer info', async () => {
    const payload: LicensePayload = {
      schemaVersion: 1,
      productId: PRODUCT_ID,
      licenseId: 'LIC-TEST-2026-007',
      tier: 'pro',
      issuedAt: '2026-01-01T00:00:00.000Z',
      keyId: 'ir-pubkey-2026',
      entitlements: ['feature:batch_synthesis'],
      customer: {
        name: 'Johnathon Research',
        email: 'johnathon.research@university.edu',
        organization: 'National AI Laboratory',
      },
    };

    const signed = await signTestPayload(payload);
    const res = await validateLicense(signed);
    const report = generateDiagnosticReport(
      {
        appVersion: '0.1.0',
        osPlatform: 'Windows 11 x64',
        storagePath: 'C:\\Users\\Test\\AppData\\Roaming\\Infinity Researcher',
      },
      res
    );

    expect(report).toContain('INFINITY RESEARCHER — SUPPORT DIAGNOSTIC REPORT');
    expect(report).toContain('PRO');
    expect(report).toContain('v0.1.0');
    // Ensure email and names are redacted
    expect(report).not.toContain('johnathon.research@university.edu');
    expect(report).toContain('jo***@university.edu');
    expect(report).toContain('CONFIDENTIALITY: All secrets');
  });
});

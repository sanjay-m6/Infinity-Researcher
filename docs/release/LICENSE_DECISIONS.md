# Infinity Researcher — Product Licensing & Release Decisions Matrix
**Owner:** Sanjay  
**Publisher:** Infinity Web Technology  
**Target Release:** Production Desktop Windows 10/11 x64  
**Date:** October 2026  

---

## 1. Executive Summary

This document captures the formal decision points and legal policy confirmations required by the product owner (**Sanjay**) prior to commercial release and signed production distribution.

The application architecture has been engineered with configuration-driven feature entitlements and offline cryptographic verification (Ed25519) so that any combination of the following decisions can be enabled without breaking changes.

---

## 2. Decision Matrix

| Category | Decision Point | Current Implementation | Alternatives / Owner Options | Owner Confirmation Status |
| :--- | :--- | :--- | :--- | :--- |
| **Code Licensing** | Application Code License | MIT License in root `LICENSE` file; permissive notices in `THIRD_PARTY_NOTICES.md`. | 1. Dual-license (MIT for core, Proprietary for enterprise extensions)<br>2. Fully Proprietary commercial EULA | **PENDING OWNER SIGN-OFF** |
| **Commercial Tiers** | Default Active Tier | `Community` (100% free, offline, unconstrained local library, 7 scrapers). | 1. Free Community forever<br>2. Pro ($X/year or one-time lifetime) for batch synthesis<br>3. Institutional site licensing | **PENDING OWNER SIGN-OFF** |
| **Trial Duration** | Evaluation Period for Pro Features | 14-day trial schema supported in `LicensePayload`. | 1. 14 days<br>2. 30 days<br>3. No trial (Community mode only) | **PENDING OWNER SIGN-OFF** |
| **Device Binding** | Multi-Device Entitlements | `deviceBinding: null` (license works offline on any scholar machine without hardware fingerprinting). | 1. Single-seat binding<br>2. 3 devices per license<br>3. Unrestricted offline keys | **RECOMMENDED: Unrestricted offline keys** |
| **Online Activation** | Remote License Validation | Pure offline verification via Ed25519 public key (`ir-pubkey-2026`). No remote activation server called. | 1. Keep 100% offline (Recommended)<br>2. Introduce optional license sync API when backend exists | **CONFIRMED: Offline-First** |
| **Pricing & Billing** | Commercial Retail Price | Not published / No prices hardcoded in application. | To be determined by Sanjay / Infinity Web Technology. | **PENDING COMMERCIAL STRATEGY** |
| **Support SLA** | Bug Report & Security Response | Best-effort open-source response via GitHub Issues & Advisories (48hr initial acknowledgment). | Tiered SLA for institutional subscribers. | **PENDING OWNER SIGN-OFF** |
| **Company Legal Details** | Legal Jurisdiction & Entity | Infinity Web Technology (Author: Sanjay). | Provide registered corporate entity identifier and registered address if incorporating. | **DOCUMENTED IN CONFIG** |

---

## 3. Cryptographic Key Custody Strategy

1. **Public Verification Key:** Embedded directly in compiled source:
   - Key ID: `ir-pubkey-2026`
   - Public Key: `e68689321226181074f999df5781e265a780ad2aeb26c0fe6c10b480985f01ba`
2. **Private Signing Key:** Kept strictly offline and air-gapped on the product owner's secure workstation or hardware security module (HSM).
   - **NEVER** committed to Git.
   - **NEVER** embedded in frontend bundles, release installers, or CI output.
3. **Key Rotation Protocol:** The application supports multiple key IDs in `TRUSTED_PUBLIC_KEYS`. When issuing licenses for 2027+, a new keypair `ir-pubkey-2027` can be registered while retaining legacy key verification.

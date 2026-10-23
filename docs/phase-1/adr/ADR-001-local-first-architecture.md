# ADR-001: Local-First Desktop Architecture Using Tauri 2, Rust, and SQLite

* **Status:** Accepted  
* **Date:** 2026-10-24  
* **Deciders:** System Architect, Desktop Application Architect, Security Engineer  

---

## Context and Problem Statement
Researchers require a literature research and scraping tool that works reliably without vendor lock-in, recurring cloud subscription costs, or privacy risks associated with uploading unpublished manuscripts and personal research notes to remote third-party servers. 

The application must run smoothly on standard personal computers (starting with Windows desktop and remaining portable to macOS and Linux), start rapidly, utilize modest memory, and allow complete offline access to saved papers and citations.

## Decision Drivers
* Complete offline usability for the saved paper library, notes, and local full-text search.
* User data sovereignty: zero mandatory central cloud server or third-party telemetry.
* Lean resource footprint (low memory consumption and fast startup time).
* High safety and performance for intensive concurrent scraping, network I/O, and PDF file operations.
* Cross-platform portability across Windows, macOS, and Linux.

## Considered Options
1. **Option 1: Tauri 2 + Rust + React/TypeScript (Selected)**
2. **Option 2: Electron + Node.js + React**
3. **Option 3: Hosted Web App (Next.js + Remote PostgreSQL + Celery Workers)**
4. **Option 4: Native C# / .NET MAUI / WPF**

## Decision Outcome
**Chosen Option:** **Option 1: Tauri 2 + Rust + React/TypeScript + SQLite**.

### Rationale
* **Resource Efficiency:** Tauri leverages the OS's native webview (Microsoft Edge WebView2 on Windows, WebKit on macOS) instead of bundling an entire Chromium browser and Node.js runtime, resulting in a lean $\approx 15 - 30\text{ MB}$ installer and $\approx 40 - 80\text{ MB}$ base memory usage (compared to Electron's $150+\text{ MB}$ installer and $300+\text{ MB}$ memory footprint).
* **Rust Backend for Systems Tasks:** Rust provides memory safety, fearless async concurrency (`tokio`), zero-cost abstractions, and high throughput for streaming downloads, SHA-256 checksumming, PDF binary inspection, and SQLite database transactions.
* **Separation of Privileges:** Tauri 2's capability and permission system isolates the React webview from arbitrary OS-level filesystem or network execution, providing a strong security boundary.
* **SQLite for Local-First Persistence:** SQLite 3 in WAL mode provides ACID transactions, zero-config embedded storage, and robust FTS5 full-text indexing with sub-50ms local query times.

## Consequences & Trade-offs
### Positive
* The researcher's library remains 100% accessible and searchable offline.
* Fast startup times ($< 1.5\text{ seconds}$).
* Zero hosting infrastructure costs for core operation.
* Secure IPC boundary with strictly typed command interfaces.

### Negative / Mitigations
* Tauri on Windows requires Microsoft Visual Studio C++ Build Tools and WebView2 (available by default on Windows 10/11; verified during setup).
* Multi-process IPC between React and Rust requires explicit serialization and type synchronization (mitigated by using shared TypeScript types and typed command schemas).

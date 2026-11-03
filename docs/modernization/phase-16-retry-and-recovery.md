# Phase 16: Retry, Failure Recovery, and Crash Resilience Report

## 1. Startup Crash Recovery

If the desktop application terminates unexpectedly (e.g. power loss, OS shutdown, or user task kill) while downloads are in flight:
1. **Startup Recovery Routine**:
   - `DownloadManager::recover_interrupted_jobs` executes immediately during database initialization.
2. **Database Query**:
   ```sql
   UPDATE download_jobs
   SET status = 'failed',
       stage_message = 'Interrupted by application restart',
       error_message = 'Process terminated before download completed',
       error_category = 'interrupted',
       completed_at = ?1,
       updated_at = ?1
   WHERE status IN ('downloading', 'queued', 'resolving', 'validating');
   ```
3. **Outcome**:
   - Eliminates "zombie" tasks indefinitely stuck in `downloading` or `queued`.
   - Users see clear "Interrupted by application restart" messages with one-click "Retry" actions.

---

## 2. Retry Logic & Error Taxonomy

When a download fails, `DownloadManager` categorizes the failure into an actionable `error_category`:

| Error Category | Diagnostic Explanation | Suggested User Action |
|---|---|---|
| `html_paywall` | Academic server returned an HTML access challenge or login page rather than a PDF stream. | Check institutional VPN / library subscription or look for green Open Access badge. |
| `anti_ssrf` | Remote URL redirected to a forbidden local/private IP address. | Blocked for security; report invalid source URL. |
| `corrupt_pdf` | File downloaded but lacked valid `%PDF-` header or failed structural parsing. | Retry download; server may have sent an interrupted stream. |
| `size_limit` | File exceeded the 100 MB maximum safety ceiling. | Manual local file import via IEEE / Local OA workflow. |
| `network` | TCP connection timeout, DNS failure, or HTTP 5xx error. | Click 'Retry' when internet connection is stable. |
| `storage` | Insufficient disk space or OS filesystem permission failure. | Free disk space or check storage directory permissions. |

---

## 3. Safe Retry Implementation

When the user clicks "Retry":
- `retry_pdf_download` retrieves the original URL, paper title, and source from the existing record.
- Increments `retry_count`.
- Re-enqueues through standard validation, Anti-SSRF, and concurrency controls.


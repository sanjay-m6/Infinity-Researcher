# Phase 16: Progress Reporting and Cancellation Architecture Report

## 1. Cooperative Cancellation Architecture

In a desktop application, canceling an in-flight network transfer must immediately free system resources:
1. **Watch Channels (`tokio::sync::watch`)**:
   - Each job receives a `(Sender<bool>, Receiver<bool>)` channel upon creation.
   - When the user clicks "Cancel" in the UI, `cancel_pdf_download` signals `true` on the sender.
2. **Immediate Loop Break**:
   - The stream loop in `execute_stream_download` checks `*cancel_rx.borrow()` at every chunk iteration.
   - Upon cancellation, the HTTP client drops the connection, flushes nothing further, and closes the open file descriptor.
3. **Artifact Cleanup**:
   - The partially downloaded `.tmp_<job_id>.part` file is deleted from disk immediately.
4. **State Commitment**:
   - Updates `download_jobs`: `status = 'cancelled'`, `stage_message = 'Download cancelled by user'`, `error_category = 'cancelled'`, `completed_at = now`.
   - Emits `paper:download_cancelled` event to Tauri.

---

## 2. Real-Time Event Architecture & Throttling

To provide immediate feedback without causing React render bottlenecks:
- **Tauri Event Bus**:
  - `paper:download_started`: Sent when worker acquires slot and connects.
  - `paper:download_progress`: Sent periodically during streaming.
  - `paper:download_completed`: Sent upon successful validation and atomic commit.
  - `paper:download_failed`: Sent upon error.
  - `paper:download_cancelled`: Sent upon user cancellation.
- **Emission Throttling**:
  - Updates are emitted every **256 KB** of data received or after at least **300 ms** has elapsed.
  - Prevents high-speed connections from saturating the IPC channel with thousands of events per second.
- **Frontend Event Handling**:
  - `DownloadsView.tsx` subscribes directly to `@tauri-apps/api/event`.
  - When an event arrives, the specific job in state is mutated without re-rendering unrelated UI trees.


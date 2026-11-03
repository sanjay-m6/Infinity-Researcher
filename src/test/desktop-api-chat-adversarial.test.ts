import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAiChatSessions,
  createAiChatSession,
  deleteAiChatSession,
  listAiChatMessages,
  saveAiChatMessage,
  clearAiChatSession,
  generateAiResponse,
} from "../lib/desktop-api";
import * as tauriBridge from "../lib/tauri-bridge";
import * as tauriCore from "@tauri-apps/api/core";
import type {
  AiChatSession,
  AiChatMessage,
  GenerateRequestInput,
} from "../lib/desktop-api/types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("Adversarial Testing: Desktop API Chat Persistence & UI Context Bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Non-Tauri Preview Environment Fallbacks (Browser & Node.js)", () => {
    beforeEach(() => {
      vi.spyOn(tauriBridge, "isTauriEnvironment").mockReturnValue(false);
    });

    it("listAiChatSessions returns safe empty array instead of rejecting", async () => {
      const result = await listAiChatSessions();
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
      expect(tauriCore.invoke).not.toHaveBeenCalled();
    });

    it("listAiChatMessages returns safe empty array for any session ID", async () => {
      const emptySessionResult = await listAiChatMessages("");
      const randomSessionResult = await listAiChatMessages("non-existent-session-id");
      expect(emptySessionResult).toEqual([]);
      expect(randomSessionResult).toEqual([]);
      expect(tauriCore.invoke).not.toHaveBeenCalled();
    });

    it("saveAiChatMessage resolves safely without throwing", async () => {
      const testMessage: AiChatMessage = {
        id: "msg-preview-1",
        session_id: "default_session",
        paper_id: null,
        role: "user",
        content: "Preview message test",
        citations: [],
        provider_id: "local",
        model_id: "qwen",
        retrieval_mode: "none",
        created_at: new Date().toISOString(),
      };

      await expect(saveAiChatMessage(testMessage)).resolves.toBeUndefined();
      expect(tauriCore.invoke).not.toHaveBeenCalled();
    });

    it("clearAiChatSession resolves safely without throwing", async () => {
      await expect(clearAiChatSession("default_session")).resolves.toBeUndefined();
      await expect(clearAiChatSession("")).resolves.toBeUndefined();
      expect(tauriCore.invoke).not.toHaveBeenCalled();
    });

    it("createAiChatSession resolves safely without throwing", async () => {
      const testSession: AiChatSession = {
        id: "sess-preview-1",
        paper_id: null,
        title: "Preview Chat Session",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await expect(createAiChatSession(testSession)).resolves.toBeUndefined();
      expect(tauriCore.invoke).not.toHaveBeenCalled();
    });

    it("deleteAiChatSession resolves safely without throwing", async () => {
      await expect(deleteAiChatSession("sess-preview-1")).resolves.toBeUndefined();
      await expect(deleteAiChatSession("")).resolves.toBeUndefined();
      expect(tauriCore.invoke).not.toHaveBeenCalled();
    });

    it("generateAiResponse in preview returns grounded mock response with ui_context accepted", async () => {
      const input: GenerateRequestInput = {
        prompt: "Explain transformer architecture",
        ui_context:
          "Active Tab: PDF Viewer, Current Zoom: 125%, Active Paper: Transformer Attention",
      };

      const res = await generateAiResponse(input);
      expect(res.text).toBeDefined();
      expect(res.citations.length).toBeGreaterThan(0);
      expect(res.is_grounded).toBe(true);
      expect(tauriCore.invoke).not.toHaveBeenCalled();
    });
  });

  describe("Tauri Native Desktop Environment IPC Invocations", () => {
    beforeEach(() => {
      vi.spyOn(tauriBridge, "isTauriEnvironment").mockReturnValue(true);
    });

    it("listAiChatSessions correctly dispatches 'list_ai_chat_sessions' IPC command", async () => {
      const mockSessions: AiChatSession[] = [
        {
          id: "session-1",
          paper_id: "paper-123",
          title: "Discussion on Attention Mechanisms",
          created_at: "2026-11-01T10:00:00Z",
          updated_at: "2026-11-01T10:05:00Z",
        },
      ];
      vi.mocked(tauriCore.invoke).mockResolvedValueOnce(mockSessions);

      const result = await listAiChatSessions();
      expect(tauriCore.invoke).toHaveBeenCalledTimes(1);
      expect(tauriCore.invoke).toHaveBeenCalledWith("list_ai_chat_sessions", undefined);
      expect(result).toEqual(mockSessions);
    });

    it("createAiChatSession correctly dispatches 'create_ai_chat_session' with session payload", async () => {
      const sessionPayload: AiChatSession = {
        id: "session-new",
        paper_id: null,
        title: "General Research Q&A",
        created_at: "2026-11-03T00:00:00Z",
        updated_at: "2026-11-03T00:00:00Z",
      };
      vi.mocked(tauriCore.invoke).mockResolvedValueOnce(undefined);

      await createAiChatSession(sessionPayload);
      expect(tauriCore.invoke).toHaveBeenCalledTimes(1);
      expect(tauriCore.invoke).toHaveBeenCalledWith("create_ai_chat_session", {
        session: sessionPayload,
      });
    });

    it("deleteAiChatSession correctly dispatches 'delete_ai_chat_session' with sessionId", async () => {
      vi.mocked(tauriCore.invoke).mockResolvedValueOnce(undefined);

      await deleteAiChatSession("session-to-remove");
      expect(tauriCore.invoke).toHaveBeenCalledTimes(1);
      expect(tauriCore.invoke).toHaveBeenCalledWith("delete_ai_chat_session", {
        sessionId: "session-to-remove",
      });
    });

    it("listAiChatMessages correctly dispatches 'list_ai_chat_messages' with sessionId", async () => {
      const mockMessages: AiChatMessage[] = [
        {
          id: "msg-1",
          session_id: "session-xyz",
          paper_id: null,
          role: "user",
          content: "Hello assistant",
          citations: [],
          retrieval_mode: "none",
          created_at: "2026-11-03T01:00:00Z",
        },
        {
          id: "msg-2",
          session_id: "session-xyz",
          paper_id: null,
          role: "assistant",
          content: "Hello! How can I assist your research?",
          citations: [],
          retrieval_mode: "none",
          created_at: "2026-11-03T01:00:01Z",
        },
      ];
      vi.mocked(tauriCore.invoke).mockResolvedValueOnce(mockMessages);

      const messages = await listAiChatMessages("session-xyz");
      expect(tauriCore.invoke).toHaveBeenCalledTimes(1);
      expect(tauriCore.invoke).toHaveBeenCalledWith("list_ai_chat_messages", {
        sessionId: "session-xyz",
      });
      expect(messages).toEqual(mockMessages);
    });

    it("saveAiChatMessage correctly dispatches 'save_ai_chat_message' with message payload", async () => {
      const messageToSave: AiChatMessage = {
        id: "msg-save-1",
        session_id: "session-xyz",
        paper_id: "paper-456",
        role: "user",
        content: "Explain theorem 3",
        citations: [
          {
            chunk_id: "chunk-1",
            paper_id: "paper-456",
            paper_title: "Paper Title",
            page_number: 5,
            section_heading: "Section 3",
            snippet: "Theorem 3 states...",
            score: 0.95,
          },
        ],
        provider_id: "local",
        model_id: "llama3",
        retrieval_mode: "paper",
        created_at: "2026-11-03T02:00:00Z",
      };
      vi.mocked(tauriCore.invoke).mockResolvedValueOnce(undefined);

      await saveAiChatMessage(messageToSave);
      expect(tauriCore.invoke).toHaveBeenCalledTimes(1);
      expect(tauriCore.invoke).toHaveBeenCalledWith("save_ai_chat_message", {
        message: messageToSave,
      });
    });

    it("clearAiChatSession correctly dispatches 'clear_ai_chat_session' with sessionId", async () => {
      vi.mocked(tauriCore.invoke).mockResolvedValueOnce(undefined);

      await clearAiChatSession("session-xyz");
      expect(tauriCore.invoke).toHaveBeenCalledTimes(1);
      expect(tauriCore.invoke).toHaveBeenCalledWith("clear_ai_chat_session", {
        sessionId: "session-xyz",
      });
    });

    it("generateAiResponse passes ui_context payload to native IPC", async () => {
      const input: GenerateRequestInput = {
        prompt: "Summarize paper",
        ui_context: "Active Screen: Library View; Selection: 3 papers",
      };
      const mockResponse = {
        text: "Summary text",
        citations: [],
        provider_id: "ollama",
        model_id: "qwen2.5",
        latency_ms: 250,
        is_grounded: true,
      };
      vi.mocked(tauriCore.invoke).mockResolvedValueOnce(mockResponse);

      const res = await generateAiResponse(input);
      expect(tauriCore.invoke).toHaveBeenCalledWith("generate_ai_response", { input });
      expect(res).toEqual(mockResponse);
    });
  });

  describe("Tauri Native Error Propagation & Normalization", () => {
    beforeEach(() => {
      vi.spyOn(tauriBridge, "isTauriEnvironment").mockReturnValue(true);
    });

    it("normalizes string IPC errors thrown by Tauri backend", async () => {
      vi.mocked(tauriCore.invoke).mockRejectedValueOnce(
        "database disk image is malformed"
      );

      await expect(listAiChatSessions()).rejects.toMatchObject({
        code: "ERR_COMMAND",
        message: "database disk image is malformed",
        retryable: true,
      });
    });

    it("normalizes Error exception thrown by Tauri backend", async () => {
      vi.mocked(tauriCore.invoke).mockRejectedValueOnce(
        new Error("Connection reset by peer")
      );

      await expect(listAiChatMessages("sess-1")).rejects.toMatchObject({
        code: "ERR_EXCEPTION",
        message: "Connection reset by peer",
        retryable: true,
      });
    });

    it("preserves structured CommandError objects from backend", async () => {
      const structuredError = {
        code: "ERR_SESSION_NOT_FOUND",
        message: "Specified session does not exist",
        retryable: false,
      };
      vi.mocked(tauriCore.invoke).mockRejectedValueOnce(structuredError);

      await expect(deleteAiChatSession("sess-invalid")).rejects.toMatchObject({
        code: "ERR_SESSION_NOT_FOUND",
        message: "Specified session does not exist",
        retryable: false,
      });
    });
  });
});

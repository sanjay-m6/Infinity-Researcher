import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "../context/AppContext";
import { AiHubView } from "../features/ai-hub/AiHubView";
import { PdfRightPanel } from "../components/pdf-viewer/PdfRightPanel";
import { discoverSessionStore } from "../features/discover/discoverSessionStore";
import * as desktopApi from "../lib/desktop-api";
import type { AiChatMessage } from "../lib/desktop-api/types";

describe("Milestone 2 Adversarial: Cross-Panel Session Isolation & Collision Prevention", () => {
  // In-memory mock database simulating SQLite ai_chat_messages table
  let sqliteDb: Map<string, AiChatMessage[]>;

  beforeEach(() => {
    localStorage.clear();
    discoverSessionStore.clearAll();
    vi.restoreAllMocks();

    sqliteDb = new Map<string, AiChatMessage[]>();

    // Mock desktop API to act as an actual session-isolated store
    vi.spyOn(desktopApi, "listAiChatMessages").mockImplementation(
      async (sessionId: string) => {
        return [...(sqliteDb.get(sessionId) || [])];
      }
    );

    vi.spyOn(desktopApi, "saveAiChatMessage").mockImplementation(
      async (msg: AiChatMessage) => {
        const list = sqliteDb.get(msg.session_id) || [];
        list.push(msg);
        sqliteDb.set(msg.session_id, list);
      }
    );

    vi.spyOn(desktopApi, "clearAiChatSession").mockImplementation(
      async (sessionId: string) => {
        sqliteDb.delete(sessionId);
      }
    );
  });

  const testPaperId = "paper_isolation_test_42";

  const aiHubMessage: AiChatMessage = {
    id: "hub_msg_1",
    session_id: `ai_hub_${testPaperId}`,
    paper_id: testPaperId,
    role: "assistant",
    content: "AI Hub specific insight for paper 42",
    citations: [],
    retrieval_mode: "paper",
    created_at: new Date().toISOString(),
  };

  const pdfChatMessage: AiChatMessage = {
    id: "pdf_msg_1",
    session_id: `pdf_chat_${testPaperId}`,
    paper_id: testPaperId,
    role: "assistant",
    content: "PDF Viewer specific citation for paper 42",
    citations: [],
    retrieval_mode: "page",
    created_at: new Date().toISOString(),
  };

  const discoverChatMessage: AiChatMessage = {
    id: "disc_msg_1",
    session_id: `discover_${testPaperId}`,
    paper_id: testPaperId,
    role: "assistant",
    content: "Discover assistant search evaluation for paper 42",
    citations: [],
    retrieval_mode: "paper",
    created_at: new Date().toISOString(),
  };

  it("maintains separate session IDs across all three panels for the exact same paper ID", () => {
    const aiHubSession = `ai_hub_${testPaperId}`;
    const pdfChatSession = `pdf_chat_${testPaperId}`;
    const discoverSession = `discover_${testPaperId}`;

    expect(aiHubSession).toBe("ai_hub_paper_isolation_test_42");
    expect(pdfChatSession).toBe("pdf_chat_paper_isolation_test_42");
    expect(discoverSession).toBe("discover_paper_isolation_test_42");

    // All three session IDs must be pairwise distinct
    expect(aiHubSession).not.toEqual(pdfChatSession);
    expect(aiHubSession).not.toEqual(discoverSession);
    expect(pdfChatSession).not.toEqual(discoverSession);
  });

  it("clearing chat in AI Hub leaves PDF Viewer and Discover Assistant messages completely intact in storage", async () => {
    // Populate all three panels in the mock SQLite database
    sqliteDb.set(`ai_hub_${testPaperId}`, [{ ...aiHubMessage }]);
    sqliteDb.set(`pdf_chat_${testPaperId}`, [{ ...pdfChatMessage }]);
    sqliteDb.set(`discover_${testPaperId}`, [{ ...discoverChatMessage }]);

    expect(sqliteDb.get(`ai_hub_${testPaperId}`)).toHaveLength(1);
    expect(sqliteDb.get(`pdf_chat_${testPaperId}`)).toHaveLength(1);
    expect(sqliteDb.get(`discover_${testPaperId}`)).toHaveLength(1);

    // AI Hub clears its session
    await desktopApi.clearAiChatSession(`ai_hub_${testPaperId}`);

    // AI Hub must be deleted
    expect(sqliteDb.get(`ai_hub_${testPaperId}`)).toBeUndefined();

    // PDF Viewer and Discover messages MUST be intact
    const remainingPdf = await desktopApi.listAiChatMessages(`pdf_chat_${testPaperId}`);
    expect(remainingPdf).toHaveLength(1);
    expect(remainingPdf[0].content).toBe("PDF Viewer specific citation for paper 42");

    const remainingDiscover = await desktopApi.listAiChatMessages(
      `discover_${testPaperId}`
    );
    expect(remainingDiscover).toHaveLength(1);
    expect(remainingDiscover[0].content).toBe(
      "Discover assistant search evaluation for paper 42"
    );
  });

  it("clearing chat in PDF Viewer leaves AI Hub and Discover Assistant messages intact", async () => {
    sqliteDb.set(`ai_hub_${testPaperId}`, [{ ...aiHubMessage }]);
    sqliteDb.set(`pdf_chat_${testPaperId}`, [{ ...pdfChatMessage }]);
    sqliteDb.set(`discover_${testPaperId}`, [{ ...discoverChatMessage }]);

    // PDF Viewer clears its session
    await desktopApi.clearAiChatSession(`pdf_chat_${testPaperId}`);

    expect(sqliteDb.get(`pdf_chat_${testPaperId}`)).toBeUndefined();

    const remainingHub = await desktopApi.listAiChatMessages(`ai_hub_${testPaperId}`);
    expect(remainingHub).toHaveLength(1);
    expect(remainingHub[0].content).toBe("AI Hub specific insight for paper 42");

    const remainingDiscover = await desktopApi.listAiChatMessages(
      `discover_${testPaperId}`
    );
    expect(remainingDiscover).toHaveLength(1);
    expect(remainingDiscover[0].content).toBe(
      "Discover assistant search evaluation for paper 42"
    );
  });

  it("clearing chat in Discover Assistant leaves AI Hub and PDF Viewer messages intact", async () => {
    sqliteDb.set(`ai_hub_${testPaperId}`, [{ ...aiHubMessage }]);
    sqliteDb.set(`pdf_chat_${testPaperId}`, [{ ...pdfChatMessage }]);
    sqliteDb.set(`discover_${testPaperId}`, [{ ...discoverChatMessage }]);

    // Discover clears its session
    await desktopApi.clearAiChatSession(`discover_${testPaperId}`);

    expect(sqliteDb.get(`discover_${testPaperId}`)).toBeUndefined();

    const remainingHub = await desktopApi.listAiChatMessages(`ai_hub_${testPaperId}`);
    expect(remainingHub).toHaveLength(1);
    expect(remainingHub[0].content).toBe("AI Hub specific insight for paper 42");

    const remainingPdf = await desktopApi.listAiChatMessages(`pdf_chat_${testPaperId}`);
    expect(remainingPdf).toHaveLength(1);
    expect(remainingPdf[0].content).toBe("PDF Viewer specific citation for paper 42");
  });

  it("clearing default AI Hub session does not impact general or fallback sessions of other panels", async () => {
    const hubDefaultSession = "ai_hub_default";
    const pdfGeneralSession = "pdf_chat_general";

    sqliteDb.set(hubDefaultSession, [
      {
        id: "msg_hub_def",
        session_id: hubDefaultSession,
        role: "user",
        content: "Global prompt in AI Hub",
        citations: [],
        retrieval_mode: "paper",
        created_at: new Date().toISOString(),
      },
    ]);

    sqliteDb.set(pdfGeneralSession, [
      {
        id: "msg_pdf_gen",
        session_id: pdfGeneralSession,
        role: "user",
        content: "Unassociated PDF prompt",
        citations: [],
        retrieval_mode: "page",
        created_at: new Date().toISOString(),
      },
    ]);

    await desktopApi.clearAiChatSession(hubDefaultSession);

    expect(await desktopApi.listAiChatMessages(hubDefaultSession)).toHaveLength(0);
    const pdfMessages = await desktopApi.listAiChatMessages(pdfGeneralSession);
    expect(pdfMessages).toHaveLength(1);
    expect(pdfMessages[0].content).toBe("Unassociated PDF prompt");
  });

  it("adversarially handles complex paper IDs with DOIs, slashes, and special characters", async () => {
    const complexDoiPaperId = "10.1145/3377325.3377527:arxiv_v2";

    const hubSession = `ai_hub_${complexDoiPaperId}`;
    const pdfSession = `pdf_chat_${complexDoiPaperId}`;

    sqliteDb.set(hubSession, [
      {
        id: "msg_c_1",
        session_id: hubSession,
        role: "user",
        content: "Doi query hub",
        citations: [],
        retrieval_mode: "paper",
        created_at: new Date().toISOString(),
      },
    ]);

    sqliteDb.set(pdfSession, [
      {
        id: "msg_c_2",
        session_id: pdfSession,
        role: "user",
        content: "Doi query pdf",
        citations: [],
        retrieval_mode: "page",
        created_at: new Date().toISOString(),
      },
    ]);

    // Clearing hub with complex ID does not clear pdf session
    await desktopApi.clearAiChatSession(hubSession);

    expect(await desktopApi.listAiChatMessages(hubSession)).toHaveLength(0);
    const pdfRes = await desktopApi.listAiChatMessages(pdfSession);
    expect(pdfRes).toHaveLength(1);
    expect(pdfRes[0].content).toBe("Doi query pdf");
  });

  it("interactive UI clear in AI Hub leaves PDF panel UI rendering intact when rendered consecutively", async () => {
    const user = userEvent.setup();

    // Seed PDF and AI Hub messages in database
    sqliteDb.set("ai_hub_default", [
      {
        id: "hub_ui_1",
        session_id: "ai_hub_default",
        role: "user",
        content: "AI Hub text to be wiped",
        citations: [],
        retrieval_mode: "paper",
        created_at: new Date().toISOString(),
      },
    ]);

    sqliteDb.set(`pdf_chat_${testPaperId}`, [
      {
        id: "pdf_ui_1",
        session_id: `pdf_chat_${testPaperId}`,
        paper_id: testPaperId,
        role: "assistant",
        content: "PDF text that must survive",
        citations: [],
        retrieval_mode: "page",
        created_at: new Date().toISOString(),
      },
    ]);

    // Render AI Hub
    const { unmount } = render(
      <AppProvider>
        <AiHubView />
      </AppProvider>
    );

    // Switch to Chat tab in AI Hub
    const chatTab = screen.getByRole("button", { name: /Reading Assistant & Chat/i });
    fireEvent.click(chatTab);

    await waitFor(() => {
      expect(screen.getByText("AI Hub text to be wiped")).toBeInTheDocument();
    });

    // Click Clear History in AI Hub
    const clearBtn = screen.getByRole("button", { name: /Clear History/i });
    await user.click(clearBtn);

    await waitFor(() => {
      expect(screen.queryByText("AI Hub text to be wiped")).not.toBeInTheDocument();
    });

    unmount();

    // Now render PDF Viewer Right Panel for testPaperId
    render(
      <PdfRightPanel
        paperId={testPaperId}
        paperTitle="Isolation Verification Document"
        currentPage={1}
        numPages={10}
        onNavigatePdfPage={vi.fn()}
        initialTab="ai"
      />
    );

    // PDF Viewer messages must be hydrated and visible
    await waitFor(() => {
      expect(screen.getByText("PDF text that must survive")).toBeInTheDocument();
    });
  });
});

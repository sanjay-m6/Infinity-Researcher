import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  dbPaperToPaper,
  dbCollectionToCollection,
  listPapers,
  createCollection,
  getDatabaseInfo,
  normalizeCommandError,
} from "../lib/desktop-api";
import * as tauriBridge from "../lib/tauri-bridge";
import type { DbPaper, DbCollection } from "../lib/desktop-api/types";

describe("Desktop API & Domain Adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbPaperToPaper Adapter", () => {
    it("correctly converts a raw SQLite DbPaper entity into UI Paper model", () => {
      const rawDbPaper: DbPaper = {
        id: "paper-123",
        canonical_doi: "10.1145/1234567",
        title: "Advances in Neural Information Processing",
        clean_title_key: "advancesinneuralinformationprocessing",
        abstract_text: "A seminal overview of deep neural networks.",
        publication_date: "2023-05-15",
        publication_year: 2023,
        venue: "NeurIPS",
        venue_type: "conference",
        language: "en",
        citation_count: 342,
        reference_count: 55,
        is_open_access: true,
        license: "CC-BY-4.0",
        primary_landing_url: "https://dl.acm.org/doi/10.1145/1234567",
        pdf_url: "https://dl.acm.org/doi/pdf/10.1145/1234567",
        has_file: true,
        local_pdf_path: "C:\\data\\paper.pdf",
        content_hash: "hash123",
        metadata_confidence: "high",
        is_saved: true,
        created_at: "2023-05-16T10:00:00Z",
        updated_at: "2023-05-16T10:00:00Z",
        authors: [
          {
            id: "auth-1",
            full_name: "Yann LeCun",
            family_name: "LeCun",
            given_name: "Yann",
            orcid: null,
            affiliation: "NYU",
            author_order: 0,
            created_at: "2023-05-16T10:00:00Z",
          },
        ],
        collection_ids: ["col-deep-learning"],
        tags: ["AI", "Vision"],
        source_names: ["OpenAlex"],
      };

      const paper = dbPaperToPaper(rawDbPaper);

      expect(paper.id).toBe("paper-123");
      expect(paper.title).toBe("Advances in Neural Information Processing");
      expect(paper.authors).toEqual(["Yann LeCun"]);
      expect(paper.year).toBe(2023);
      expect(paper.accessStatus).toBe("open_access");
      expect(paper.documentStatus).toBe("available");
      expect(paper.isSaved).toBe(true);
      expect(paper.isDemo).toBe(false);
      expect(paper.tags).toEqual(["AI", "Vision"]);
      expect(paper.collectionIds).toEqual(["col-deep-learning"]);
      expect(paper.sourceName).toBe("OpenAlex");
    });

    it("handles fallback defaults for optional/nullable fields safely", () => {
      const rawDbPaper: DbPaper = {
        id: "paper-minimal",
        canonical_doi: null,
        title: "A Minimal Paper Record",
        clean_title_key: "aminimalpaperrecord",
        abstract_text: null,
        publication_date: null,
        publication_year: null,
        venue: null,
        venue_type: null,
        language: "en",
        citation_count: 0,
        reference_count: 0,
        is_open_access: false,
        license: null,
        primary_landing_url: null,
        pdf_url: null,
        has_file: false,
        local_pdf_path: null,
        content_hash: null,
        metadata_confidence: "low",
        is_saved: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        authors: [],
        collection_ids: [],
        tags: [],
        source_names: [],
      };

      const paper = dbPaperToPaper(rawDbPaper);

      expect(paper.authors).toEqual(["Unknown Author"]);
      expect(paper.abstract).toBe("No abstract text recorded for this paper.");
      expect(paper.accessStatus).toBe("restricted");
      expect(paper.documentStatus).toBe("not_downloaded");
      expect(paper.landingUrl).toBe("");
      expect(paper.isSaved).toBe(false);
    });
  });

  describe("dbCollectionToCollection Adapter", () => {
    it("converts raw SQLite DbCollection to UI Collection model", () => {
      const rawDbCol: DbCollection = {
        id: "col-1",
        parent_id: null,
        name: "Reinforcement Learning",
        description: "Classic RL papers",
        color_hex: "#6366f1",
        paper_count: 5,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };

      const col = dbCollectionToCollection(rawDbCol, ["paper-1", "paper-2"]);

      expect(col.id).toBe("col-1");
      expect(col.name).toBe("Reinforcement Learning");
      expect(col.description).toBe("Classic RL papers");
      expect(col.colorHex).toBe("#6366f1");
      expect(col.paperIds).toEqual(["paper-1", "paper-2"]);
      expect(col.isDemo).toBe(false);
    });
  });

  describe("normalizeCommandError", () => {
    it("handles standard CommandError structured objects", () => {
      const err = { code: "ERR_DUPLICATE", message: "Duplicate DOI", retryable: false };
      const normalized = normalizeCommandError(err);
      expect(normalized.code).toBe("ERR_DUPLICATE");
      expect(normalized.message).toBe("Duplicate DOI");
      expect(normalized.retryable).toBe(false);
    });

    it("handles plain strings and standard Error instances", () => {
      const fromString = normalizeCommandError("Database lock timeout");
      expect(fromString.code).toBe("ERR_COMMAND");
      expect(fromString.message).toBe("Database lock timeout");

      const fromError = normalizeCommandError(new Error("Disk IO failure"));
      expect(fromError.code).toBe("ERR_EXCEPTION");
      expect(fromError.message).toBe("Disk IO failure");
    });
  });

  describe("Desktop API Client IPC boundary", () => {
    it("throws typed CommandError when executed outside Tauri environment", async () => {
      vi.spyOn(tauriBridge, "isTauriEnvironment").mockReturnValue(false);

      await expect(listPapers()).rejects.toMatchObject({
        code: "ERR_RUNTIME_UNAVAILABLE",
      });

      await expect(createCollection({ name: "Test" })).rejects.toMatchObject({
        code: "ERR_RUNTIME_UNAVAILABLE",
      });

      await expect(getDatabaseInfo()).rejects.toMatchObject({
        code: "ERR_RUNTIME_UNAVAILABLE",
      });
    });
  });
});

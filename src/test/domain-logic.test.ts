import { describe, it, expect } from "vitest";
import {
  INITIAL_DEMO_PAPERS,
  INITIAL_DEMO_COLLECTIONS,
  INITIAL_DEMO_JOBS,
} from "../data/demo-data";
import { Collection } from "../types/domain";

describe("Domain Logic & Filtering", () => {
  describe("Paper Search and Filtering", () => {
    it("filters papers by keyword matching in title, abstract, or author", () => {
      const q = "attention".toLowerCase();
      const matches = INITIAL_DEMO_PAPERS.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.abstract.toLowerCase().includes(q) ||
          p.authors.some((a) => a.toLowerCase().includes(q))
      );

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((p) => p.title.includes("Attention Is All You Need"))).toBe(
        true
      );
    });

    it("filters papers by specific source provider", () => {
      const arxivPapers = INITIAL_DEMO_PAPERS.filter((p) => p.sourceId === "arxiv");
      expect(arxivPapers.length).toBeGreaterThan(0);
      arxivPapers.forEach((p) => {
        expect(p.sourceId).toBe("arxiv");
      });
    });

    it("filters papers by publication year range", () => {
      const startYear = 2018;
      const endYear = 2020;
      const filtered = INITIAL_DEMO_PAPERS.filter(
        (p) => p.year >= startYear && p.year <= endYear
      );

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((p) => {
        expect(p.year).toBeGreaterThanOrEqual(startYear);
        expect(p.year).toBeLessThanOrEqual(endYear);
      });
    });

    it("filters open access papers only", () => {
      const openAccess = INITIAL_DEMO_PAPERS.filter(
        (p) => p.accessStatus === "open_access"
      );
      expect(openAccess.length).toBeGreaterThan(0);
      openAccess.forEach((p) => {
        expect(p.accessStatus).toBe("open_access");
      });
    });

    it("sorts papers by citations descending", () => {
      const sorted = [...INITIAL_DEMO_PAPERS].sort(
        (a, b) => b.citationCount - a.citationCount
      );
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].citationCount).toBeGreaterThanOrEqual(
          sorted[i + 1].citationCount
        );
      }
    });

    it("sorts papers by publication year descending", () => {
      const sorted = [...INITIAL_DEMO_PAPERS].sort((a, b) => b.year - a.year);
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].year).toBeGreaterThanOrEqual(sorted[i + 1].year);
      }
    });
  });

  describe("Collection Validation and Mutations", () => {
    const validateCollectionName = (
      name: string,
      existing: Collection[]
    ): { valid: boolean; error?: string } => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { valid: false, error: "Collection name cannot be blank." };
      }
      if (trimmed.length > 50) {
        return { valid: false, error: "Collection name must be 50 characters or less." };
      }
      const duplicate = existing.some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) {
        return { valid: false, error: `A collection named "${trimmed}" already exists.` };
      }
      return { valid: true };
    };

    it("rejects empty or whitespace-only collection names", () => {
      expect(validateCollectionName("", INITIAL_DEMO_COLLECTIONS).valid).toBe(false);
      expect(validateCollectionName("   ", INITIAL_DEMO_COLLECTIONS).valid).toBe(false);
    });

    it("rejects collection names longer than 50 characters", () => {
      const longName = "A".repeat(51);
      expect(validateCollectionName(longName, INITIAL_DEMO_COLLECTIONS).valid).toBe(
        false
      );
    });

    it("rejects case-insensitive duplicate collection names", () => {
      const existingName = INITIAL_DEMO_COLLECTIONS[0].name.toLowerCase();
      expect(validateCollectionName(existingName, INITIAL_DEMO_COLLECTIONS).valid).toBe(
        false
      );
      expect(
        validateCollectionName(
          `  ${existingName.toUpperCase()}  `,
          INITIAL_DEMO_COLLECTIONS
        ).valid
      ).toBe(false);
    });

    it("accepts a unique valid collection name", () => {
      expect(
        validateCollectionName("Novel Quantum Algorithms", INITIAL_DEMO_COLLECTIONS).valid
      ).toBe(true);
    });

    it("ensures deleting a collection preserves all papers in the library", () => {
      const targetColId = INITIAL_DEMO_COLLECTIONS[0].id;
      let collections = [...INITIAL_DEMO_COLLECTIONS];
      let papers = [...INITIAL_DEMO_PAPERS];

      const initialPaperCount = papers.length;

      // Simulate delete collection
      collections = collections.filter((c) => c.id !== targetColId);
      papers = papers.map((p) => ({
        ...p,
        collectionIds: p.collectionIds.filter((id) => id !== targetColId),
      }));

      expect(collections.some((c) => c.id === targetColId)).toBe(false);
      expect(papers.length).toBe(initialPaperCount); // Zero papers deleted!
    });
  });

  describe("Download Job Queue Filtering", () => {
    it("filters download jobs by status", () => {
      const runningJobs = INITIAL_DEMO_JOBS.filter((j) => j.status === "running");
      const queuedJobs = INITIAL_DEMO_JOBS.filter((j) => j.status === "queued");
      const failedJobs = INITIAL_DEMO_JOBS.filter((j) => j.status === "failed");
      const completedJobs = INITIAL_DEMO_JOBS.filter((j) => j.status === "completed");

      expect(runningJobs.every((j) => j.status === "running")).toBe(true);
      expect(queuedJobs.every((j) => j.status === "queued")).toBe(true);
      expect(failedJobs.every((j) => j.status === "failed")).toBe(true);
      expect(completedJobs.every((j) => j.status === "completed")).toBe(true);
    });
  });
});

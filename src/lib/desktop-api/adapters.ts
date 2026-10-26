import { AccessStatus, DocumentStatus, Paper, Collection } from "../../types/domain";
import type { DbCollection, DbPaper } from "./types";

/**
 * Transforms a raw SQLite Paper entity with its joined associations into
 * the UI-friendly Paper representation expected across Atelier screens.
 */
export function dbPaperToPaper(db: DbPaper): Paper {
  let accessStatus: AccessStatus = "restricted";
  if (db.is_open_access) {
    accessStatus = "open_access";
  }

  let documentStatus: DocumentStatus = "not_downloaded";
  if (db.has_file || db.local_pdf_path) {
    documentStatus = "available";
  }

  const primarySource = db.source_names[0] || "Direct Entry";
  const sourceId = primarySource.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  return {
    id: db.id,
    title: db.title,
    authors: db.authors && db.authors.length > 0 ? db.authors.map((a) => a.full_name) : ["Unknown Author"],
    abstract: db.abstract_text || "No abstract text recorded for this paper.",
    publicationDate: db.publication_date || (db.publication_year ? `${db.publication_year}-01-01` : "Recent"),
    year: db.publication_year ?? (db.publication_date ? parseInt(db.publication_date.slice(0, 4), 10) || 2024 : 2024),
    venue: db.venue || "Scholarly Publication",
    doi: db.canonical_doi,
    sourceId,
    sourceName: primarySource,
    landingUrl: db.primary_landing_url || (db.canonical_doi ? `https://doi.org/${db.canonical_doi}` : ""),
    pdfUrl: db.pdf_url,
    accessStatus,
    documentStatus,
    tags: db.tags || [],
    collectionIds: db.collection_ids || [],
    citationCount: db.citation_count,
    addedAt: db.created_at,

    isSaved: db.is_saved,
    isDemo: false,
    openAccessStatus: db.open_access_status,
    accessEvidenceType: db.access_evidence_type,
    accessEvidenceNote: db.access_evidence_note,
    licenseName: db.license_name,
    licenseUrl: db.license_url,
    retrievalMethod: db.retrieval_method,
    accessConfirmedAt: db.access_confirmed_at,
    contentHash: db.content_hash,
    localPdfPath: db.local_pdf_path,
    readingStatus: db.reading_status,
    readingProgress: db.reading_progress,
  };
}


/**
 * Transforms a raw SQLite Collection entity into the UI-friendly Collection representation.
 */
export function dbCollectionToCollection(db: DbCollection, paperIds: string[] = []): Collection {
  return {
    id: db.id,
    name: db.name,
    description: db.description || "",
    colorHex: db.color_hex,
    paperIds,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    isDemo: false,
  };
}

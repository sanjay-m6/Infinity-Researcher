use lopdf::{Document, Object};
use std::path::Path;
use tracing::{debug, warn};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PdfVerificationStatus {
    Verified,       // Valid PDF with extractable text
    NoText,         // Valid PDF with no extractable text (e.g. scanned/rasterized)
    Encrypted,      // Password-protected / encrypted PDF
    Corrupt,        // Failed structural parsing
    Missing,        // File not found on disk
    Oversized,      // Exceeds max allowed size
    Failed(String), // General failure
}

impl PdfVerificationStatus {
    pub fn as_str(&self) -> &str {
        match self {
            PdfVerificationStatus::Verified => "verified",
            PdfVerificationStatus::NoText => "no_text",
            PdfVerificationStatus::Encrypted => "encrypted",
            PdfVerificationStatus::Corrupt => "corrupt",
            PdfVerificationStatus::Missing => "missing",
            PdfVerificationStatus::Oversized => "oversized",
            PdfVerificationStatus::Failed(_) => "failed",
        }
    }
}

impl std::str::FromStr for PdfVerificationStatus {
    type Err = std::convert::Infallible;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s {
            "verified" => PdfVerificationStatus::Verified,
            "no_text" => PdfVerificationStatus::NoText,
            "encrypted" => PdfVerificationStatus::Encrypted,
            "corrupt" => PdfVerificationStatus::Corrupt,
            "missing" => PdfVerificationStatus::Missing,
            "oversized" => PdfVerificationStatus::Oversized,
            other => PdfVerificationStatus::Failed(other.to_string()),
        })
    }
}

use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ExtractedPdfMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub authors: Vec<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
    pub creation_date: Option<String>,
    pub publication_year: Option<i32>,
    pub page_count: i32,
    pub text_preview: Option<String>,
    pub full_text: Option<String>,
    pub doi: Option<String>,
    pub abstract_text: Option<String>,
    pub venue: Option<String>,
    pub license: Option<String>,
    pub status: String,
    pub is_encrypted: bool,
    pub is_scanned: bool,
    pub warning: Option<String>,
    pub identity_reconciled: bool,
    pub identity_score: f64,
    pub identity_status: String,
    pub reconciliation_notes: Option<String>,
    pub version_type: Option<String>,
}

pub struct PdfProcessor;

impl PdfProcessor {
    /// Maximum number of pages to extract text from (default 50 pages)
    pub const MAX_PAGES_TO_EXTRACT: u32 = 50;
    /// Maximum text length in bytes to store as full text (200 KB)
    pub const MAX_FULL_TEXT_BYTES: usize = 200 * 1024;
    /// Maximum preview snippet length (2000 chars)
    pub const MAX_PREVIEW_CHARS: usize = 2000;

    /// Creates a valid synthetic minimal 1-page PDF file for testing integrity pipelines
    pub fn create_test_pdf(path: &Path) -> std::io::Result<()> {
        let mut doc = Document::with_version("1.4");
        let pages_id = doc.new_object_id();
        let page_id = doc.new_object_id();

        let mut page_dict = lopdf::Dictionary::new();
        page_dict.set("Type", Object::Name(b"Page".to_vec()));
        page_dict.set("Parent", Object::Reference(pages_id));
        doc.objects.insert(page_id, Object::Dictionary(page_dict));

        let mut pages_dict = lopdf::Dictionary::new();
        pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
        pages_dict.set("Kids", Object::Array(vec![Object::Reference(page_id)]));
        pages_dict.set("Count", Object::Integer(1));
        doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

        let mut catalog_dict = lopdf::Dictionary::new();
        catalog_dict.set("Type", Object::Name(b"Catalog".to_vec()));
        catalog_dict.set("Pages", Object::Reference(pages_id));
        let catalog_id = doc.new_object_id();
        doc.objects
            .insert(catalog_id, Object::Dictionary(catalog_dict));
        doc.trailer.set("Root", catalog_id);

        doc.save(path)
            .map_err(|e| std::io::Error::other(e.to_string()))?;
        Ok(())
    }

    /// Inspects and parses a PDF file on disk safely:
    /// - Checks file existence and header
    /// - Parses structural document with lopdf
    /// - Detects encryption
    /// - Extracts page count
    /// - Extracts document Info dictionary (Title, Author, Creator, etc.)
    /// - Extracts text up to configured page ceiling
    pub fn process_pdf_file(path: &Path) -> ExtractedPdfMetadata {
        if !path.exists() {
            return ExtractedPdfMetadata {
                status: PdfVerificationStatus::Missing.as_str().to_string(),
                warning: Some("File does not exist on disk".to_string()),
                ..Default::default()
            };
        }

        let doc = match Document::load(path) {
            Ok(d) => d,
            Err(e) => {
                warn!(path = ?path, error = ?e, "PDF structural parse error");
                return ExtractedPdfMetadata {
                    status: PdfVerificationStatus::Corrupt.as_str().to_string(),
                    warning: Some(format!("Corrupt or malformed PDF: {}", e)),
                    ..Default::default()
                };
            }
        };

        if doc.is_encrypted() {
            return ExtractedPdfMetadata {
                status: PdfVerificationStatus::Encrypted.as_str().to_string(),
                is_encrypted: true,
                warning: Some("Document is encrypted or password-protected".to_string()),
                ..Default::default()
            };
        }

        let pages = doc.get_pages();
        let page_count = pages.len() as i32;

        let mut meta = ExtractedPdfMetadata {
            page_count,
            status: PdfVerificationStatus::NoText.as_str().to_string(),
            ..Default::default()
        };

        // Extract Info dictionary metadata
        Self::extract_info_dict(&doc, &mut meta);

        // Extract text up to page limit
        let pages_to_scan: Vec<u32> =
            (1..=pages.len().min(Self::MAX_PAGES_TO_EXTRACT as usize) as u32).collect();
        if !pages_to_scan.is_empty() {
            match doc.extract_text(&pages_to_scan) {
                Ok(text) => {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        meta.status = PdfVerificationStatus::Verified.as_str().to_string();

                        // Bounded preview
                        let preview: String =
                            trimmed.chars().take(Self::MAX_PREVIEW_CHARS).collect();
                        meta.text_preview = Some(preview);

                        // Bounded full text
                        let full: String = trimmed
                            .chars()
                            .take(Self::MAX_FULL_TEXT_BYTES / 4)
                            .collect();
                        meta.full_text = Some(full);

                        // Enrich metadata with DOI, Abstract, Year, Venue, and License patterns
                        Self::enrich_metadata_from_text(trimmed, &mut meta);
                    } else {
                        meta.status = PdfVerificationStatus::NoText.as_str().to_string();
                        meta.is_scanned = true;
                        meta.warning = Some(
                            "Legitimate PDF with no extractable text stream (scanned/rasterized)"
                                .to_string(),
                        );
                    }
                }
                Err(e) => {
                    debug!(error = ?e, "Failed text extraction from PDF");
                    meta.status = PdfVerificationStatus::NoText.as_str().to_string();
                    meta.is_scanned = true;
                    meta.warning = Some(format!("Could not extract text: {}", e));
                }
            }
        } else {
            meta.status = PdfVerificationStatus::NoText.as_str().to_string();
            meta.is_scanned = true;
            meta.warning = Some("PDF contains no extractable page streams (scanned or image-only)".to_string());
        }

        meta
    }

    fn extract_info_dict(doc: &Document, meta: &mut ExtractedPdfMetadata) {
        if let Ok(info_obj) = doc.trailer.get(b"Info") {
            let info_dict = match info_obj {
                Object::Dictionary(d) => Some(d),
                Object::Reference(id) => doc.get_object(*id).ok().and_then(|o| o.as_dict().ok()),
                _ => None,
            };

            if let Some(dict) = info_dict {
                if let Ok(title_obj) = dict.get(b"Title") {
                    meta.title = Self::clean_pdf_string(title_obj);
                }
                if let Ok(author_obj) = dict.get(b"Author") {
                    meta.author = Self::clean_pdf_string(author_obj);
                }
                if let Ok(creator_obj) = dict.get(b"Creator") {
                    meta.creator = Self::clean_pdf_string(creator_obj);
                }
                if let Ok(producer_obj) = dict.get(b"Producer") {
                    meta.producer = Self::clean_pdf_string(producer_obj);
                }
                if let Ok(date_obj) = dict.get(b"CreationDate") {
                    meta.creation_date = Self::clean_pdf_string(date_obj);
                }
            }
        }
    }

    fn clean_pdf_string(obj: &Object) -> Option<String> {
        let raw_bytes = match obj {
            Object::String(bytes, _) => bytes.clone(),
            _ => return None,
        };

        // Attempt UTF-8 then fallback to Latin-1
        if let Ok(s) = String::from_utf8(raw_bytes.clone()) {
            let trimmed = s.trim().to_string();
            if !trimmed.is_empty() {
                return Some(trimmed);
            }
        }

        let latin1: String = raw_bytes.into_iter().map(|b| b as char).collect();
        let trimmed = latin1.trim().to_string();
        if !trimmed.is_empty() {
            Some(trimmed)
        } else {
            None
        }
    }

    pub fn enrich_metadata_from_text(text: &str, meta: &mut ExtractedPdfMetadata) {
        // 1. DOI extraction (10.xxxx/yyyy)
        if meta.doi.is_none() {
            if let Ok(re) = Regex::new(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+") {
                if let Some(m) = re.find(text) {
                    let doi = m.as_str().trim_end_matches('.').to_string();
                    meta.doi = Some(doi);
                }
            }
        }

        // 2. Abstract extraction
        if meta.abstract_text.is_none() {
            if let Ok(re) = Regex::new(r"(?is)\babstract[:\.\s—-]+(.*?)(?:\n\s*\n\s*(?:[I1]\.|\bindex terms\b|\bkeywords\b|\bintroduction\b)|$)") {
                if let Some(cap) = re.captures(text) {
                    let raw_abs = cap[1].trim();
                    if raw_abs.len() > 30 {
                        let clean_abs = raw_abs.chars().take(1500).collect::<String>();
                        meta.abstract_text = Some(clean_abs);
                    }
                }
            }
        }

        // 3. Authors from metadata string or split
        if meta.authors.is_empty() {
            if let Some(ref a) = meta.author {
                let parts: Vec<String> = a
                    .split(&[',', ';'][..])
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                if !parts.is_empty() {
                    meta.authors = parts;
                }
            }
        }

        // 4. Publication year extraction
        if meta.publication_year.is_none() {
            if let Some(ref date_str) = meta.creation_date {
                if let Ok(re) = Regex::new(r"\b(19\d\d|20\d\d)\b") {
                    if let Some(m) = re.find(date_str) {
                        if let Ok(yr) = m.as_str().parse::<i32>() {
                            meta.publication_year = Some(yr);
                        }
                    }
                }
            }
            if meta.publication_year.is_none() {
                // Search first 1500 characters for copyright/publication year
                let head: String = text.chars().take(1500).collect();
                if let Ok(re) = Regex::new(r"\b(19\d\d|20\d\d)\b") {
                    if let Some(m) = re.find(&head) {
                        if let Ok(yr) = m.as_str().parse::<i32>() {
                            meta.publication_year = Some(yr);
                        }
                    }
                }
            }
        }

        // 5. Venue / Publisher detection
        if meta.venue.is_none() {
            let lower = text[..text.len().min(4000)].to_lowercase();
            if lower.contains("ieee access") {
                meta.venue = Some("IEEE Access".to_string());
            } else if lower.contains("ieee transactions") {
                meta.venue = Some("IEEE Transactions".to_string());
            } else if lower.contains("proceedings of the ieee") {
                meta.venue = Some("Proceedings of the IEEE".to_string());
            } else if lower.contains("scientific reports") {
                meta.venue = Some("Scientific Reports".to_string());
            } else if lower.contains("plos one") {
                meta.venue = Some("PLOS ONE".to_string());
            } else if lower.contains("biorxiv") {
                meta.venue = Some("bioRxiv".to_string());
            } else if lower.contains("medrxiv") {
                meta.venue = Some("medRxiv".to_string());
            } else if lower.contains("arxiv") {
                meta.venue = Some("arXiv".to_string());
            }
        }

        // 6. License detection
        if meta.license.is_none() {
            let lower = text[..text.len().min(4000)].to_lowercase();
            if lower.contains("creative commons attribution") || lower.contains("cc by 4.0") || lower.contains("cc-by") {
                meta.license = Some("CC-BY 4.0".to_string());
            } else if lower.contains("open access") {
                meta.license = Some("Open Access".to_string());
            }
        }
    }

    /// Detects academic version classification from extracted document text and headers
    pub fn detect_version_type(text: &str) -> String {
        let lower = text[..text.len().min(6000)].to_lowercase();
        if lower.contains("arxiv:")
            || lower.contains("biorxiv preprint")
            || lower.contains("medrxiv preprint")
            || lower.contains("this preprint")
            || lower.contains("not peer-reviewed")
            || lower.contains("under review")
            || lower.contains("working paper")
        {
            "preprint".to_string()
        } else if lower.contains("accepted manuscript")
            || lower.contains("author's accepted manuscript")
            || lower.contains("author accepted manuscript")
            || lower.contains("post-print")
            || lower.contains("postprint")
            || lower.contains("peer-reviewed and accepted")
        {
            "accepted_manuscript".to_string()
        } else if lower.contains("institutional repository")
            || lower.contains("deposited in")
            || lower.contains("etd collection")
            || lower.contains("handle.net")
            || lower.contains("dspace")
            || lower.contains("eprints")
        {
            "repository_version".to_string()
        } else if lower.contains("published by")
            || lower.contains("all rights reserved")
            || (lower.contains("volume") && lower.contains("issue"))
            || lower.contains("ieee transactions")
            || lower.contains("proceedings of")
            || lower.contains("nature publishing")
            || lower.contains("elsevier b.v.")
            || lower.contains("springer nature")
            || lower.contains("wiley periodicals")
        {
            "published_version".to_string()
        } else {
            "unknown_version".to_string()
        }
    }

    /// Reconciles extracted PDF metadata against target expected paper metadata.
    /// Categorizes verification into:
    /// - verified_match (exact DOI match or title sim >= 0.85 or >= 0.75 + author match)
    /// - probable_match (title sim >= 0.70 or >= 0.60 + author match)
    /// - identity_uncertain (title sim 0.35-0.69 or scanned/sparse text)
    /// - wrong_document (conflicting DOI or title sim < 0.35 with abundant text)
    /// - encrypted_pdf
    /// - invalid_pdf
    pub fn reconcile_identity(
        extracted: &mut ExtractedPdfMetadata,
        expected_title: &str,
        expected_authors: &[String],
        expected_doi: Option<&str>,
    ) -> bool {
        // Detect version if not already detected
        if extracted.version_type.is_none() {
            if let Some(ref text) = extracted.text_preview {
                extracted.version_type = Some(Self::detect_version_type(text));
            }
        }

        // 0. Handle corrupt / encrypted states
        if extracted.is_encrypted {
            extracted.identity_reconciled = false;
            extracted.identity_score = 0.0;
            extracted.identity_status = "encrypted_pdf".to_string();
            extracted.reconciliation_notes = Some("Document is password protected".to_string());
            return false;
        }

        if extracted.status == "corrupt" || extracted.status == "missing" {
            extracted.identity_reconciled = false;
            extracted.identity_score = 0.0;
            extracted.identity_status = "invalid_pdf".to_string();
            extracted.reconciliation_notes = Some("Document parsing failed".to_string());
            return false;
        }

        // 1. Direct DOI verification
        if let (Some(ext_doi), Some(exp_doi)) = (&extracted.doi, expected_doi) {
            let clean_ext = ext_doi.trim().to_lowercase();
            let clean_exp = exp_doi.trim().to_lowercase();
            if clean_ext == clean_exp || clean_ext.contains(&clean_exp) || clean_exp.contains(&clean_ext) {
                extracted.identity_reconciled = true;
                extracted.identity_score = 1.0;
                extracted.identity_status = "verified_match".to_string();
                extracted.reconciliation_notes = Some(format!("Exact DOI match confirmed from document body: {}", ext_doi));
                return true;
            } else if clean_ext.starts_with("10.") && clean_exp.starts_with("10.") && clean_ext != clean_exp {
                // Conflicting explicit DOI found in extracted document!
                extracted.identity_reconciled = false;
                extracted.identity_score = 0.0;
                extracted.identity_status = "wrong_document".to_string();
                extracted.reconciliation_notes = Some(format!("Conflicting DOI found in PDF text: {} (expected {})", ext_doi, exp_doi));
                return false;
            }
        }

        // 2. Title matching
        let mut best_title_sim: f64 = 0.0;
        if let Some(ref doc_title) = extracted.title {
            let sim = crate::services::candidate_verifier::CandidateVerifier::compute_title_similarity(expected_title, doc_title);
            best_title_sim = best_title_sim.max(sim);
        }

        if best_title_sim < 0.70 {
            if let Some(ref preview) = extracted.text_preview {
                let sim = crate::services::candidate_verifier::CandidateVerifier::compute_title_similarity(expected_title, preview);
                best_title_sim = best_title_sim.max(sim);
            }
        }

        // 3. Author matching
        let mut author_matched = false;
        if !expected_authors.is_empty() {
            let doc_author_text = extracted.author.as_deref().unwrap_or("");
            let preview_text = extracted.text_preview.as_deref().unwrap_or("");
            for author in expected_authors {
                let surname = author.split_whitespace().last().unwrap_or(author).to_lowercase();
                if surname.len() >= 3 && (doc_author_text.to_lowercase().contains(&surname) || preview_text.to_lowercase().contains(&surname)) {
                    author_matched = true;
                    break;
                }
            }
        }

        extracted.identity_score = best_title_sim;

        if best_title_sim >= 0.85 || (best_title_sim >= 0.75 && author_matched) {
            extracted.identity_reconciled = true;
            extracted.identity_status = "verified_match".to_string();
            extracted.reconciliation_notes = Some(format!(
                "High confidence match ({:.0}%){}",
                best_title_sim * 100.0,
                if author_matched { " with matching author surname" } else { "" }
            ));
            true
        } else if best_title_sim >= 0.70 || (best_title_sim >= 0.60 && author_matched) {
            extracted.identity_reconciled = true;
            extracted.identity_status = "probable_match".to_string();
            extracted.reconciliation_notes = Some(format!(
                "Probable match ({:.0}% title overlap){}",
                best_title_sim * 100.0,
                if author_matched { " with author verification" } else { "" }
            ));
            true
        } else if best_title_sim >= 0.35 || extracted.is_scanned || extracted.text_preview.as_ref().map_or(0, |t| t.len()) < 150 {
            extracted.identity_reconciled = false;
            extracted.identity_status = "identity_uncertain".to_string();
            extracted.reconciliation_notes = Some(format!(
                "Title similarity ({:.0}%) below confident match threshold or text is sparse; candidate preserved for user verification",
                best_title_sim * 100.0
            ));
            false
        } else {
            extracted.identity_reconciled = false;
            extracted.identity_status = "wrong_document".to_string();
            extracted.reconciliation_notes = Some(format!(
                "Document text does not match expected paper (similarity {:.0}%)",
                best_title_sim * 100.0
            ));
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    #[test]
    fn test_corrupt_pdf_file_detection() {
        let temp_dir = std::env::temp_dir().join(format!("test_corrupt_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();
        let corrupt_path = temp_dir.join("corrupt.pdf");
        {
            let mut f = File::create(&corrupt_path).unwrap();
            f.write_all(b"%PDF-1.4\nInvalid PDF content that will fail parsing")
                .unwrap();
        }

        let meta = PdfProcessor::process_pdf_file(&corrupt_path);
        assert_eq!(meta.status, "corrupt");
        assert!(meta.warning.unwrap().contains("Corrupt"));
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_missing_pdf_file_detection() {
        let fake_path = Path::new("non_existent_paper_12345.pdf");
        let meta = PdfProcessor::process_pdf_file(fake_path);
        assert_eq!(meta.status, "missing");
    }

    #[test]
    fn test_synthetic_minimal_valid_pdf() {
        let temp_dir =
            std::env::temp_dir().join(format!("test_valid_pdf_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();
        let pdf_path = temp_dir.join("minimal_valid.pdf");

        PdfProcessor::create_test_pdf(&pdf_path).unwrap();

        let meta = PdfProcessor::process_pdf_file(&pdf_path);
        assert_eq!(meta.page_count, 1);
        assert_eq!(meta.status, "no_text");
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_identity_reconciliation_matching_and_mismatch() {
        let mut meta = ExtractedPdfMetadata {
            title: Some("Attention Is All You Need".to_string()),
            author: Some("Ashish Vaswani, Noam Shazeer".to_string()),
            text_preview: Some("The dominant sequence transduction models are based on complex recurrent or convolutional neural networks".to_string()),
            ..Default::default()
        };

        // Matching case
        let is_match = PdfProcessor::reconcile_identity(
            &mut meta,
            "Attention Is All You Need",
            &["Vaswani".to_string(), "Shazeer".to_string()],
            Some("10.48550/arXiv.1706.03762"),
        );
        assert!(is_match);
        assert!(meta.identity_reconciled);
        assert_eq!(meta.identity_status, "verified_match");

        // Intentional mismatch test case
        let mut meta_wrong = ExtractedPdfMetadata {
            title: Some("Quantum Error Correction with Surface Codes".to_string()),
            author: Some("John Preskill".to_string()),
            text_preview: Some("We analyze fault-tolerant quantum computation using 2D topological codes".to_string()),
            ..Default::default()
        };

        let is_wrong_match = PdfProcessor::reconcile_identity(
            &mut meta_wrong,
            "Deep Residual Learning for Image Recognition",
            &["Kaiming He".to_string()],
            Some("10.1109/CVPR.2016.90"),
        );
        assert!(!is_wrong_match);
        assert!(!meta_wrong.identity_reconciled);
        assert_eq!(meta_wrong.identity_status, "wrong_document");
    }
}

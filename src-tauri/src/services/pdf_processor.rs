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

#[derive(Debug, Clone, Default)]
pub struct ExtractedPdfMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
    pub creation_date: Option<String>,
    pub page_count: i32,
    pub text_preview: Option<String>,
    pub full_text: Option<String>,
    pub status: String,
    pub warning: Option<String>,
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
                    } else {
                        meta.status = PdfVerificationStatus::NoText.as_str().to_string();
                        meta.warning = Some(
                            "Legitimate PDF with no extractable text stream (scanned/rasterized)"
                                .to_string(),
                        );
                    }
                }
                Err(e) => {
                    debug!(error = ?e, "Failed text extraction from PDF");
                    meta.status = PdfVerificationStatus::NoText.as_str().to_string();
                    meta.warning = Some(format!("Could not extract text: {}", e));
                }
            }
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
        // Minimal PDF has no text stream, so status should be 'no_text'
        assert_eq!(meta.status, "no_text");
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}

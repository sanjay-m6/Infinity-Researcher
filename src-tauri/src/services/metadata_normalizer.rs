use regex::Regex;

/// Metadata normalizer for academic paper attributes.
/// Ensures deterministic, reproducible transformations without losing original source intent.
pub struct MetadataNormalizer;

impl MetadataNormalizer {
    /// Normalizes a paper title:
    /// - Trims leading and trailing whitespace.
    /// - Normalizes consecutive whitespace characters into a single space.
    /// - Preserves scientific formulas, Greek symbols, punctuation (hyphens, apostrophes, colons).
    pub fn normalize_display_title(raw: &str) -> String {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return String::new();
        }

        // Collapse multiple whitespace
        let words: Vec<&str> = trimmed.split_whitespace().collect();
        words.join(" ")
    }

    /// Generates a normalized comparison key for title deduplication:
    /// - Lowercases characters.
    /// - Keeps only alphanumeric characters and removes spacing/punctuation.
    pub fn compute_title_key(title: &str) -> String {
        title
            .to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric())
            .collect()
    }

    /// Canonicalizes a Digital Object Identifier (DOI):
    /// - Trims extraneous whitespace.
    /// - Removes recognized resolver prefixes (https://doi.org/, http://dx.doi.org/, doi:).
    /// - Validates that the identifier starts with standard prefix '10.'.
    /// - Converts to lowercase for case-insensitive matching per DOI specification.
    /// - Rejects malformed strings that do not follow 10.xxxx/... format.
    pub fn normalize_doi(raw: &str) -> Option<String> {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return None;
        }

        // Remove common URL prefixes or doi: scheme
        let stripped = trimmed
            .strip_prefix("https://doi.org/")
            .or_else(|| trimmed.strip_prefix("http://doi.org/"))
            .or_else(|| trimmed.strip_prefix("https://dx.doi.org/"))
            .or_else(|| trimmed.strip_prefix("http://dx.doi.org/"))
            .or_else(|| trimmed.strip_prefix("doi:"))
            .or_else(|| trimmed.strip_prefix("DOI:"))
            .unwrap_or(trimmed)
            .trim();

        // Must start with "10." followed by registrant code and suffix separator '/'
        if stripped.starts_with("10.") && stripped.contains('/') {
            // Trim trailing punctuation often introduced by citations (e.g. trailing dot or comma)
            let cleaned = stripped.trim_end_matches(['.', ',', ';', ')', ']']);
            Some(cleaned.to_lowercase())
        } else {
            None
        }
    }

    /// Normalizes an arXiv identifier:
    /// - Accepts formats like: "2301.12345", "arXiv:2301.12345v2", "https://arxiv.org/abs/2301.12345v1"
    /// - Returns (base_arxiv_id, optional_version)
    pub fn normalize_arxiv_id(raw: &str) -> Option<(String, Option<String>)> {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return None;
        }

        let stripped = trimmed
            .strip_prefix("https://arxiv.org/abs/")
            .or_else(|| trimmed.strip_prefix("http://arxiv.org/abs/"))
            .or_else(|| trimmed.strip_prefix("https://arxiv.org/pdf/"))
            .or_else(|| trimmed.strip_prefix("arxiv:"))
            .or_else(|| trimmed.strip_prefix("arXiv:"))
            .unwrap_or(trimmed)
            .trim_end_matches(".pdf")
            .trim();

        // Regex for new arXiv ID: YYMM.NNNNN(vV)? or legacy archive/YYMMNNN
        let re = Regex::new(r"(?i)^([0-9]{4}\.[0-9]{4,5}|[a-z\-]+/[0-9]{7})(v([0-9]+))?$").ok()?;
        if let Some(caps) = re.captures(stripped) {
            let base = caps.get(1)?.as_str().to_string();
            let version = caps.get(3).map(|v| format!("v{}", v.as_str()));
            Some((base, version))
        } else {
            None
        }
    }

    /// Normalizes PubMed ID (PMID):
    /// - Must be positive numeric digits.
    pub fn normalize_pmid(raw: &str) -> Option<String> {
        let trimmed = raw.trim();
        let stripped = trimmed
            .strip_prefix("pmid:")
            .or_else(|| trimmed.strip_prefix("PMID:"))
            .unwrap_or(trimmed)
            .trim();

        if !stripped.is_empty() && stripped.chars().all(|c| c.is_ascii_digit()) {
            Some(stripped.to_string())
        } else {
            None
        }
    }

    /// Normalizes author names while preserving ordering and cleaning punctuation:
    pub fn normalize_author_name(raw: &str) -> String {
        let trimmed = raw.trim();
        let words: Vec<&str> = trimmed.split_whitespace().collect();
        words.join(" ")
    }

    /// Extracts family (last) name heuristic for candidate matching:
    pub fn extract_family_name(full_name: &str) -> String {
        let cleaned = full_name.trim();
        if cleaned.contains(',') {
            // "Smith, John" -> "Smith"
            cleaned
                .split(',')
                .next()
                .unwrap_or("")
                .trim()
                .to_lowercase()
        } else {
            // "John Smith" -> "Smith"
            cleaned
                .split_whitespace()
                .last()
                .unwrap_or("")
                .to_lowercase()
        }
    }

    /// Normalizes abstract text:
    /// - Strips basic HTML markup tags (e.g. `<p>`, `<i>`, `<b>`, `<jats:p>`).
    /// - Decodes standard XML/HTML entities.
    /// - Preserves paragraph line breaks while cleaning excessive whitespace runs.
    pub fn normalize_abstract(raw: &str) -> String {
        let tag_regex = Regex::new(r"<[^>]+>").unwrap();
        let stripped = tag_regex.replace_all(raw, "");

        let decoded = stripped
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")
            .replace("&#39;", "'")
            .replace("&nbsp;", " ");

        // Preserve paragraph breaks while trimming lines
        let lines: Vec<&str> = decoded
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect();
        lines.join("\n\n")
    }

    /// Parses year and date safely without inventing months or days when absent.
    /// Returns (Option<year>, Option<clean_date_str>)
    pub fn parse_publication_date(raw: &str) -> (Option<i32>, Option<String>) {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return (None, None);
        }

        // Check 4-digit year at start or embedded
        let year_regex = Regex::new(r"\b(19\d{2}|20\d{2})\b").unwrap();
        let year = year_regex
            .find(trimmed)
            .and_then(|m| m.as_str().parse::<i32>().ok());

        // Validate if full YYYY-MM-DD or YYYY-MM
        let iso_regex = Regex::new(r"^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?").unwrap();
        if let Some(caps) = iso_regex.captures(trimmed) {
            let y = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let m = caps.get(2).map(|m| m.as_str());
            let d = caps.get(3).map(|m| m.as_str());

            let clean_date = match (m, d) {
                (Some(month), Some(day)) => format!("{}-{}-{}", y, month, day),
                (Some(month), None) => format!("{}-{}", y, month),
                _ => y.to_string(),
            };

            return (year, Some(clean_date));
        }

        (year, Some(trimmed.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_display_title() {
        let raw = "   A   Novel    Approach to   Machine Learning: Part I   ";
        assert_eq!(
            MetadataNormalizer::normalize_display_title(raw),
            "A Novel Approach to Machine Learning: Part I"
        );
        assert_eq!(
            MetadataNormalizer::compute_title_key(raw),
            "anovelapproachtomachinelearningparti"
        );
    }

    #[test]
    fn test_normalize_doi_variations() {
        assert_eq!(
            MetadataNormalizer::normalize_doi("10.1038/nature12373"),
            Some("10.1038/nature12373".to_string())
        );
        assert_eq!(
            MetadataNormalizer::normalize_doi("https://doi.org/10.1038/nature12373"),
            Some("10.1038/nature12373".to_string())
        );
        assert_eq!(
            MetadataNormalizer::normalize_doi("http://dx.doi.org/10.1038/NATURE12373."),
            Some("10.1038/nature12373".to_string())
        );
        assert_eq!(
            MetadataNormalizer::normalize_doi("doi:10.1101/2020.01.01.123456"),
            Some("10.1101/2020.01.01.123456".to_string())
        );
        // Invalid DOI should return None
        assert_eq!(MetadataNormalizer::normalize_doi("not_a_doi"), None);
        assert_eq!(
            MetadataNormalizer::normalize_doi("https://example.com/paper"),
            None
        );
    }

    #[test]
    fn test_normalize_arxiv_id() {
        let (base, ver) = MetadataNormalizer::normalize_arxiv_id("arXiv:2301.12345v2").unwrap();
        assert_eq!(base, "2301.12345");
        assert_eq!(ver, Some("v2".to_string()));

        let (base2, ver2) =
            MetadataNormalizer::normalize_arxiv_id("https://arxiv.org/abs/2106.09685").unwrap();
        assert_eq!(base2, "2106.09685");
        assert_eq!(ver2, None);
    }

    #[test]
    fn test_normalize_abstract_html_decoding() {
        let raw_html =
            "<jats:p>This study demonstrates that &alpha; &amp; &beta; are &gt; 0.</jats:p>";
        let cleaned = MetadataNormalizer::normalize_abstract(raw_html);
        assert_eq!(
            cleaned,
            "This study demonstrates that &alpha; & &beta; are > 0."
        );
    }

    #[test]
    fn test_parse_publication_date() {
        let (y1, d1) = MetadataNormalizer::parse_publication_date("2023-04-15");
        assert_eq!(y1, Some(2023));
        assert_eq!(d1, Some("2023-04-15".to_string()));

        let (y2, d2) = MetadataNormalizer::parse_publication_date("2021");
        assert_eq!(y2, Some(2021));
        assert_eq!(d2, Some("2021".to_string()));
    }
}

pub mod arxiv;
pub mod crossref;
pub mod europe_pmc;
pub mod openalex;
pub mod semantic_scholar;

pub use arxiv::ArxivAdapter;
pub use crossref::CrossrefAdapter;
pub use europe_pmc::EuropePmcAdapter;
pub use openalex::OpenAlexAdapter;
pub use semantic_scholar::SemanticScholarAdapter;

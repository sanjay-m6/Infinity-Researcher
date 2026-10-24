use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PagedResponse<T> {
    pub items: Vec<T>,
    pub total_count: i64,
    pub page: u32,
    pub page_size: u32,
    pub total_pages: u32,
}

impl<T> PagedResponse<T> {
    pub fn new(items: Vec<T>, total_count: i64, page: u32, page_size: u32) -> Self {
        let total_pages = if page_size == 0 {
            0
        } else {
            ((total_count as f64) / (page_size as f64)).ceil() as u32
        };

        Self {
            items,
            total_count,
            page,
            page_size,
            total_pages,
        }
    }
}

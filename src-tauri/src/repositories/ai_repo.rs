use crate::domain::ai::*;
use rusqlite::{params, Connection, Result};

pub struct AiRepository;

impl AiRepository {
    // -------------------------------------------------------------------------
    // AI Providers
    // -------------------------------------------------------------------------

    pub fn list_providers(conn: &Connection) -> Result<Vec<AiProvider>> {
        let mut stmt = conn.prepare(
            "SELECT id, display_name, category, endpoint_url, doc_url, auth_type, access_category,
                    credential_ref, default_model, embedding_model, reranker_model, timeout_secs,
                    max_tokens, temperature, context_length, streaming_enabled, is_local, is_enabled,
                    priority, last_verified_at, last_health_status, last_health_message,
                    supported_capabilities, created_at, updated_at
             FROM ai_providers
             ORDER BY priority ASC, display_name ASC"
        )?;

        let rows = stmt.query_map([], |row| {
            let caps_json: String = row.get(22).unwrap_or_else(|_| "[]".to_string());
            let caps: Vec<String> = serde_json::from_str(&caps_json).unwrap_or_default();
            Ok(AiProvider {
                id: row.get(0)?,
                display_name: row.get(1)?,
                category: row.get(2)?,
                endpoint_url: row.get(3)?,
                doc_url: row.get(4)?,
                auth_type: row.get(5)?,
                access_category: row.get(6)?,
                credential_ref: row.get(7)?,
                default_model: row.get(8)?,
                embedding_model: row.get(9)?,
                reranker_model: row.get(10)?,
                timeout_secs: row.get(11)?,
                max_tokens: row.get(12)?,
                temperature: row.get(13)?,
                context_length: row.get(14)?,
                streaming_enabled: row.get::<_, i64>(15)? == 1,
                is_local: row.get::<_, i64>(16)? == 1,
                is_enabled: row.get::<_, i64>(17)? == 1,
                priority: row.get(18)?,
                last_verified_at: row.get(19)?,
                last_health_status: row.get(20)?,
                last_health_message: row.get(21)?,
                supported_capabilities: caps,
                created_at: row.get(23)?,
                updated_at: row.get(24)?,
            })
        })?;

        let mut providers = Vec::new();
        for r in rows {
            providers.push(r?);
        }
        Ok(providers)
    }

    pub fn get_provider(conn: &Connection, id: &str) -> Result<Option<AiProvider>> {
        let mut stmt = conn.prepare(
            "SELECT id, display_name, category, endpoint_url, doc_url, auth_type, access_category,
                    credential_ref, default_model, embedding_model, reranker_model, timeout_secs,
                    max_tokens, temperature, context_length, streaming_enabled, is_local, is_enabled,
                    priority, last_verified_at, last_health_status, last_health_message,
                    supported_capabilities, created_at, updated_at
             FROM ai_providers
             WHERE id = ?1"
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let caps_json: String = row.get(22).unwrap_or_else(|_| "[]".to_string());
            let caps: Vec<String> = serde_json::from_str(&caps_json).unwrap_or_default();
            Ok(Some(AiProvider {
                id: row.get(0)?,
                display_name: row.get(1)?,
                category: row.get(2)?,
                endpoint_url: row.get(3)?,
                doc_url: row.get(4)?,
                auth_type: row.get(5)?,
                access_category: row.get(6)?,
                credential_ref: row.get(7)?,
                default_model: row.get(8)?,
                embedding_model: row.get(9)?,
                reranker_model: row.get(10)?,
                timeout_secs: row.get(11)?,
                max_tokens: row.get(12)?,
                temperature: row.get(13)?,
                context_length: row.get(14)?,
                streaming_enabled: row.get::<_, i64>(15)? == 1,
                is_local: row.get::<_, i64>(16)? == 1,
                is_enabled: row.get::<_, i64>(17)? == 1,
                priority: row.get(18)?,
                last_verified_at: row.get(19)?,
                last_health_status: row.get(20)?,
                last_health_message: row.get(21)?,
                supported_capabilities: caps,
                created_at: row.get(23)?,
                updated_at: row.get(24)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save_provider(conn: &Connection, p: &AiProvider) -> Result<()> {
        let caps_json =
            serde_json::to_string(&p.supported_capabilities).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "INSERT INTO ai_providers (
                id, display_name, category, endpoint_url, doc_url, auth_type, access_category,
                credential_ref, default_model, embedding_model, reranker_model, timeout_secs,
                max_tokens, temperature, context_length, streaming_enabled, is_local, is_enabled,
                priority, last_verified_at, last_health_status, last_health_message,
                supported_capabilities, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                display_name = excluded.display_name,
                category = excluded.category,
                endpoint_url = excluded.endpoint_url,
                doc_url = excluded.doc_url,
                auth_type = excluded.auth_type,
                access_category = excluded.access_category,
                credential_ref = coalesce(excluded.credential_ref, ai_providers.credential_ref),
                default_model = excluded.default_model,
                embedding_model = excluded.embedding_model,
                reranker_model = excluded.reranker_model,
                timeout_secs = excluded.timeout_secs,
                max_tokens = excluded.max_tokens,
                temperature = excluded.temperature,
                context_length = excluded.context_length,
                streaming_enabled = excluded.streaming_enabled,
                is_local = excluded.is_local,
                is_enabled = excluded.is_enabled,
                priority = excluded.priority,
                last_verified_at = excluded.last_verified_at,
                last_health_status = excluded.last_health_status,
                last_health_message = excluded.last_health_message,
                supported_capabilities = excluded.supported_capabilities,
                updated_at = datetime('now')",
            params![
                p.id, p.display_name, p.category, p.endpoint_url, p.doc_url, p.auth_type, p.access_category,
                p.credential_ref, p.default_model, p.embedding_model, p.reranker_model, p.timeout_secs,
                p.max_tokens, p.temperature, p.context_length, if p.streaming_enabled { 1 } else { 0 },
                if p.is_local { 1 } else { 0 }, if p.is_enabled { 1 } else { 0 }, p.priority,
                p.last_verified_at, p.last_health_status, p.last_health_message, caps_json
            ],
        )?;
        Ok(())
    }

    pub fn set_provider_status(
        conn: &Connection,
        id: &str,
        status: &str,
        message: Option<&str>,
    ) -> Result<()> {
        conn.execute(
            "UPDATE ai_providers
             SET last_health_status = ?1,
                 last_health_message = ?2,
                 updated_at = datetime('now')
             WHERE id = ?3",
            params![status, message, id],
        )?;
        Ok(())
    }

    pub fn set_provider_enabled(conn: &Connection, id: &str, enabled: bool) -> Result<()> {
        conn.execute(
            "UPDATE ai_providers
             SET is_enabled = ?1,
                 updated_at = datetime('now')
             WHERE id = ?2",
            params![if enabled { 1 } else { 0 }, id],
        )?;
        Ok(())
    }

    pub fn update_provider_credential(
        conn: &Connection,
        id: &str,
        credential_ref: Option<&str>,
    ) -> Result<()> {
        conn.execute(
            "UPDATE ai_providers
             SET credential_ref = ?1,
                 updated_at = datetime('now')
             WHERE id = ?2",
            params![credential_ref, id],
        )?;
        Ok(())
    }

    pub fn delete_provider(conn: &Connection, id: &str) -> Result<()> {
        conn.execute("DELETE FROM ai_providers WHERE id = ?1", params![id])?;
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Task Routes
    // -------------------------------------------------------------------------

    pub fn list_task_routes(conn: &Connection) -> Result<Vec<AiProviderTaskRoute>> {
        let mut stmt = conn.prepare(
            "SELECT task_type, provider_id, model_id, updated_at
             FROM ai_provider_task_routes
             ORDER BY task_type ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(AiProviderTaskRoute {
                task_type: row.get(0)?,
                provider_id: row.get(1)?,
                model_id: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;

        let mut routes = Vec::new();
        for r in rows {
            routes.push(r?);
        }
        Ok(routes)
    }

    pub fn get_task_route(
        conn: &Connection,
        task_type: &str,
    ) -> Result<Option<AiProviderTaskRoute>> {
        let mut stmt = conn.prepare(
            "SELECT task_type, provider_id, model_id, updated_at
             FROM ai_provider_task_routes
             WHERE task_type = ?1",
        )?;

        let mut rows = stmt.query(params![task_type])?;
        if let Some(row) = rows.next()? {
            Ok(Some(AiProviderTaskRoute {
                task_type: row.get(0)?,
                provider_id: row.get(1)?,
                model_id: row.get(2)?,
                updated_at: row.get(3)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn set_task_route(
        conn: &Connection,
        task_type: &str,
        provider_id: &str,
        model_id: &str,
    ) -> Result<()> {
        conn.execute(
            "INSERT INTO ai_provider_task_routes (task_type, provider_id, model_id, updated_at)
             VALUES (?1, ?2, ?3, datetime('now'))
             ON CONFLICT(task_type) DO UPDATE SET
                provider_id = excluded.provider_id,
                model_id = excluded.model_id,
                updated_at = excluded.updated_at",
            params![task_type, provider_id, model_id],
        )?;
        Ok(())
    }

    // -------------------------------------------------------------------------
    // AI Settings
    // -------------------------------------------------------------------------

    pub fn get_ai_settings(conn: &Connection) -> Result<AiSettings> {
        let mut stmt = conn.prepare("SELECT key, value FROM ai_settings")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut local_only = false;
        let mut never_paid = true;
        let mut cloud_sharing = false;
        let mut rag_scope = "paper".to_string();
        let mut audience_level = "researcher".to_string();
        let mut div_weight = 0.35;

        for r in rows {
            let (k, v) = r?;
            match k.as_str() {
                "local_only_mode" => local_only = v == "true" || v == "1",
                "never_use_paid_apis" => never_paid = v == "true" || v == "1",
                "cloud_paper_sharing_enabled" => cloud_sharing = v == "true" || v == "1",
                "active_rag_scope" => rag_scope = v,
                "default_audience_level" => audience_level = v,
                "recommendations_diversity_weight" => div_weight = v.parse().unwrap_or(0.35),
                _ => {}
            }
        }

        Ok(AiSettings {
            local_only_mode: local_only,
            never_use_paid_apis: never_paid,
            cloud_paper_sharing_enabled: cloud_sharing,
            active_rag_scope: rag_scope,
            default_audience_level: audience_level,
            recommendations_diversity_weight: div_weight,
        })
    }

    pub fn update_ai_settings(conn: &Connection, s: &AiSettings) -> Result<()> {
        let pairs = [
            (
                "local_only_mode",
                if s.local_only_mode { "true" } else { "false" },
            ),
            (
                "never_use_paid_apis",
                if s.never_use_paid_apis {
                    "true"
                } else {
                    "false"
                },
            ),
            (
                "cloud_paper_sharing_enabled",
                if s.cloud_paper_sharing_enabled {
                    "true"
                } else {
                    "false"
                },
            ),
            ("active_rag_scope", s.active_rag_scope.as_str()),
            ("default_audience_level", s.default_audience_level.as_str()),
        ];

        for (k, v) in pairs {
            conn.execute(
                "INSERT INTO ai_settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                params![k, v],
            )?;
        }

        let div_str = s.recommendations_diversity_weight.to_string();
        conn.execute(
            "INSERT INTO ai_settings (key, value, updated_at) VALUES ('recommendations_diversity_weight', ?1, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![div_str],
        )?;

        Ok(())
    }

    // -------------------------------------------------------------------------
    // Paper Chunks & FTS5 Lexical Search
    // -------------------------------------------------------------------------

    pub fn insert_chunks(conn: &Connection, chunks: &[AiPaperChunk]) -> Result<()> {
        for chunk in chunks {
            conn.execute(
                "INSERT INTO ai_paper_chunks (
                    id, paper_id, chunk_index, page_number, section_heading, content_text, token_count, embedding_json, created_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET
                    page_number = excluded.page_number,
                    section_heading = excluded.section_heading,
                    content_text = excluded.content_text,
                    token_count = excluded.token_count,
                    embedding_json = excluded.embedding_json",
                params![
                    chunk.id, chunk.paper_id, chunk.chunk_index, chunk.page_number,
                    chunk.section_heading, chunk.content_text, chunk.token_count, chunk.embedding_json
                ],
            )?;
        }
        Ok(())
    }

    pub fn delete_chunks_for_paper(conn: &Connection, paper_id: &str) -> Result<()> {
        conn.execute(
            "DELETE FROM ai_paper_chunks WHERE paper_id = ?1",
            params![paper_id],
        )?;
        Ok(())
    }

    pub fn get_chunks_for_paper(conn: &Connection, paper_id: &str) -> Result<Vec<AiPaperChunk>> {
        let mut stmt = conn.prepare(
            "SELECT id, paper_id, chunk_index, page_number, section_heading, content_text, token_count, embedding_json, created_at
             FROM ai_paper_chunks
             WHERE paper_id = ?1
             ORDER BY chunk_index ASC"
        )?;

        let rows = stmt.query_map(params![paper_id], |row| {
            Ok(AiPaperChunk {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                chunk_index: row.get(2)?,
                page_number: row.get(3)?,
                section_heading: row.get(4)?,
                content_text: row.get(5)?,
                token_count: row.get(6)?,
                embedding_json: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;

        let mut chunks = Vec::new();
        for r in rows {
            chunks.push(r?);
        }
        Ok(chunks)
    }

    pub fn count_all_chunks(conn: &Connection) -> Result<i64> {
        conn.query_row("SELECT count(*) FROM ai_paper_chunks", [], |row| row.get(0))
    }

    pub fn count_chunks_for_paper(conn: &Connection, paper_id: &str) -> Result<i64> {
        conn.query_row(
            "SELECT count(*) FROM ai_paper_chunks WHERE paper_id = ?1",
            params![paper_id],
            |row| row.get(0),
        )
    }

    /// Searches chunks via FTS5 BM25 index with optional paper_id restriction.
    /// Falls back to simple LIKE search if FTS syntax fails.
    pub fn search_chunks(
        conn: &Connection,
        query: &str,
        paper_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<AiChunkCitation>> {
        // Sanitize query tokens for FTS5 (remove special characters that break MATCH)
        let sanitized: String = query
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == ' ' {
                    c
                } else {
                    ' '
                }
            })
            .collect();
        let tokens: Vec<&str> = sanitized
            .split_whitespace()
            .filter(|w| w.len() > 1)
            .collect();

        if tokens.is_empty() {
            return Ok(Vec::new());
        }

        let fts_query = tokens.join(" OR ");

        let sql = if paper_id.is_some() {
            "SELECT c.id, c.paper_id, coalesce(p.title, 'Unknown Paper'), c.page_number,
                    c.section_heading, c.content_text, bm25(ai_chunks_fts) as rank
             FROM ai_chunks_fts
             JOIN ai_paper_chunks c ON c.rowid = ai_chunks_fts.rowid
             LEFT JOIN papers p ON p.id = c.paper_id
             WHERE ai_chunks_fts MATCH ?1 AND c.paper_id = ?2
             ORDER BY rank ASC
             LIMIT ?3"
        } else {
            "SELECT c.id, c.paper_id, coalesce(p.title, 'Unknown Paper'), c.page_number,
                    c.section_heading, c.content_text, bm25(ai_chunks_fts) as rank
             FROM ai_chunks_fts
             JOIN ai_paper_chunks c ON c.rowid = ai_chunks_fts.rowid
             LEFT JOIN papers p ON p.id = c.paper_id
             WHERE ai_chunks_fts MATCH ?1
             ORDER BY rank ASC
             LIMIT ?2"
        };

        let result = if let Some(pid) = paper_id {
            let mut stmt = conn.prepare(sql)?;
            let rows = stmt.query_map(params![fts_query, pid, limit as i64], |row| {
                let rank: f64 = row.get(6).unwrap_or(0.0);
                // BM25 in sqlite returns lower (more negative) for better match; convert to positive score
                let score = (1.0 / (1.0 + rank.abs())).min(1.0);
                Ok(AiChunkCitation {
                    chunk_id: row.get(0)?,
                    paper_id: row.get(1)?,
                    paper_title: row.get(2)?,
                    page_number: row.get(3)?,
                    section_heading: row.get(4)?,
                    snippet: row.get(5)?,
                    score,
                })
            });

            match rows {
                Ok(mapped) => {
                    let mut citations = Vec::new();
                    for r in mapped {
                        citations.push(r?);
                    }
                    Ok(citations)
                }
                Err(_) => Self::fallback_like_search(conn, &tokens, paper_id, limit),
            }
        } else {
            let mut stmt = conn.prepare(sql)?;
            let rows = stmt.query_map(params![fts_query, limit as i64], |row| {
                let rank: f64 = row.get(6).unwrap_or(0.0);
                let score = (1.0 / (1.0 + rank.abs())).min(1.0);
                Ok(AiChunkCitation {
                    chunk_id: row.get(0)?,
                    paper_id: row.get(1)?,
                    paper_title: row.get(2)?,
                    page_number: row.get(3)?,
                    section_heading: row.get(4)?,
                    snippet: row.get(5)?,
                    score,
                })
            });

            match rows {
                Ok(mapped) => {
                    let mut citations = Vec::new();
                    for r in mapped {
                        citations.push(r?);
                    }
                    Ok(citations)
                }
                Err(_) => Self::fallback_like_search(conn, &tokens, paper_id, limit),
            }
        };

        result
    }

    fn fallback_like_search(
        conn: &Connection,
        tokens: &[&str],
        paper_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<AiChunkCitation>> {
        let first_token = tokens.first().copied().unwrap_or("");
        let pattern = format!("%{}%", first_token);

        let sql = if paper_id.is_some() {
            "SELECT c.id, c.paper_id, coalesce(p.title, 'Unknown Paper'), c.page_number,
                    c.section_heading, c.content_text
             FROM ai_paper_chunks c
             LEFT JOIN papers p ON p.id = c.paper_id
             WHERE c.paper_id = ?1 AND c.content_text LIKE ?2
             LIMIT ?3"
        } else {
            "SELECT c.id, c.paper_id, coalesce(p.title, 'Unknown Paper'), c.page_number,
                    c.section_heading, c.content_text
             FROM ai_paper_chunks c
             LEFT JOIN papers p ON p.id = c.paper_id
             WHERE c.content_text LIKE ?1
             LIMIT ?2"
        };

        if let Some(pid) = paper_id {
            let mut stmt = conn.prepare(sql)?;
            let rows = stmt.query_map(params![pid, pattern, limit as i64], |row| {
                Ok(AiChunkCitation {
                    chunk_id: row.get(0)?,
                    paper_id: row.get(1)?,
                    paper_title: row.get(2)?,
                    page_number: row.get(3)?,
                    section_heading: row.get(4)?,
                    snippet: row.get(5)?,
                    score: 0.5,
                })
            })?;
            let mut res = Vec::new();
            for r in rows {
                res.push(r?);
            }
            Ok(res)
        } else {
            let mut stmt = conn.prepare(sql)?;
            let rows = stmt.query_map(params![pattern, limit as i64], |row| {
                Ok(AiChunkCitation {
                    chunk_id: row.get(0)?,
                    paper_id: row.get(1)?,
                    paper_title: row.get(2)?,
                    page_number: row.get(3)?,
                    section_heading: row.get(4)?,
                    snippet: row.get(5)?,
                    score: 0.5,
                })
            })?;
            let mut res = Vec::new();
            for r in rows {
                res.push(r?);
            }
            Ok(res)
        }
    }

    // -------------------------------------------------------------------------
    // Chat Sessions & Messages
    // -------------------------------------------------------------------------

    pub fn list_messages(conn: &Connection, session_id: &str) -> Result<Vec<AiChatMessage>> {
        let mut stmt = conn.prepare(
            "SELECT id, session_id, paper_id, role, content, citations_json, provider_id, model_id, retrieval_mode, created_at
             FROM ai_chat_messages
             WHERE session_id = ?1
             ORDER BY created_at ASC"
        )?;

        let rows = stmt.query_map(params![session_id], |row| {
            let cits_json: String = row.get(5).unwrap_or_else(|_| "[]".to_string());
            let citations: Vec<AiChunkCitation> =
                serde_json::from_str(&cits_json).unwrap_or_default();
            Ok(AiChatMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                paper_id: row.get(2)?,
                role: row.get(3)?,
                content: row.get(4)?,
                citations,
                provider_id: row.get(6)?,
                model_id: row.get(7)?,
                retrieval_mode: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?;

        let mut msgs = Vec::new();
        for r in rows {
            msgs.push(r?);
        }
        Ok(msgs)
    }

    pub fn save_message(conn: &Connection, msg: &AiChatMessage) -> Result<()> {
        let cits_json = serde_json::to_string(&msg.citations).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "INSERT INTO ai_chat_messages (
                id, session_id, paper_id, role, content, citations_json, provider_id, model_id, retrieval_mode, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))",
            params![
                msg.id, msg.session_id, msg.paper_id, msg.role, msg.content,
                cits_json, msg.provider_id, msg.model_id, msg.retrieval_mode
            ],
        )?;
        Ok(())
    }

    pub fn clear_session_messages(conn: &Connection, session_id: &str) -> Result<()> {
        conn.execute(
            "DELETE FROM ai_chat_messages WHERE session_id = ?1",
            params![session_id],
        )?;
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Recommendations
    // -------------------------------------------------------------------------

    pub fn list_recommendations(
        conn: &Connection,
        paper_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<AiRecommendation>> {
        let sql = if paper_id.is_some() {
            "SELECT id, paper_id, recommended_paper_id, recommended_title, recommended_authors_json,
                    recommended_year, recommended_venue, recommended_doi, score, reason,
                    matched_concepts_json, confidence_label, recommendation_mode, feedback_status,
                    feedback_note, updated_at
             FROM ai_recommendations
             WHERE paper_id = ?1
             ORDER BY score DESC
             LIMIT ?2"
        } else {
            "SELECT id, paper_id, recommended_paper_id, recommended_title, recommended_authors_json,
                    recommended_year, recommended_venue, recommended_doi, score, reason,
                    matched_concepts_json, confidence_label, recommendation_mode, feedback_status,
                    feedback_note, updated_at
             FROM ai_recommendations
             ORDER BY score DESC
             LIMIT ?1"
        };

        if let Some(pid) = paper_id {
            let mut stmt = conn.prepare(sql)?;
            let rows = stmt.query_map(params![pid, limit as i64], Self::map_recommendation_row)?;
            let mut recs = Vec::new();
            for r in rows {
                recs.push(r?);
            }
            Ok(recs)
        } else {
            let mut stmt = conn.prepare(sql)?;
            let rows = stmt.query_map(params![limit as i64], Self::map_recommendation_row)?;
            let mut recs = Vec::new();
            for r in rows {
                recs.push(r?);
            }
            Ok(recs)
        }
    }

    fn map_recommendation_row(row: &rusqlite::Row) -> Result<AiRecommendation> {
        let auth_json: String = row.get(4).unwrap_or_else(|_| "[]".to_string());
        let authors: Vec<String> = serde_json::from_str(&auth_json).unwrap_or_default();
        let conc_json: String = row.get(10).unwrap_or_else(|_| "[]".to_string());
        let concepts: Vec<String> = serde_json::from_str(&conc_json).unwrap_or_default();

        Ok(AiRecommendation {
            id: row.get(0)?,
            paper_id: row.get(1)?,
            recommended_paper_id: row.get(2)?,
            recommended_title: row.get(3)?,
            recommended_authors: authors,
            recommended_year: row.get(5)?,
            recommended_venue: row.get(6)?,
            recommended_doi: row.get(7)?,
            score: row.get(8)?,
            reason: row.get(9)?,
            matched_concepts: concepts,
            confidence_label: row.get(11)?,
            recommendation_mode: row.get(12)?,
            feedback_status: row.get(13)?,
            feedback_note: row.get(14)?,
            updated_at: row.get(15)?,
        })
    }

    pub fn save_recommendations(conn: &Connection, recs: &[AiRecommendation]) -> Result<()> {
        for r in recs {
            let auth_json =
                serde_json::to_string(&r.recommended_authors).unwrap_or_else(|_| "[]".to_string());
            let conc_json =
                serde_json::to_string(&r.matched_concepts).unwrap_or_else(|_| "[]".to_string());

            conn.execute(
                "INSERT INTO ai_recommendations (
                    id, paper_id, recommended_paper_id, recommended_title, recommended_authors_json,
                    recommended_year, recommended_venue, recommended_doi, score, reason,
                    matched_concepts_json, confidence_label, recommendation_mode, feedback_status,
                    feedback_note, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, datetime('now'), datetime('now'))
                 ON CONFLICT(paper_id, recommended_paper_id) DO UPDATE SET
                    score = excluded.score,
                    reason = excluded.reason,
                    matched_concepts_json = excluded.matched_concepts_json,
                    confidence_label = excluded.confidence_label,
                    recommendation_mode = excluded.recommendation_mode,
                    updated_at = datetime('now')",
                params![
                    r.id, r.paper_id, r.recommended_paper_id, r.recommended_title, auth_json,
                    r.recommended_year, r.recommended_venue, r.recommended_doi, r.score, r.reason,
                    conc_json, r.confidence_label, r.recommendation_mode, r.feedback_status, r.feedback_note
                ],
            )?;
        }
        Ok(())
    }

    pub fn update_recommendation_feedback(
        conn: &Connection,
        id: &str,
        status: &str,
        note: Option<&str>,
    ) -> Result<()> {
        conn.execute(
            "UPDATE ai_recommendations
             SET feedback_status = ?1,
                 feedback_note = ?2,
                 updated_at = datetime('now')
             WHERE id = ?3",
            params![status, note, id],
        )?;
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Evaluations
    // -------------------------------------------------------------------------

    pub fn list_evaluations(conn: &Connection) -> Result<Vec<AiEvaluationResult>> {
        let mut stmt = conn.prepare(
            "SELECT id, benchmark_suite, provider_id, model_id, total_tests, passed_tests,
                    citation_accuracy, abstention_accuracy, avg_latency_ms, details_json, evaluated_at
             FROM ai_evaluation_results
             ORDER BY evaluated_at DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(AiEvaluationResult {
                id: row.get(0)?,
                benchmark_suite: row.get(1)?,
                provider_id: row.get(2)?,
                model_id: row.get(3)?,
                total_tests: row.get(4)?,
                passed_tests: row.get(5)?,
                citation_accuracy: row.get(6)?,
                abstention_accuracy: row.get(7)?,
                avg_latency_ms: row.get(8)?,
                details_json: row.get(9)?,
                evaluated_at: row.get(10)?,
            })
        })?;

        let mut evals = Vec::new();
        for r in rows {
            evals.push(r?);
        }
        Ok(evals)
    }

    pub fn save_evaluation(conn: &Connection, e: &AiEvaluationResult) -> Result<()> {
        conn.execute(
            "INSERT INTO ai_evaluation_results (
                id, benchmark_suite, provider_id, model_id, total_tests, passed_tests,
                citation_accuracy, abstention_accuracy, avg_latency_ms, details_json, evaluated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, datetime('now'))",
            params![
                e.id,
                e.benchmark_suite,
                e.provider_id,
                e.model_id,
                e.total_tests,
                e.passed_tests,
                e.citation_accuracy,
                e.abstention_accuracy,
                e.avg_latency_ms,
                e.details_json
            ],
        )?;
        Ok(())
    }

    // -------------------------------------------------------------------------
    // Fine-Tuning Jobs
    // -------------------------------------------------------------------------

    pub fn list_finetuning_jobs(conn: &Connection) -> Result<Vec<AiFinetuningJob>> {
        let mut stmt = conn.prepare(
            "SELECT id, model_name, adapter_name, hardware_check, dataset_size, train_val_split_ratio,
                    epochs, learning_rate, status, progress_percent, stage_message, adapter_path,
                    eval_loss, model_card_json, created_at, updated_at
             FROM ai_finetuning_jobs
             ORDER BY created_at DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(AiFinetuningJob {
                id: row.get(0)?,
                model_name: row.get(1)?,
                adapter_name: row.get(2)?,
                hardware_check: row.get(3)?,
                dataset_size: row.get(4)?,
                train_val_split_ratio: row.get(5)?,
                epochs: row.get(6)?,
                learning_rate: row.get(7)?,
                status: row.get(8)?,
                progress_percent: row.get(9)?,
                stage_message: row.get(10)?,
                adapter_path: row.get(11)?,
                eval_loss: row.get(12)?,
                model_card_json: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;

        let mut jobs = Vec::new();
        for r in rows {
            jobs.push(r?);
        }
        Ok(jobs)
    }

    pub fn get_finetuning_job(conn: &Connection, id: &str) -> Result<Option<AiFinetuningJob>> {
        let mut stmt = conn.prepare(
            "SELECT id, model_name, adapter_name, hardware_check, dataset_size, train_val_split_ratio,
                    epochs, learning_rate, status, progress_percent, stage_message, adapter_path,
                    eval_loss, model_card_json, created_at, updated_at
             FROM ai_finetuning_jobs
             WHERE id = ?1"
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(AiFinetuningJob {
                id: row.get(0)?,
                model_name: row.get(1)?,
                adapter_name: row.get(2)?,
                hardware_check: row.get(3)?,
                dataset_size: row.get(4)?,
                train_val_split_ratio: row.get(5)?,
                epochs: row.get(6)?,
                learning_rate: row.get(7)?,
                status: row.get(8)?,
                progress_percent: row.get(9)?,
                stage_message: row.get(10)?,
                adapter_path: row.get(11)?,
                eval_loss: row.get(12)?,
                model_card_json: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save_finetuning_job(conn: &Connection, j: &AiFinetuningJob) -> Result<()> {
        conn.execute(
            "INSERT INTO ai_finetuning_jobs (
                id, model_name, adapter_name, hardware_check, dataset_size, train_val_split_ratio,
                epochs, learning_rate, status, progress_percent, stage_message, adapter_path,
                eval_loss, model_card_json, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                progress_percent = excluded.progress_percent,
                stage_message = excluded.stage_message,
                adapter_path = excluded.adapter_path,
                eval_loss = excluded.eval_loss,
                model_card_json = excluded.model_card_json,
                updated_at = datetime('now')",
            params![
                j.id, j.model_name, j.adapter_name, j.hardware_check, j.dataset_size,
                j.train_val_split_ratio, j.epochs, j.learning_rate, j.status,
                j.progress_percent, j.stage_message, j.adapter_path, j.eval_loss, j.model_card_json
            ],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;

    #[test]
    fn test_ai_repo_providers_and_settings() {
        let db = Database::open_in_memory().unwrap();
        let conn = db.lock().unwrap();

        // Providers list should contain seeded providers
        let providers = AiRepository::list_providers(&conn).unwrap();
        assert!(
            !providers.is_empty(),
            "Expected seeded providers in database"
        );

        let ollama = providers.iter().find(|p| p.id == "ollama_local").unwrap();
        assert!(ollama.is_local);
        assert_eq!(ollama.access_category, "local");

        // Settings test
        let mut settings = AiRepository::get_ai_settings(&conn).unwrap();
        assert!(settings.never_use_paid_apis);
        assert!(!settings.local_only_mode);

        settings.local_only_mode = true;
        AiRepository::update_ai_settings(&conn, &settings).unwrap();

        let updated = AiRepository::get_ai_settings(&conn).unwrap();
        assert!(updated.local_only_mode);
    }

    #[test]
    fn test_ai_repo_chunks_and_fts_search() {
        let db = Database::open_in_memory().unwrap();
        let conn = db.lock().unwrap();

        conn.execute(
            "INSERT INTO papers (id, title, clean_title_key, is_open_access, has_file, is_saved, created_at, updated_at)
             VALUES ('paper_1', 'Attention Is All You Need', 'attention is all you need', 1, 1, 1, datetime('now'), datetime('now'))",
            [],
        ).unwrap();

        let chunk = AiPaperChunk {
            id: "paper_1_chunk_0".into(),
            paper_id: "paper_1".into(),
            chunk_index: 0,
            page_number: 3,
            section_heading: Some("Methodology".into()),
            content_text: "We propose a novel transformer architecture for research paper retrieval and question answering.".into(),
            token_count: 18,
            embedding_json: None,
            created_at: "2026-10-25T12:00:00Z".into(),
        };

        AiRepository::insert_chunks(&conn, &[chunk]).unwrap();

        let count = AiRepository::count_chunks_for_paper(&conn, "paper_1").unwrap();
        assert_eq!(count, 1);

        // FTS search
        let results =
            AiRepository::search_chunks(&conn, "transformer architecture", Some("paper_1"), 5)
                .unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].page_number, 3);
        assert_eq!(results[0].section_heading.as_deref(), Some("Methodology"));
    }
}

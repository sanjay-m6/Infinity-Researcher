# Phase 1: AI Integration and RAG Engine Audit

This audit evaluates the AI provider infrastructure, task routing, section-level RAG chunking, hardware telemetry, and prompt generation in **Infinity Researcher**.

---

## 1. Provider Registry and Model Architecture (`src/features/ai-hub/`)

Infinity Researcher supports a hybrid local and remote AI architecture, allowing researchers to prioritize data privacy with offline models or leverage high-throughput cloud endpoints:

```mermaid
flowchart TD
    UserQuery["Researcher Query / Task"] --> TaskRouter{"ai_provider_task_routes"}
    TaskRouter -->|quick_summary| LocalModel["Local LLM (Ollama / LM Studio)"]
    TaskRouter -->|deep_analysis| CloudModel["Cloud LLM (Groq / Anthropic / Gemini / OpenAI)"]
    TaskRouter -->|embeddings| Embedder["Embedding Model (bge-small / text-embedding-3)"]
    
    SubGraph RAG["Shared Scholarly RAG Pipeline"]
        PaperDoc["Target Research Paper"] --> SectionChunker["Section & Page Chunker"]
        SectionChunker --> ChunksTable[("ai_paper_chunks (SQLite)")]
        ChunksTable --> PassageMatcher["Passage Retrieval & Citation Grounding"]
    end
    
    PassageMatcher --> PromptContext["Grounded Prompt Context + Page Snippets"]
    PromptContext --> TaskRouter
```

### Provider Categories Supported:
1. **Local Runtimes**:
   - **Ollama**: Default port `11434`, zero telemetry, local GGUF execution.
   - **LM Studio**: OpenAI-compatible local server on port `1234`.
   - **vLLM / LocalAI**: High-concurrency self-hosted inference servers.
2. **Cloud APIs**:
   - **Groq**: Ultra-low latency Llama-3 inference.
   - **Anthropic**: Claude 3.5 Sonnet for nuanced literature reviews.
   - **Google Gemini**: Large context-window document analysis.
   - **OpenAI**: GPT-4o / text-embedding-3 models.
   - **OpenRouter & Mistral**: Broad multi-model endpoints.

---

## 2. Scholarly RAG Pipeline & Citation Grounding

1. **Page- and Section-Aware Chunking**:
   - `index_paper_for_rag` slices papers into structured chunks (`ai_paper_chunks` table).
   - Each chunk retains its canonical `paper_id`, `page_number`, `section_heading` (e.g., Abstract, Methodology, Results), and exact character bounds.
2. **Strict Citation Evidence**:
   - AI responses include structured `AiChunkCitation` records containing `snippet`, `paper_title`, and `page_number`.
   - Clicking a citation chip in the frontend immediately navigates the PDF reader directly to that page and highlights the source quote.

---

## 3. Hardware & GPU Telemetry

The command `get_ai_hardware_info` interrogates the host system:
- **GPU Architecture**: Detects NVIDIA CUDA, Apple Metal, or AMD ROCm devices.
- **VRAM Telemetry**: Measures free and total video memory, warning researchers if a selected local model exceeds physical VRAM limits.
- **CPU & Memory**: Measures available system RAM and active logical cores.

---

## 4. UI Modernization Targets (Phase 4 & 6)

1. **Token-by-Token Streaming Visuals**:
   - Replace chunked text updates with a smooth typewriter pulse effect using Motion for React.
2. **Hardware Load Meters**:
   - Design modern animated gauge meters for VRAM and CPU utilization in the AI Models tab.
3. **Citation Chips**:
   - Replace plain badges with interactive verified citation cards that show hover preview popovers.


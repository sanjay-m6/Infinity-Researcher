# Phase 14 AI Provider Integration

## 1. Multi-Provider Architecture

Infinity Researcher supports both local offline runtimes and optional cloud AI providers through a unified provider abstraction layer.

### 1.1 Supported Provider Tiers

| Provider | Category | Auth Type | Default Model | Primary Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Ollama Local Runtime** | Local Runtime | None | `llama3.2:latest` | Zero-cost, 100% offline, privacy-first research |
| **LM Studio Local Server** | Local Runtime | None | `local-model` | Local model debugging & custom GGUF quantization |
| **Anthropic Claude** | Remote Cloud | API Key | `claude-3-5-sonnet-20241022` | Complex multi-paper synthesis & mathematical analysis |
| **OpenAI-Compatible** | Remote Cloud | API Key / Bearer | `gpt-4o-mini` | General RAG question answering |

---

## 2. Dynamic Task Routing

Users can configure specific models for distinct tasks via `AiProviderTaskRoute`:
- `qa_citations`: Precision extraction for grounded question answering.
- `quick_summary`: Fast executive summarization.
- `deep_analysis`: Full methodology and reproducibility inspection.
- `comparison`: Multi-paper matrix synthesis.
- `recommendation`: Transparent library recommendations.

---

## 3. Graceful Error Handling & Fallbacks

- **Offline Detection**: If Ollama or LM Studio is unreachable, clear diagnostic steps are returned (e.g., verifying `ollama serve` is running at `http://127.0.0.1:11434`).
- **Context Limit Bounding**: Input chunks are dynamically bounded to prevent exceeding model context windows.
- **JSON Recovery**: If an LLM returns markdown fences around JSON or conversational preambles, `extractJsonFromResponse` strips extraneous tokens and recovers the structured payload cleanly.
- **Browser Preview Fallback**: In non-Tauri preview environments, deterministic simulated mock payloads allow full UI development and testing without requiring live desktop IPC.


# Infinity Researcher — AI Model & Heuristics Notice

**Product Name:** Infinity Researcher  
**Application Version:** 0.1.0  
**Publisher:** Infinity Web Technology  
**Author:** Sanjay  

---

## 1. Built-in Deterministic Research Engines (No Bundled Binary Weights)

Infinity Researcher ships with zero proprietary or third-party neural network weights pre-bundled in the installer:

1. **Text Similarity Engine:**
   - **Architecture:** Pure Rust implementation utilizing n-gram shingling, MinHash locality-sensitive hashing, and Jaccard distance coefficient calculation.
   - **Weight Distribution:** None. Operates completely through deterministic algorithms compiled directly into the application binary.
   - **License:** First-party code under application terms.

2. **Academic Writing & AI-Signal Heuristics:**
   - **Architecture:** Statistical stylistic signal analysis (burstiness, perplexity heuristics, transition-density distribution, and academic syntactic phrasing markers).
   - **Weight Distribution:** None. Pure mathematical evaluation executed locally on CPU without remote execution.

---

## 2. Optional User-Configured AI Models

Infinity Researcher allows scholars to connect optional local or cloud AI models for deep matrix claim extraction, grounded copilot synthesis, and writing polishing.

| Model / Provider | Connection Type | Weight Distribution | Governing License / Terms |
| :--- | :--- | :--- | :--- |
| **Ollama (e.g. Llama 3, Mistral, Qwen)** | Local HTTP REST (`localhost:11434`) | None (User manages model pulls via Ollama CLI) | Meta Llama 3 Community License / Apache 2.0 (per model) |
| **Hugging Face (`sentence-transformers`)** | Local Python Engine (Optional) | Downloaded only upon explicit user request | Apache-2.0 / MIT (per model card) |
| **OpenAI API (`gpt-4o`, `o3-mini`)** | Cloud API (User-supplied API Key) | Cloud hosted by OpenAI; no weights downloaded | OpenAI Terms of Service |
| **Anthropic API (`claude-3-5-sonnet`)** | Cloud API (User-supplied API Key) | Cloud hosted by Anthropic; no weights downloaded | Anthropic Commercial Terms |
| **Google Gemini API (`gemini-1.5-pro`)** | Cloud API (User-supplied API Key) | Cloud hosted by Google; no weights downloaded | Google AI Studio Terms of Service |

---

## 3. Responsible AI & Download Guarantees

- **Zero Silent Downloads:** Infinity Researcher will never initiate multi-gigabyte neural network downloads in the background without clear user awareness and confirmation.
- **Air-Gapped Operation:** All paper discovery, SQLite querying, PDF reading, note taking, and local similarity scanning operate 100% offline without connecting to any AI model.

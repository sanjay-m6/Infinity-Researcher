# Research Integrity Model Registry & Open-Source References

## 1. Registry Architecture & Governance

The Research Integrity & Academic Writing Suite maintains a strict, auditable model registry. No machine learning model is bundled blindly or executed without verification. All models must satisfy:

1. **Explicit License Review**: Permissive open-source licenses (Apache-2.0, MIT) compatible with desktop distribution.
2. **Safe Serialization Formats**: Only `safetensors` or native ONNX weights are permitted. Unpickled checkpoints (`.bin`, `.pkl`) are blocked to prevent arbitrary remote code execution.
3. **Hardware & Resource Budgets**: CPU fallback must always be supported with graceful memory bounds ($\le 1.5\text{ GB RAM}$).
4. **Transparent Capability Scope**: Clear distinction between literal text matching, semantic candidate retrieval, and experimental stylometric signal estimation.
5. **Opt-In Download Manager**: Large model weights ($\ge 50\text{ MB}$) are never bundled into the installer binary; they are downloaded on-demand only when the user explicitly requests advanced neural features.

---

## 2. Open-Source Foundations & Reference Architectures

### 2.1 Noplag Engine
- **Repository**: [https://github.com/NoplagLabs/noplag-engine](https://github.com/NoplagLabs/noplag-engine)
- **License**: Apache-2.0
- **Verified Capabilities**: Winnowing fingerprinting, token chunking, inverted index overlap matching, and seed-and-extend literal alignment over a user-indexed local corpus.
- **Architectural Decision**: Evaluated and adapted into our first-party Rust and Python engine modules (`integrity_service.rs` and `integrity/fingerprint.py`). Rather than requiring an external PostgreSQL deployment with `pg_trgm` which would break the desktop zero-configuration philosophy, our engine indexes Winnowing fingerprints directly into local SQLite 3 with composite B-Tree indexes.

### 2.2 AcademicGuard
- **Repository**: [https://github.com/sunilgentyala/academicguard](https://github.com/sunilgentyala/academicguard)
- **License**: MIT
- **Verified Capabilities**: Academic writing conventions, reference validation, and basic stylometric checks.
- **Architectural Decision**: Served as an algorithmic reference for structural document segmentation (abstract, methodology, results, discussion, references) and citation syntax pattern matching.

### 2.3 AEGIS Academic Integrity Checker
- **Repository**: [https://github.com/sunilgentyala/aegis-integrity](https://github.com/sunilgentyala/aegis-integrity)
- **License**: MIT
- **Verified Capabilities**: Citation integrity checks and corpus validation.
- **Architectural Decision**: Integrated reference concepts for citation integrity preservation and DOI verification during academic writing transformations.

---

## 3. Evaluated Hugging Face Models

### 3.1 Semantic Candidate Retrieval: `sentence-transformers/all-MiniLM-L6-v2`
- **Repository ID**: `sentence-transformers/all-MiniLM-L6-v2`
- **License**: Apache-2.0
- **Architecture**: 6-layer BERT-style cross-encoder / bi-encoder distillation
- **Embedding Dimensions**: 384
- **Maximum Sequence Length**: 256 wordpiece tokens (with 128-token overlapping sliding chunks for full document coverage)
- **Weights Size**: ~80 MB (Available in `safetensors` format)
- **Inference Runtime**: CPU-first via ONNX Runtime / `torch.compile` / native PyTorch CPU; optional Vulkan/DirectML/CUDA acceleration where detected.
- **Intended Use**: Candidate passage retrieval only. Retreives semantically similar paragraphs across large corpora to surface passages that paraphrase or share technical formulations.
- **Critical Policy**: Cosine similarity $\ge 0.85$ indicates *semantic candidate proximity for human review*, **never** a conclusive finding of plagiarism.

---

### 3.2 AI-Writing Signal Detector: `Hello-SimpleAI/chatgpt-detector-roberta`
- **Repository ID**: `Hello-SimpleAI/chatgpt-detector-roberta`
- **Model Card**: [https://huggingface.co/Hello-SimpleAI/chatgpt-detector-roberta](https://huggingface.co/Hello-SimpleAI/chatgpt-detector-roberta)
- **License**: Apache-2.0
- **Architecture**: RoBERTa-base sequence classification checkpoint fine-tuned on the HC3 (Human ChatGPT Comparison Corpus) dataset (2023).
- **Parameters**: 125M (~500 MB weights)
- **Evaluated Limitations**:
  - Trained primarily on early 2023 ChatGPT (GPT-3.5) outputs.
  - Demonstrates high false-positive rates on formal, highly structured academic prose (e.g., standard biomedical methodologies, mathematical introductions, non-native English writing).
  - Susceptible to perturbation, light editing, and prompt variations.
- **Status in Application**: **Experimental / Optional Plugin**. Default engine operates in local statistical baseline mode. Neural classification requires explicit opt-in and displays mandatory uncertainty caveats.

---

### 3.3 Historical Reference Detector: `openai-community/roberta-base-openai-detector`
- **Repository ID**: `openai-community/roberta-base-openai-detector`
- **Model Card**: [https://huggingface.co/openai-community/roberta-base-openai-detector](https://huggingface.co/openai-community/roberta-base-openai-detector)
- **License**: Modified MIT
- **Architecture**: RoBERTa-base fine-tuned on GPT-2 1.5B model outputs.
- **Status in Application**: **Deprecated / Non-Production Reference Only**. The official model card states that it was trained for GPT-2 outputs and cannot be relied upon for modern LLMs or academic integrity investigations. It is retained strictly as an algorithmic baseline in evaluation scripts.

---

## 4. Built-in Local Statistical Baseline (`statistical_baseline_v1`)

To guarantee immediate out-of-the-box operation on any desktop machine without downloading gigabytes of model weights:
- **Identifier**: `statistical_baseline_v1`
- **Engine**: In-house Rust and Python stylometric parser.
- **Download Size**: 0 MB (Embedded first-party code).
- **Memory Footprint**: < 10 MB RAM.
- **Latency**: < 15 ms per 1,000 words on CPU.
- **Metrics Evaluated**:
  - Lexical Burstiness (sentence length standard deviation $\sigma$)
  - Shannon Word Entropy ($H$)
  - Type-Token Ratio across sliding 100-word windows
  - Punctuation and transition distribution
- **Enforcement**: Inputs $< 80$ words return `status: "insufficient_text"`.

import {
  LiteraturePaper,
  LiteratureSurveyRow,
  ResearchGapItem,
  WritingSection,
  ResearchNote,
  ExtractedAssetItem,
  SimilarityMatchFinding,
} from "./types";

export const SAMPLE_LITERATURE_PAPERS: LiteraturePaper[] = [
  {
    id: "paper_ids_cloud_01",
    title: "Deep Neural Network Architectures for Cloud Intrusion Detection: A Benchmark",
    authors: ["H. Al-Mansoor", "K. Tanaka", "R. Vance"],
    publicationYear: 2024,
    abstract:
      "Cloud infrastructures exhibit high-throughput distributed traffic patterns that degrade classical signature-based IDS. We propose a hybrid CNN-BiLSTM model evaluated on CSE-CIC-IDS2018 achieving 98.4% detection recall.",
    venue: "IEEE Transactions on Dependable and Secure Computing",
    doi: "10.1109/TDSC.2024.3129845",
    sourceUrl: "https://ieeexplore.ieee.org/document/3129845",
    hasFullText: true,
    isOpenAccess: true,
    extractionStatus: "extracted",
    tags: ["Deep Learning", "CNN-BiLSTM", "Cloud IDS"],
    documentHash: "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890",
  },
  {
    id: "paper_ids_cloud_02",
    title:
      "Zero-Day Attack Detection in Multi-Tenant Kubernetes Clusters Using Contrastive Learning",
    authors: ["S. Zhang", "M. Rostami", "E. Dubois"],
    publicationYear: 2023,
    abstract:
      "Multi-tenant container environments introduce ephemeral IP allocation challenges. We introduce contrastive self-supervised embeddings to isolate polymorphic payload anomalies without requiring labeled ground truth.",
    venue: "ACM CCS",
    doi: "10.1145/3576915.3623101",
    sourceUrl: "https://dl.acm.org/doi/10.1145/3576915.3623101",
    hasFullText: true,
    isOpenAccess: false,
    extractionStatus: "extracted",
    tags: ["Zero-Day", "Kubernetes", "Contrastive Learning"],
    documentHash: "b2c3d4e5f6a17890b2c3d4e5f6a17890b2c3d4e5f6a17890b2c3d4e5f6a17890",
  },
  {
    id: "paper_ids_cloud_03",
    title:
      "Evaluating Computational Latency and Adversarial Robustness of Transformer-Based Network Probes",
    authors: ["A. Chen", "L. Rossi", "N. Patel"],
    publicationYear: 2024,
    abstract:
      "While transformer models offer superior sequence modeling, their quadratic memory footprint incurs latency penalties during 100 Gbps cloud gateway inspection. We measure trade-offs between quantization and adversarial evasion.",
    venue: "USENIX Security Symposium",
    doi: "10.5555/usenix.sec24.chen",
    sourceUrl: "https://www.usenix.org/conference/sec24/chen",
    hasFullText: true,
    isOpenAccess: true,
    extractionStatus: "extracted",
    tags: ["Transformers", "Latency", "Adversarial Robustness"],
    documentHash: "c3d4e5f6a1b27890c3d4e5f6a1b27890c3d4e5f6a1b27890c3d4e5f6a1b27890",
  },
  {
    id: "paper_ids_cloud_04",
    title: "Cross-Cloud Network Telemetry for Distributed Denial of Service Mitigation",
    authors: ["D. Okafor", "P. Lindqvist"],
    publicationYear: 2022,
    abstract:
      "Distributed telemetry protocol across AWS and Azure VPCs to synchronize attack signatures in sub-second latency.",
    venue: "IEEE CloudNet",
    doi: "10.1109/CloudNet.2022.9981244",
    hasFullText: true,
    isOpenAccess: true,
    extractionStatus: "extracted",
    tags: ["DDoS", "Cross-Cloud", "Telemetry"],
    documentHash: "d4e5f6a1b2c37890d4e5f6a1b2c37890d4e5f6a1b2c37890d4e5f6a1b2c37890",
  },
  {
    id: "paper_ids_cloud_05",
    title:
      "Graph Neural Networks for Microservice Flow Anomaly Detection in Serverless Architectures",
    authors: ["J. Miller", "F. Weber"],
    publicationYear: 2023,
    abstract:
      "Serverless execution graphs exhibit asynchronous invocations. We construct dynamic call graphs to detect unauthorized lateral data exfiltration.",
    venue: "IEEE TDSC",
    doi: "10.1109/TDSC.2023.3289012",
    hasFullText: false,
    isOpenAccess: false,
    extractionStatus: "partially_extracted",
    extractionWarning:
      "Full text restricted behind publisher portal; metadata and abstract parsed.",
    tags: ["Serverless", "Graph Neural Networks", "Lateral Movement"],
    documentHash: "e5f6a1b2c3d47890e5f6a1b2c3d47890e5f6a1b2c3d47890e5f6a1b2c3d47890",
  },
];

export const SAMPLE_SURVEY_ROWS: LiteratureSurveyRow[] = [
  {
    paperId: "paper_ids_cloud_01",
    paperTitle:
      "Deep Neural Network Architectures for Cloud Intrusion Detection: A Benchmark",
    authors: "Al-Mansoor et al. (2024)",
    year: 2024,
    objective:
      "Real-time classification of multi-vector cloud intrusions at gateway boundaries",
    methodology:
      "Hybrid CNN for packet header spatial features + BiLSTM for flow temporal dependencies",
    dataset: "CSE-CIC-IDS2018 (synthetic virtual network flows, 1.2M packets)",
    results: "98.4% Recall, 97.9% F1-score; 3.2 ms mean packet processing latency",
    limitations:
      "Tested on synthetic virtual testbeds; lacks validation against live encrypted HTTP/3 traffic",
    futureWork:
      "Investigate hardware-accelerated FPGA offloading for line-rate 100 Gbps deployments",
    evidence: {
      objective: {
        id: "ev_01_obj",
        paperId: "paper_ids_cloud_01",
        paperTitle:
          "Deep Neural Network Architectures for Cloud Intrusion Detection: A Benchmark",
        pageNumber: 2,
        verbatimExcerpt:
          "Our principal research objective is to develop a low-latency neural inspection pipeline capable of classifying multi-vector attacks at virtual cloud gateways before tenant container penetration.",
        contextSection: "1. Introduction",
        confidenceScore: 0.96,
        supportRating: "direct",
        extractionMethod: "pdf_text",
        verifiedByResearcher: true,
      },
      methodology: {
        id: "ev_01_meth",
        paperId: "paper_ids_cloud_01",
        paperTitle:
          "Deep Neural Network Architectures for Cloud Intrusion Detection: A Benchmark",
        pageNumber: 4,
        verbatimExcerpt:
          "The architecture couples a 1D-CNN (kernel size 3, 64 filters) for spatial header extraction with a bidirectional LSTM layer (128 units) to capture inter-flow temporal dependencies.",
        contextSection: "3. Methodology",
        confidenceScore: 0.94,
        supportRating: "direct",
        extractionMethod: "pdf_text",
        verifiedByResearcher: true,
      },
      results: {
        id: "ev_01_res",
        paperId: "paper_ids_cloud_01",
        paperTitle:
          "Deep Neural Network Architectures for Cloud Intrusion Detection: A Benchmark",
        pageNumber: 7,
        verbatimExcerpt:
          "Across all 7 attack vectors in CSE-CIC-IDS2018, the proposed CNN-BiLSTM achieved a macro-averaged recall of 98.4% and an F1-score of 97.9%, outperforming random forest baselines by 4.2%.",
        contextSection: "5. Experimental Evaluation",
        confidenceScore: 0.98,
        supportRating: "direct",
        extractionMethod: "pdf_text",
        verifiedByResearcher: true,
      },
      limitations: {
        id: "ev_01_lim",
        paperId: "paper_ids_cloud_01",
        paperTitle:
          "Deep Neural Network Architectures for Cloud Intrusion Detection: A Benchmark",
        pageNumber: 9,
        verbatimExcerpt:
          "A critical limitation is that our experiments relied on simulated synthetic packet traces in an isolated cloud testbed; real-world payload obfuscation and encrypted HTTP/3 streams were not evaluated.",
        contextSection: "6. Discussion & Limitations",
        confidenceScore: 0.95,
        supportRating: "direct",
        extractionMethod: "pdf_text",
        verifiedByResearcher: true,
      },
    },
  },
  {
    paperId: "paper_ids_cloud_02",
    paperTitle:
      "Zero-Day Attack Detection in Multi-Tenant Kubernetes Clusters Using Contrastive Learning",
    authors: "Zhang et al. (2023)",
    year: 2023,
    objective:
      "Unsupervised anomaly detection for novel zero-day container escapes without labeled attack signatures",
    methodology:
      "Self-supervised contrastive embedding of Linux eBPF syscall telemetry sequences",
    dataset: "Custom Kubernetes benchmark (50 worker nodes, synthetic container escapes)",
    results: "94.2% detection rate on unseen exploit variants with 0.8% false alarm rate",
    limitations:
      "Requires eBPF kernel instrumentation privileges, posing potential container host attack surfaces",
    futureWork:
      "Lightweight sidecar agents that decouple host kernel telemetry from untrusted tenant pods",
    evidence: {
      objective: {
        id: "ev_02_obj",
        paperId: "paper_ids_cloud_02",
        paperTitle:
          "Zero-Day Attack Detection in Multi-Tenant Kubernetes Clusters Using Contrastive Learning",
        pageNumber: 1,
        verbatimExcerpt:
          "We address the problem of detecting zero-day container escape anomalies in shared multi-tenant clusters without reliance on prior exploit signature signatures.",
        contextSection: "1. Problem Formulation",
        confidenceScore: 0.93,
        supportRating: "direct",
        extractionMethod: "pdf_text",
        verifiedByResearcher: true,
      },
      limitations: {
        id: "ev_02_lim",
        paperId: "paper_ids_cloud_02",
        paperTitle:
          "Zero-Day Attack Detection in Multi-Tenant Kubernetes Clusters Using Contrastive Learning",
        pageNumber: 11,
        verbatimExcerpt:
          "The requirement for CAP_SYS_ADMIN privileges to load eBPF telemetry probes remains a substantial barrier in strict managed cloud environments (e.g., AWS Fargate).",
        contextSection: "7. Limitations",
        confidenceScore: 0.92,
        supportRating: "direct",
        extractionMethod: "pdf_text",
        verifiedByResearcher: true,
      },
    },
  },
  {
    paperId: "paper_ids_cloud_03",
    paperTitle:
      "Evaluating Computational Latency and Adversarial Robustness of Transformer-Based Network Probes",
    authors: "Chen et al. (2024)",
    year: 2024,
    objective:
      "Quantifying inference latency and adversarial evasion vulnerabilities of transformer-based IDS probes",
    methodology:
      "BERT-style tokenized packet inspection under Projected Gradient Descent (PGD) payload perturbation",
    dataset: "CIC-DDoS2019 and real-world enterprise edge gateway logs (450 GB)",
    results:
      "Identified that injecting 3 dead-byte payload perturbations drops detection recall from 96.1% to 61.4%",
    limitations:
      "Defense mechanism adds 18.4% additional GPU inference latency, constraining real-time deployment",
    futureWork: "Certified robustness guarantees for streaming packet transformers",
    evidence: {
      results: {
        id: "ev_03_res",
        paperId: "paper_ids_cloud_03",
        paperTitle:
          "Evaluating Computational Latency and Adversarial Robustness of Transformer-Based Network Probes",
        pageNumber: 6,
        verbatimExcerpt:
          "Our adversarial evaluation reveals that minimal byte padding attacks cause the model's recall to degrade precipitously from 96.1% to 61.4%, exposing acute evasion sensitivity.",
        contextSection: "4. Adversarial Perturbation Results",
        confidenceScore: 0.97,
        supportRating: "direct",
        extractionMethod: "pdf_text",
        verifiedByResearcher: true,
      },
      limitations: {
        id: "ev_03_lim",
        paperId: "paper_ids_cloud_03",
        paperTitle:
          "Evaluating Computational Latency and Adversarial Robustness of Transformer-Based Network Probes",
        pageNumber: 8,
        verbatimExcerpt:
          "Adversarial retraining mitigates evasion but increases inference latency by 18.4%, rendering line-rate inspection unfeasible without specialized NPU hardware.",
        contextSection: "6. Limitations & Cost Analysis",
        confidenceScore: 0.91,
        supportRating: "direct",
        extractionMethod: "pdf_text",
        verifiedByResearcher: true,
      },
    },
  },
];

export const SAMPLE_RESEARCH_GAPS: ResearchGapItem[] = [
  {
    id: "gap_01_realworld_eval",
    title:
      "Lack of High-Throughput Real-World Validation Across Encrypted HTTP/3 Cloud Streams",
    description:
      "Multiple independent studies (Al-Mansoor 2024, Chen 2024) rely exclusively on synthetic packet traces (CSE-CIC-IDS2018). High-rate QUIC/HTTP/3 encrypted traffic with dynamic payload multiplexing remains unaddressed.",
    category: "missing_evaluations",
    supportingPaperIds: ["paper_ids_cloud_01", "paper_ids_cloud_03"],
    evidencePassages: [
      {
        paperTitle:
          "Deep Neural Network Architectures for Cloud Intrusion Detection (Al-Mansoor 2024)",
        page: 9,
        passage:
          "A critical limitation is that our experiments relied on simulated synthetic packet traces in an isolated cloud testbed; real-world payload obfuscation and encrypted HTTP/3 streams were not evaluated.",
      },
      {
        paperTitle:
          "Evaluating Computational Latency and Adversarial Robustness (Chen 2024)",
        page: 8,
        passage:
          "Payload encryption models were not tested under continuous stream multiplexing, representing a notable gap in practical applicability.",
      },
    ],
    suggestedResearchQuestion:
      "How can deep learning flow classifiers maintain >95% recall over encrypted HTTP/3 streams without decrypting payload data?",
    potentialConfidence: "strong_candidate",
    caveatNotice:
      "Identified as a candidate gap from limitations in collected papers. Ongoing proprietary cloud vendor evaluations may exist outside open literature.",
  },
  {
    id: "gap_02_ebpf_privilege",
    title: "Host Privilege Dependency in Containerized Cloud Telemetry",
    description:
      "State-of-the-art anomaly detectors (Zhang 2023) require elevated eBPF kernel capabilities (CAP_SYS_ADMIN), which violates strict multi-tenant isolation policies in managed serverless and container offerings.",
    category: "deployment_barriers",
    supportingPaperIds: ["paper_ids_cloud_02"],
    evidencePassages: [
      {
        paperTitle:
          "Zero-Day Attack Detection in Multi-Tenant Kubernetes Clusters (Zhang 2023)",
        page: 11,
        passage:
          "The requirement for CAP_SYS_ADMIN privileges to load eBPF telemetry probes remains a substantial barrier in strict managed cloud environments (e.g., AWS Fargate).",
      },
    ],
    suggestedResearchQuestion:
      "Can user-space sidecar probes with unprivileged telemetry approximate host-level eBPF detection fidelity?",
    potentialConfidence: "moderate_signal",
    caveatNotice:
      "Derived from Zhang et al. (2023). Unprivileged container telemetry models may have emerged in subsequent conference proceedings.",
  },
  {
    id: "gap_03_adversarial_latency",
    title: "Trade-Off Between Adversarial Hardening and Real-Time Line-Rate Latency",
    description:
      "Hardening neural network probes against adversarial evasion significantly inflates processing latency (Chen et al. report +18.4% overhead), causing buffer overflows at line-rate 100 Gbps speeds.",
    category: "conflicting_findings",
    supportingPaperIds: ["paper_ids_cloud_01", "paper_ids_cloud_03"],
    evidencePassages: [
      {
        paperTitle:
          "Evaluating Computational Latency and Adversarial Robustness (Chen 2024)",
        page: 8,
        passage:
          "Adversarial retraining mitigates evasion but increases inference latency by 18.4%, rendering line-rate inspection unfeasible without specialized NPU hardware.",
      },
    ],
    suggestedResearchQuestion:
      "What sparse or quantized network architectures can preserve adversarial robustness without exceeding sub-millisecond gateway latency budgets?",
    potentialConfidence: "strong_candidate",
    caveatNotice:
      "Evaluated on GPU hardware. Edge ASIC acceleration architectures may alter latency trade-offs.",
  },
];

export const SAMPLE_WRITING_SECTIONS: WritingSection[] = [
  {
    id: "sec_title",
    title: "Title & Abstract",
    content:
      "Robust and Low-Latency Intrusion Detection for Multi-Tenant Cloud Environments\n\nAbstract:\nCloud infrastructures face escalating threats from sophisticated multi-vector intrusions and zero-day container exploits. While deep neural networks achieve high detection accuracy on synthetic benchmarks, real-world deployment is bottlenecked by elevated host privilege requirements, adversarial evasion vulnerabilities, and throughput degradation under encrypted traffic. In this paper, we conduct a systematic literature survey of contemporary cloud intrusion detection architectures, categorize empirical trade-offs between model complexity and inspection latency, and formulate an evidence-grounded framework for resilient zero-trust cloud network monitoring.",
    claims: [
      {
        id: "cl_01",
        text: "Deep neural networks achieve high detection accuracy on synthetic benchmarks but suffer under encrypted traffic.",
        linkedPaperId: "paper_ids_cloud_01",
        linkedPaperTitle:
          "Deep Neural Network Architectures for Cloud Intrusion Detection (Al-Mansoor 2024)",
        linkedPage: 9,
        evidenceSnippet:
          "Our experiments relied on simulated synthetic packet traces in an isolated cloud testbed; real-world payload obfuscation and encrypted HTTP/3 streams were not evaluated.",
        supportRating: "direct",
      },
    ],
  },
  {
    id: "sec_related_work",
    title: "Related Work & Literature Review",
    content:
      "Recent investigations have explored diverse machine learning paradigms for cloud security. Al-Mansoor et al. [1] demonstrated that combining 1D-CNNs for packet headers with bidirectional LSTMs captures temporal flow correlations, achieving a 98.4% detection recall on CSE-CIC-IDS2018. However, their architecture was not evaluated against live encrypted protocols such as HTTP/3 [Al-Mansoor et al., 2024].\n\nConcurrently, unsupervised contrastive learning has emerged as a promising avenue for containerized environments. Zhang et al. [2] utilized Linux eBPF telemetry to detect zero-day anomalies in Kubernetes clusters with a 94.2% detection rate without labeled attack signatures. Nevertheless, their method demands CAP_SYS_ADMIN privileges, restricting adoption in managed container offerings like AWS Fargate [Zhang et al., 2023].\n\nFurthermore, adversarial robustness presents an acute challenge. Chen et al. [3] revealed that minimal dead-byte perturbations degrade transformer probe recall from 96.1% to 61.4%, while adversarial defense mechanisms introduce an 18.4% latency penalty that hinders line-rate 100 Gbps inspection [Chen et al., 2024].",
    claims: [
      {
        id: "cl_02",
        text: "Al-Mansoor et al. [1] achieved 98.4% recall on CSE-CIC-IDS2018 using a hybrid CNN-BiLSTM.",
        linkedPaperId: "paper_ids_cloud_01",
        linkedPaperTitle:
          "Deep Neural Network Architectures for Cloud Intrusion Detection (Al-Mansoor 2024)",
        linkedPage: 7,
        evidenceSnippet:
          "Across all 7 attack vectors in CSE-CIC-IDS2018, the proposed CNN-BiLSTM achieved a macro-averaged recall of 98.4% and an F1-score of 97.9%.",
        supportRating: "direct",
      },
      {
        id: "cl_03",
        text: "Zhang et al. [2] require CAP_SYS_ADMIN privileges for eBPF telemetry in Kubernetes.",
        linkedPaperId: "paper_ids_cloud_02",
        linkedPaperTitle:
          "Zero-Day Attack Detection in Multi-Tenant Kubernetes Clusters (Zhang 2023)",
        linkedPage: 11,
        evidenceSnippet:
          "The requirement for CAP_SYS_ADMIN privileges to load eBPF telemetry probes remains a substantial barrier in strict managed cloud environments.",
        supportRating: "direct",
      },
      {
        id: "cl_04",
        text: "Chen et al. [3] observed recall drops from 96.1% to 61.4% under dead-byte payload perturbations.",
        linkedPaperId: "paper_ids_cloud_03",
        linkedPaperTitle:
          "Evaluating Computational Latency and Adversarial Robustness (Chen 2024)",
        linkedPage: 6,
        evidenceSnippet:
          "Our adversarial evaluation reveals that minimal byte padding attacks cause the model's recall to degrade precipitously from 96.1% to 61.4%.",
        supportRating: "direct",
      },
    ],
  },
  {
    id: "sec_gaps",
    title: "Identified Research Gaps & Problem Formulation",
    content:
      "Synthesizing the collected evidence reveals three pivotal research gaps:\n\n1. Protocol Encryption Gap: Contemporary deep models evaluate plaintext packet headers rather than multiplexed HTTP/3 QUIC streams.\n2. Privilege Isolation Gap: Kernel-level eBPF monitoring conflicts with multi-tenant security policies in serverless architectures.\n3. Robustness-Throughput Dilemma: Existing adversarial defenses incur computational latency that exceeds sub-millisecond packet processing windows.",
    claims: [],
  },
];

export const SAMPLE_RESEARCH_NOTES: ResearchNote[] = [
  {
    id: "note_01",
    paperId: "paper_ids_cloud_01",
    paperTitle: "Al-Mansoor et al. (2024)",
    pageNumber: 4,
    category: "methodology",
    title: "CNN-BiLSTM Kernel Dimension Choice",
    content:
      "Authors chose 1D CNN kernel size 3 over 5 because it preserves tight IP header 4-byte word alignments while minimizing convolution parameters.",
    createdAt: "2026-10-28T14:20:00Z",
  },
  {
    id: "note_02",
    paperId: "paper_ids_cloud_03",
    paperTitle: "Chen et al. (2024)",
    pageNumber: 6,
    category: "empirical_finding",
    title: "Dead-Byte Evasion Vulnerability",
    content:
      "A mere 3-byte dead padding in the TCP payload shifted the self-attention weights completely away from the malicious shellcode sequence.",
    createdAt: "2026-10-28T15:10:00Z",
  },
];

export const SAMPLE_EXTRACTED_ASSETS: ExtractedAssetItem[] = [
  {
    id: "asset_fig_01",
    paperId: "paper_ids_cloud_01",
    paperTitle:
      "Deep Neural Network Architectures for Cloud Intrusion Detection (Al-Mansoor 2024)",
    assetType: "figure",
    title: "Figure 3: Hybrid CNN-BiLSTM Pipeline Architecture",
    caption:
      "Schematic diagram showing the dual-stream feature extraction pipeline: spatial packet header convolution and temporal flow recurrent recurrence.",
    pageNumber: 3,
    contentSnippet:
      "Virtual Network Interface -> 1D Convolution (64 filters) -> BiLSTM (128 units) -> Softmax Classifier",
    attributionNotice:
      "Extracted from IEEE TDSC (2024). Source attribution preserved under fair academic quotation.",
  },
  {
    id: "asset_tab_01",
    paperId: "paper_ids_cloud_01",
    paperTitle:
      "Deep Neural Network Architectures for Cloud Intrusion Detection (Al-Mansoor 2024)",
    assetType: "table",
    title: "Table 2: Detection Recall and Latency Across Attack Vectors",
    caption: "Performance metrics across 7 attack classes on CSE-CIC-IDS2018.",
    pageNumber: 7,
    tableData: [
      ["Attack Class", "Precision (%)", "Recall (%)", "F1 Score (%)", "Latency (ms)"],
      ["DDoS Low Orbit Ion Cannon", "99.1", "99.4", "99.2", "2.8"],
      ["Brute Force SSH", "98.2", "97.6", "97.9", "3.1"],
      ["SQL Injection", "96.4", "95.8", "96.1", "3.6"],
      ["Botnet ARES", "97.8", "98.1", "97.9", "3.2"],
    ],
    attributionNotice: "Extracted from Al-Mansoor et al. (2024).",
  },
];

export const SAMPLE_SIMILARITY_MATCHES: SimilarityMatchFinding[] = [
  {
    id: "sim_match_01",
    draftSpanStart: 120,
    draftSpanEnd: 235,
    draftExcerpt:
      "couples a 1D-CNN (kernel size 3, 64 filters) for spatial header extraction with a bidirectional LSTM layer (128 units) to capture inter-flow temporal dependencies.",
    sourcePaperId: "paper_ids_cloud_01",
    sourcePaperTitle:
      "Deep Neural Network Architectures for Cloud Intrusion Detection (Al-Mansoor 2024)",
    sourceExcerpt:
      "The architecture couples a 1D-CNN (kernel size 3, 64 filters) for spatial header extraction with a bidirectional LSTM layer (128 units) to capture inter-flow temporal dependencies.",
    sourcePageNumber: 4,
    category: "quoted_with_citation",
    reviewStatus: "properly_quoted",
    similarityScore: 94.5,
    reviewerNotes:
      "Properly referenced to Al-Mansoor et al. [1] with verbatim quotation marks.",
  },
  {
    id: "sim_match_02",
    draftSpanStart: 620,
    draftSpanEnd: 740,
    draftExcerpt:
      "drops detection recall from 96.1% to 61.4% while adversarial defense mechanisms introduce an 18.4% latency penalty",
    sourcePaperId: "paper_ids_cloud_03",
    sourcePaperTitle:
      "Evaluating Computational Latency and Adversarial Robustness (Chen 2024)",
    sourceExcerpt:
      "cause the model's recall to degrade precipitously from 96.1% to 61.4% while adversarial retraining increases inference latency by 18.4%",
    sourcePageNumber: 6,
    category: "near_match",
    reviewStatus: "citation_attached",
    similarityScore: 88.0,
    reviewerNotes: "Numerical findings attributed to Chen et al. [3].",
  },
];

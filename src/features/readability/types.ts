// ---------------------------------------------------------------------------
// READABILITY ANALYZER DOMAIN TYPES
// ---------------------------------------------------------------------------

export type ReadabilityScoreBand =
  | "very_easy"       // 90-100 (5th grade)
  | "easy"            // 80-89  (6th grade)
  | "fairly_easy"     // 70-79  (7th grade)
  | "standard"        // 60-69  (8th-9th grade)
  | "fairly_difficult"// 50-59  (10th-12th grade)
  | "difficult"       // 30-49  (College level - Standard Academic)
  | "very_difficult"; // 0-29   (Graduate level / Dense Technical)

export interface SentenceAnalysis {
  index: number;
  text: string;
  wordCount: number;
  syllableCount: number;
  isPassive: boolean;
  passiveConstruction?: string;
  isOverlyLong: boolean;          // > 35 words
  complexWords: string[];        // 3+ syllables
  claritySuggestion?: string;
}

export interface ParagraphAnalysis {
  index: number;
  text: string;
  sentenceCount: number;
  wordCount: number;
  avgSentenceLength: number;
  fleschEase: number;
  gunningFog: number;
  complexityBand: ReadabilityScoreBand;
}

export interface RepeatedPhrase {
  phrase: string;
  count: number;
  length: number;
}

export interface VocabularyComplexity {
  totalWords: number;
  uniqueWords: number;
  lexicalDiversity: number;       // Type-Token Ratio (0 - 100%)
  complexWordsCount: number;     // Words with 3+ syllables
  complexWordPercentage: number;  // (complex / total) * 100
  avgSyllablesPerWord: number;
  passiveSentencesCount: number;
  passiveVoiceRatio: number;      // (passive / total sentences) * 100
  frequentPhrases: RepeatedPhrase[];
}

export interface LanguageDetection {
  detectedCode: string;           // "en", "es", "de", "fr", "unknown"
  languageName: string;
  isEnglish: boolean;
  confidence: number;
  limitationNotice?: string;
}

export interface ReadabilityMetrics {
  fleschReadingEase: number;      // 0 - 100
  fleschKincaidGrade: number;     // e.g. 12.4
  gunningFogIndex: number;        // e.g. 14.2
  colemanLiauIndex: number;       // e.g. 13.1
  smogIndex: number;              // e.g. 15.0
  automatedReadabilityIndex: number; // ARI
  scoreBand: ReadabilityScoreBand;
  academicSuitabilityLabel: string;
}

export interface ReadabilityReport {
  id: string;
  analyzedAt: string;
  title: string;
  rawText: string;
  language: LanguageDetection;
  metrics: ReadabilityMetrics;
  vocabulary: VocabularyComplexity;
  totalSentences: number;
  totalParagraphs: number;
  avgSentenceLength: number;
  longSentencesCount: number;
  sentences: SentenceAnalysis[];
  paragraphs: ParagraphAnalysis[];
  actionableClarityRecommendations: string[];
}


import {
  ReadabilityReport,
  ReadabilityMetrics,
  VocabularyComplexity,
  LanguageDetection,
  SentenceAnalysis,
  ParagraphAnalysis,
  ReadabilityScoreBand,
  RepeatedPhrase,
} from "./types";

// ---------------------------------------------------------------------------
// SYLLABLE COUNTING HEURISTICS (ENGLISH PHONOLOGICAL APPROXIMATION)
// ---------------------------------------------------------------------------

export function countWordSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return 0;
  if (clean.length <= 3) return 1;

  // Remove common non-pronounced endings
  const text = clean
    .replace(/(?:[^laeiouy]|ed|es|e)$/, "")
    .replace(/^y/, "");

  // Match vowel sequences
  const vowelMatches = text.match(/[aeiouy]{1,2}/g);
  let syllables = vowelMatches ? vowelMatches.length : 1;

  // Handle -le at end preceded by consonant (e.g. table, bottle)
  if (/[^aeiou]le$/.test(clean)) {
    syllables++;
  }

  return Math.max(1, syllables);
}

// ---------------------------------------------------------------------------
// LANGUAGE DETECTION & CAVEAT GENERATOR
// ---------------------------------------------------------------------------

const ENGLISH_STOPWORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with",
  "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her",
  "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", "so", "up",
  "out", "if", "about", "who", "get", "which", "go", "me", "when", "make", "can", "like", "time",
  "no", "just", "him", "know", "take", "people", "into", "year", "your", "good", "some", "could",
  "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think",
  "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
  "new", "want", "because", "any", "these", "give", "day", "most", "us", "is", "are", "was", "were"
]);

const SPANISH_STOPWORDS = new Set(["el", "la", "de", "que", "en", "los", "del", "las", "por", "un", "para", "con", "no", "una", "su", "al", "lo"]);
const GERMAN_STOPWORDS = new Set(["der", "die", "und", "in", "den", "von", "zu", "das", "mit", "sich", "des", "auf", "für", "ist", "im", "dem"]);
const FRENCH_STOPWORDS = new Set(["le", "la", "de", "des", "et", "un", "une", "les", "du", "en", "pour", "dans", "par", "qui", "est"]);

export function detectTextLanguage(text: string): LanguageDetection {
  const words = text.toLowerCase().match(/\b[a-záéíóúüñäößàâçèêëîïôûù]+\b/g) || [];
  if (words.length < 5) {
    return {
      detectedCode: "en",
      languageName: "English (Default)",
      isEnglish: true,
      confidence: 0.6,
    };
  }

  let enCount = 0;
  let esCount = 0;
  let deCount = 0;
  let frCount = 0;

  for (const w of words) {
    if (ENGLISH_STOPWORDS.has(w)) enCount++;
    if (SPANISH_STOPWORDS.has(w)) esCount++;
    if (GERMAN_STOPWORDS.has(w)) deCount++;
    if (FRENCH_STOPWORDS.has(w)) frCount++;
  }

  const total = enCount + esCount + deCount + frCount || 1;

  if (esCount > enCount && esCount > deCount && esCount > frCount) {
    return {
      detectedCode: "es",
      languageName: "Spanish",
      isEnglish: false,
      confidence: Math.round((esCount / total) * 100) / 100,
      limitationNotice:
        "Limitation Note: English readability formulas (Flesch, Gunning Fog) are not calibrated for Spanish morphology. Consider the Fernández-Huerta or Gutiérrez de Polini formulas for Spanish prose.",
    };
  }

  if (deCount > enCount && deCount > esCount && deCount > frCount) {
    return {
      detectedCode: "de",
      languageName: "German",
      isEnglish: false,
      confidence: Math.round((deCount / total) * 100) / 100,
      limitationNotice:
        "Limitation Note: German features compounding and longer average syllable counts; English readability metrics produce artificially depressed scores on German text.",
    };
  }

  if (frCount > enCount && frCount > esCount && frCount > deCount) {
    return {
      detectedCode: "fr",
      languageName: "French",
      isEnglish: false,
      confidence: Math.round((frCount / total) * 100) / 100,
      limitationNotice:
        "Limitation Note: French clause structure differs from English; English readability grade levels are uncalibrated for French literature.",
    };
  }

  return {
    detectedCode: "en",
    languageName: "English",
    isEnglish: true,
    confidence: Math.min(1.0, Math.round((enCount / Math.max(1, words.length * 0.4)) * 100) / 100),
  };
}

// ---------------------------------------------------------------------------
// PASSIVE VOICE & CLARITY DETECTORS
// ---------------------------------------------------------------------------

const PASSIVE_REGEX = /\b(am|is|are|was|were|been|being|be)\s+(\w+ed|shown|given|seen|written|taken|made|found|done|chosen|known|held|observed|evaluated|calculated|measured|conducted|established|demonstrated)\b(?:\s+by\b)?/i;

const NOMINALIZATION_REPLACEMENTS: [RegExp, string][] = [
  [/\bconduct an investigation of\b/gi, "investigate"],
  [/\bconduct an analysis of\b/gi, "analyze"],
  [/\bmake a determination\b/gi, "determine"],
  [/\bperform an evaluation of\b/gi, "evaluate"],
  [/\bis in agreement with\b/gi, "agrees with"],
  [/\bhas a requirement for\b/gi, "requires"],
  [/\bprovide an explanation for\b/gi, "explain"],
  [/\bis applicable to\b/gi, "applies to"],
  [/\bin the event that\b/gi, "if"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\bfor the purpose of\b/gi, "to"],
  [/\ba majority of\b/gi, "most"],
  [/\bat the present time\b/gi, "currently"],
];

export function detectPassiveVoice(sentence: string): { isPassive: boolean; match?: string } {
  const m = PASSIVE_REGEX.exec(sentence);
  return {
    isPassive: Boolean(m),
    match: m ? m[0] : undefined,
  };
}

// ---------------------------------------------------------------------------
// REPEATED PHRASES EXTRACTOR
// ---------------------------------------------------------------------------

export function findRepeatedPhrases(text: string, minLength = 3, maxWords = 4): RepeatedPhrase[] {
  const words = text.toLowerCase().match(/\b[a-z0-9'-]+\b/g) || [];
  const phraseCounts = new Map<string, number>();

  for (let n = 2; n <= maxWords; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join(" ");
      // Exclude phrases of purely trivial stopwords
      const phraseWords = phrase.split(" ");
      if (phraseWords.every((w) => ENGLISH_STOPWORDS.has(w))) continue;

      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    }
  }

  const results: RepeatedPhrase[] = [];
  phraseCounts.forEach((count, phrase) => {
    if (count >= minLength) {
      results.push({
        phrase,
        count,
        length: phrase.split(" ").length,
      });
    }
  });

  return results.sort((a, b) => b.count - a.count).slice(0, 8);
}

// ---------------------------------------------------------------------------
// READABILITY SCORE BAND COMPUTATION
// ---------------------------------------------------------------------------

export function getReadabilityBand(fleschEase: number): ReadabilityScoreBand {
  if (fleschEase >= 90) return "very_easy";
  if (fleschEase >= 80) return "easy";
  if (fleschEase >= 70) return "fairly_easy";
  if (fleschEase >= 60) return "standard";
  if (fleschEase >= 50) return "fairly_difficult";
  if (fleschEase >= 30) return "difficult";
  return "very_difficult";
}

export function getAcademicSuitability(fleschEase: number): string {
  if (fleschEase >= 60) return "Casual / Introductory (Simpler than standard peer-reviewed prose)";
  if (fleschEase >= 30) return "Target Peer-Review Band (Standard academic and scientific discourse)";
  return "Dense Technical (High cognitive load; may benefit from clause shortening)";
}

// ---------------------------------------------------------------------------
// FULL READABILITY ANALYZER WORKFLOW
// ---------------------------------------------------------------------------

export function analyzeReadability(text: string, title = "Manuscript"): ReadabilityReport {
  const trimmed = text.trim();
  const language = detectTextLanguage(trimmed);

  // Split Paragraphs
  const rawParagraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const paragraphAnalyses: ParagraphAnalysis[] = [];

  // Split Sentences with academic abbreviation protections
  const sentencesText = trimmed
    .replace(/(?:et\s+al\.|i\.e\.|e\.g\.|Fig\.|Dr\.|Prof\.|vs\.)/gi, (m) => m.replace(/\./g, "§"))
    .split(/(?<=[.!?])\s+(?=[A-Z0-9[(])/);

  const sentenceAnalyses: SentenceAnalysis[] = [];
  let totalWordsCount = 0;
  let totalSyllablesCount = 0;
  let totalComplexWordsCount = 0;
  let passiveSentencesCount = 0;
  let longSentencesCount = 0;
  const wordFrequencyMap = new Map<string, number>();

  sentencesText.forEach((rawSentence, idx) => {
    const unescaped = rawSentence.replace(/§/g, ".").trim();
    if (!unescaped) return;

    const words = unescaped.match(/\b[A-Za-z0-9'-]+\b/g) || [];
    const wordCount = words.length;
    totalWordsCount += wordCount;

    let sentSyllables = 0;
    const complexWordsInSent: string[] = [];

    words.forEach((w) => {
      const lower = w.toLowerCase();
      wordFrequencyMap.set(lower, (wordFrequencyMap.get(lower) || 0) + 1);

      const syl = countWordSyllables(w);
      sentSyllables += syl;
      totalSyllablesCount += syl;

      if (syl >= 3 && !/^\d+$/.test(w)) {
        complexWordsInSent.push(w);
        totalComplexWordsCount++;
      }
    });

    const isLong = wordCount > 35;
    if (isLong) longSentencesCount++;

    const passiveCheck = detectPassiveVoice(unescaped);
    if (passiveCheck.isPassive) passiveSentencesCount++;

    // Clarity suggestions
    let suggestion: string | undefined;
    for (const [pattern, replacement] of NOMINALIZATION_REPLACEMENTS) {
      if (pattern.test(unescaped)) {
        suggestion = `Consider replacing wordy phrasing with "${replacement}" for tighter concision.`;
        break;
      }
    }
    if (!suggestion && isLong) {
      suggestion = `Sentence has ${wordCount} words. Consider splitting into two focused declarative clauses.`;
    }

    sentenceAnalyses.push({
      index: idx + 1,
      text: unescaped,
      wordCount,
      syllableCount: sentSyllables,
      isPassive: passiveCheck.isPassive,
      passiveConstruction: passiveCheck.match,
      isOverlyLong: isLong,
      complexWords: complexWordsInSent,
      claritySuggestion: suggestion,
    });
  });

  // Paragraph Analyses
  rawParagraphs.forEach((paraText, pIdx) => {
    const pWords = paraText.match(/\b[A-Za-z0-9'-]+\b/g) || [];
    const pSentences = paraText.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    const pWordCount = Math.max(1, pWords.length);
    const pSentCount = Math.max(1, pSentences.length);

    let pSyllables = 0;
    let pComplex = 0;
    pWords.forEach((w) => {
      const s = countWordSyllables(w);
      pSyllables += s;
      if (s >= 3) pComplex++;
    });

    // Flesch Reading Ease for paragraph
    const pEase = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (206.835 - 1.015 * (pWordCount / pSentCount) - 84.6 * (pSyllables / pWordCount)) * 10
        ) / 10
      )
    );

    // Gunning Fog for paragraph
    const pFog = Math.round((0.4 * (pWordCount / pSentCount + 100 * (pComplex / pWordCount))) * 10) / 10;

    paragraphAnalyses.push({
      index: pIdx + 1,
      text: paraText.trim(),
      sentenceCount: pSentCount,
      wordCount: pWordCount,
      avgSentenceLength: Math.round((pWordCount / pSentCount) * 10) / 10,
      fleschEase: pEase,
      gunningFog: pFog,
      complexityBand: getReadabilityBand(pEase),
    });
  });

  const totalSentences = Math.max(1, sentenceAnalyses.length);
  const totalWords = Math.max(1, totalWordsCount);
  const avgSentLen = Math.round((totalWords / totalSentences) * 10) / 10;
  const avgSyllablesPerWord = Math.round((totalSyllablesCount / totalWords) * 100) / 100;
  const complexWordPct = Math.round((totalComplexWordsCount / totalWords) * 1000) / 10;
  const passiveVoiceRatio = Math.round((passiveSentencesCount / totalSentences) * 1000) / 10;

  // ---------------------------------------------------------------------------
  // CLASSICAL READABILITY METRICS COMPUTATION
  // ---------------------------------------------------------------------------

  // 1. Flesch Reading Ease
  const fleschReadingEase = Math.max(
    0,
    Math.min(
      100,
      Math.round((206.835 - 1.015 * (totalWords / totalSentences) - 84.6 * avgSyllablesPerWord) * 10) / 10
    )
  );

  // 2. Flesch-Kincaid Grade Level
  const fleschKincaidGrade = Math.max(
    1,
    Math.round((0.39 * (totalWords / totalSentences) + 11.8 * avgSyllablesPerWord - 15.59) * 10) / 10
  );

  // 3. Gunning Fog Index
  const gunningFogIndex = Math.max(
    1,
    Math.round((0.4 * (totalWords / totalSentences + complexWordPct)) * 10) / 10
  );

  // 4. Coleman-Liau Index (L = letters/100 words, S = sentences/100 words)
  const lettersCount = trimmed.replace(/[^A-Za-z0-9]/g, "").length;
  const L = (lettersCount / totalWords) * 100;
  const S = (totalSentences / totalWords) * 100;
  const colemanLiauIndex = Math.max(1, Math.round((0.0588 * L - 0.296 * S - 15.8) * 10) / 10);

  // 5. SMOG Index (Simple Measure of Gobbledygook)
  const smogIndex = Math.max(
    1,
    Math.round((1.043 * Math.sqrt(totalComplexWordsCount * (30 / totalSentences)) + 3.1291) * 10) / 10
  );

  // 6. Automated Readability Index (ARI)
  const automatedReadabilityIndex = Math.max(
    1,
    Math.round((4.71 * (lettersCount / totalWords) + 0.5 * (totalWords / totalSentences) - 21.43) * 10) / 10
  );

  const scoreBand = getReadabilityBand(fleschReadingEase);
  const academicSuitabilityLabel = getAcademicSuitability(fleschReadingEase);

  // Repeated phrases
  const frequentPhrases = findRepeatedPhrases(trimmed);

  // Actionable recommendations list
  const recommendations: string[] = [];
  if (longSentencesCount > 0) {
    recommendations.push(
      `${longSentencesCount} sentence(s) exceed 35 words. Breaking them into shorter statements will elevate clarity.`
    );
  }
  if (passiveVoiceRatio > 35) {
    recommendations.push(
      `Passive voice appears in ${passiveVoiceRatio}% of sentences. While common in academic methodologies, balancing with active voice energizes discussion sections.`
    );
  }
  if (complexWordPct > 30) {
    recommendations.push(
      `${complexWordPct}% of vocabulary consists of 3+ syllable words. Verify that technical terminology is necessary and not nominalized jargon.`
    );
  }
  if (fleschReadingEase < 30) {
    recommendations.push(
      "Readability score is below 30 (Dense Technical). Consider breaking complex compound sentences into focused analytical points."
    );
  }
  const claritySuggestions = sentenceAnalyses
    .filter((s) => s.claritySuggestion)
    .map((s) => s.claritySuggestion!);
  if (claritySuggestions.length > 0) {
    recommendations.push(...claritySuggestions.slice(0, 5));
  }
  if (recommendations.length === 0) {
    recommendations.push("Document demonstrates well-calibrated academic prose cadence within standard peer-review bands.");
  }

  const vocabulary: VocabularyComplexity = {
    totalWords,
    uniqueWords: wordFrequencyMap.size,
    lexicalDiversity: Math.round((wordFrequencyMap.size / totalWords) * 1000) / 10,
    complexWordsCount: totalComplexWordsCount,
    complexWordPercentage: complexWordPct,
    avgSyllablesPerWord,
    passiveSentencesCount,
    passiveVoiceRatio,
    frequentPhrases,
  };

  const metrics: ReadabilityMetrics = {
    fleschReadingEase,
    fleschKincaidGrade,
    gunningFogIndex,
    colemanLiauIndex,
    smogIndex,
    automatedReadabilityIndex,
    scoreBand,
    academicSuitabilityLabel,
  };

  return {
    id: `readability_${Date.now()}`,
    analyzedAt: new Date().toISOString(),
    title,
    rawText: trimmed,
    language,
    metrics,
    vocabulary,
    totalSentences,
    totalParagraphs: paragraphAnalyses.length,
    avgSentenceLength: avgSentLen,
    longSentencesCount,
    sentences: sentenceAnalyses,
    paragraphs: paragraphAnalyses,
    actionableClarityRecommendations: recommendations,
  };
}

export const READABILITY_DEMO_SAMPLE = `In recent years, the rapid advancement of artificial intelligence and deep neural networks has revolutionized various domains including computer vision, natural language processing, and automated decision-making. It is important to note that deep learning models require substantial computational resources and large-scale training datasets. Furthermore, the integration of attention mechanisms has further augmented model efficacy across diverse benchmarks.

Empirical evaluations conducted across multi-source bibliographic repositories corroborate our theoretical presuppositions concerning indexing latency and query discriminability. Specifically, when algorithmic normalizers standardize author authority strings prior to tokenization, retrieval recall improves measurably without deteriorating disambiguation thresholds.

A comprehensive examination was conducted by our team to analyze the complex multi-clause dependencies in large corpora. The results were found to be statistically significant, although the computational latency was observed to be influenced by memory constraints. Future investigations will be conducted to address cross-domain generalization.`;

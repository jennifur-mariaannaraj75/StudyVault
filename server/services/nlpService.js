const nlp = require("compromise");
const natural = require("natural");

/**
 * StudyVault NLP Service
 * 
 * Provides linguistic preprocessing, entity recognition, keyword/keyphrase extraction,
 * academic concept detection, query intent classification, and semantic query expansion.
 * 
 * Modular design: Functions gracefully fall back to deterministic regex / linguistic rules
 * if any unexpected inputs or library exceptions occur.
 */

// Common academic domain stop words to filter out noise
const ACADEMIC_STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
  "by", "can", "did", "do", "does", "doing", "don", "down", "during", "each", "few", "for",
  "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "if", "in", "into", "is", "it", "its", "itself", "just",
  "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once",
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "s", "same", "she",
  "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
  "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until",
  "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom",
  "why", "will", "with", "you", "your", "yours", "yourself", "yourselves",
  // Common document & meta words
  "figure", "fig", "table", "page", "section", "chapter", "etc", "also", "given", "thus",
  "therefore", "show", "shown", "shows", "following", "using", "used", "defined", "given"
]);

// Domain taxonomy mappings for recognized computer science & university engineering subjects
const DOMAIN_TAXONOMY = [
  {
    topic: "Operating Systems",
    triggers: ["process", "thread", "cpu scheduling", "deadlock", "paging", "segmentation", "virtual memory", "semaphore", "mutex", "critical section", "interprocess", "pcb", "banker's algorithm", "context switch", "file system", "kernel"],
  },
  {
    topic: "Computer Networks",
    triggers: ["tcp", "udp", "ip address", "osi model", "packet", "routing", "subnet", "dns", "http", "socket", "lan", "wan", "bandwidth", "latency", "congestion control", "transport layer"],
  },
  {
    topic: "Database Management",
    triggers: ["sql", "rdbms", "normalization", "b-tree", "transaction", "acid", "relational", "primary key", "foreign key", "indexing", "query optimization", "nosql", "concurrency control"],
  },
  {
    topic: "Data Structures & Algorithms",
    triggers: ["binary tree", "graph", "linked list", "sorting", "searching", "dynamic programming", "time complexity", "big o", "stack", "queue", "heap", "recursion", "dijkstra"],
  },
  {
    topic: "Computer Architecture",
    triggers: ["cache", "pipelining", "registers", "instruction set", "alu", "memory hierarchy", "risc", "cisc", "clock cycle", "bus", "microprocessor"],
  },
  {
    topic: "Software Engineering",
    triggers: ["agile", "scrum", "waterfall", "uml", "design pattern", "testing", "ci/cd", "refactoring", "requirements", "software architecture"],
  },
  {
    topic: "Artificial Intelligence & ML",
    triggers: ["neural network", "machine learning", "supervised", "unsupervised", "deep learning", "gradient descent", "regression", "classification", "loss function", "nlp"],
  },
];

/**
 * 1. Text Cleaning: Strips excessive whitespace, non-printable characters, and fixes OCR hyphenation splits.
 */
function cleanText(text) {
  if (!text || typeof text !== "string") return "";

  return text
    // Fix hyphenated words broken across line breaks (e.g. "schedul-\ning" -> "scheduling")
    .replace(/([a-zA-Z]{2,})-\r?\n([a-zA-Z]{2,})/g, "$1$2")
    // Replace multiple carriage returns and line feeds with standard double newline
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // Replace non-breaking spaces and irregular tabs
    .replace(/[\t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    // Collapse multiple horizontal spaces
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

/**
 * 2. Sentence Segmentation: Splits academic text cleanly into sentences using compromise.
 */
function segmentSentences(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  try {
    const doc = nlp(cleaned.slice(0, 100000));
    const sentences = doc.sentences().out("array");
    if (Array.isArray(sentences) && sentences.length > 0) {
      return sentences.map((s) => s.trim()).filter((s) => s.length > 3);
    }
  } catch (err) {
    // Fallback regex if compromise encounters malformed symbols
  }

  return cleaned
    .split(/(?<=[.?!])\s+(?=[A-Z0-9])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

/**
 * 3. Tokenization & Stemming
 */
function tokenize(text, { filterStop = true, stem = false } = {}) {
  if (!text || typeof text !== "string") return [];
  const words = (text.toLowerCase().match(/[a-z0-9]+(?:[-'][a-z0-9]+)*/g) || [])
    .filter((w) => w.length >= 2);

  let tokens = words;
  if (filterStop) {
    tokens = tokens.filter((w) => !ACADEMIC_STOP_WORDS.has(w));
  }

  if (stem) {
    return tokens.map((w) => natural.PorterStemmer.stem(w));
  }

  return tokens;
}

/**
 * 4. Keyword Extraction: TF-IDF statistical weighting + frequency analysis
 */
function extractKeywords(text, { maxCount = 15 } = {}) {
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  try {
    const tfidf = new natural.TfIdf();
    const sentences = segmentSentences(cleaned);
    
    // Add full text and individual sections to TfIdf corpus
    tfidf.addDocument(cleaned);
    if (sentences.length > 1) {
      const stride = Math.max(1, Math.floor(sentences.length / 5));
      for (let i = 0; i < sentences.length; i += stride) {
        tfidf.addDocument(sentences.slice(i, i + stride).join(" "));
      }
    }

    const keywordScores = new Map();
    tfidf.listTerms(0).forEach((item) => {
      const term = item.term.toLowerCase();
      if (term.length >= 3 && !ACADEMIC_STOP_WORDS.has(term) && !/^\d+$/.test(term)) {
        keywordScores.set(term, (keywordScores.get(term) || 0) + item.tfidf);
      }
    });

    // Also boost frequency of technical nouns from compromise
    try {
      const doc = nlp(cleaned.slice(0, 40000));
      const nouns = doc.nouns().out("array");
      nouns.forEach((noun) => {
        const words = tokenize(noun);
        words.forEach((w) => {
          if (keywordScores.has(w)) {
            keywordScores.set(w, keywordScores.get(w) * 1.3);
          } else if (w.length >= 3 && !ACADEMIC_STOP_WORDS.has(w)) {
            keywordScores.set(w, 1.0);
          }
        });
      });
    } catch (_) {}

    return Array.from(keywordScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxCount)
      .map(([word, score]) => ({
        keyword: word,
        score: Number(score.toFixed(3)),
      }));
  } catch (err) {
    // Graceful fallback
    const tokens = tokenize(cleaned);
    const freq = {};
    tokens.forEach((t) => { freq[t] = (freq[t] || 0) + 1; });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxCount)
      .map(([word, count]) => ({ keyword: word, score: count }));
  }
}

/**
 * 5. Keyphrase Extraction: Multi-word technical concepts, noun compounds, and n-grams
 */
function extractKeyphrases(text, { maxCount = 10 } = {}) {
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  const phraseScores = new Map();

  try {
    const doc = nlp(cleaned.slice(0, 50000));

    // Noun phrases matching pattern: [Adjective?] [Noun+]
    const nounPhrases = doc.match("(#Adjective|#Noun)+ #Noun+").out("array");
    nounPhrases.forEach((phrase) => {
      const cleanP = phrase.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim();
      const words = cleanP.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) {
        if (!words.every((w) => ACADEMIC_STOP_WORDS.has(w))) {
          phraseScores.set(cleanP, (phraseScores.get(cleanP) || 0) + 2.5);
        }
      }
    });

    // Extract acronyms and definition subjects (e.g. "FIFO algorithm", "CPU scheduling")
    const clauses = doc.clauses().out("array");
    clauses.forEach((clause) => {
      const matchDef = clause.match(/^([A-Za-z0-9\s-]{3,35})\s+(?:is|are|means|refers to|can be defined as)/i);
      if (matchDef && matchDef[1]) {
        const candidate = matchDef[1].toLowerCase().trim();
        if (candidate.split(" ").length <= 4) {
          phraseScores.set(candidate, (phraseScores.get(candidate) || 0) + 4.0);
        }
      }
    });
  } catch (_) {}

  // Natural Bigrams & Trigrams fallback / augmentation
  try {
    const words = tokenize(cleaned, { filterStop: false });
    const bigrams = natural.NGrams.bigrams(words);
    bigrams.forEach(([w1, w2]) => {
      if (w1.length > 2 && w2.length > 2 && !ACADEMIC_STOP_WORDS.has(w1) && !ACADEMIC_STOP_WORDS.has(w2)) {
        const p = `${w1} ${w2}`;
        phraseScores.set(p, (phraseScores.get(p) || 0) + 1.2);
      }
    });
  } catch (_) {}

  return Array.from(phraseScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([phrase, score]) => ({
      keyphrase: phrase,
      score: Number(score.toFixed(2)),
    }));
}

/**
 * 6. Named Entity Recognition: Acronyms, People, Organizations, and Technical Standards
 */
function extractEntities(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return { people: [], organizations: [], places: [], acronyms: [] };

  const entities = {
    people: new Set(),
    organizations: new Set(),
    places: new Set(),
    acronyms: new Set(),
  };

  try {
    const doc = nlp(cleaned.slice(0, 50000));

    // Acronyms (e.g. CPU, RAM, PCB, FIFO, LRU, TLB, OS, API, HTTP, SQL)
    const foundAcronyms = doc.acronyms().out("array");
    foundAcronyms.forEach((a) => {
      const cleanA = a.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (cleanA.length >= 2 && cleanA.length <= 8) {
        entities.acronyms.add(cleanA);
      }
    });

    // Capitalized 2-4 letter tokens in raw text for academic abbreviations
    const rawTokens = cleaned.match(/\b[A-Z]{2,6}\b/g) || [];
    rawTokens.slice(0, 30).forEach((t) => {
      if (!["THE", "FOR", "AND", "NOT", "ALL", "NEW", "ANY"].includes(t)) {
        entities.acronyms.add(t);
      }
    });

    // People (e.g. Dijkstra, Turing, Tanenbaum)
    const people = doc.people().out("array");
    people.slice(0, 15).forEach((p) => {
      const cleanP = p.trim();
      if (cleanP.length > 2 && !ACADEMIC_STOP_WORDS.has(cleanP.toLowerCase())) {
        entities.people.add(cleanP);
      }
    });

    // Organizations (e.g. IEEE, ACM, ISO, ANSI, Google, Intel)
    const orgs = doc.organizations().out("array");
    orgs.slice(0, 15).forEach((o) => {
      const cleanO = o.trim();
      if (cleanO.length > 2) entities.organizations.add(cleanO);
    });

    // Places
    const places = doc.places().out("array");
    places.slice(0, 10).forEach((pl) => {
      if (pl.length > 2) entities.places.add(pl.trim());
    });
  } catch (err) {
    console.warn("[nlpService] Entity extraction warning:", err.message);
  }

  return {
    people: Array.from(entities.people),
    organizations: Array.from(entities.organizations),
    places: Array.from(entities.places),
    acronyms: Array.from(entities.acronyms),
  };
}

/**
 * 7. Topic & Domain Identification: Maps text to subject domains and detects specific themes
 */
function detectTopics(text) {
  const cleaned = cleanText(text).toLowerCase();
  if (!cleaned) return [];

  const matchedDomains = [];

  // Match against academic domain taxonomy
  DOMAIN_TAXONOMY.forEach(({ topic, triggers }) => {
    let hits = 0;
    triggers.forEach((trigger) => {
      if (cleaned.includes(trigger.toLowerCase())) {
        hits++;
      }
    });
    if (hits >= 2) {
      matchedDomains.push({ topic, confidence: Math.min(1.0, hits * 0.2) });
    }
  });

  // Extract document-specific concept headings / key themes
  const specificTopics = new Set();
  const headings = cleaned.match(/^(?:#+\s*|\d+\.\s+)([a-zA-Z\s]{4,40})$/gm) || [];
  headings.slice(0, 8).forEach((h) => {
    const t = h.replace(/^[#0-9.\s]+/, "").trim();
    if (t.length > 3 && !ACADEMIC_STOP_WORDS.has(t)) {
      specificTopics.add(t.charAt(0).toUpperCase() + t.slice(1));
    }
  });

  // Add top keyphrases as topics if no headings
  if (specificTopics.size === 0) {
    const keyphrases = extractKeyphrases(text, { maxCount: 4 });
    keyphrases.forEach((kp) => {
      const titleCased = kp.keyphrase
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      specificTopics.add(titleCased);
    });
  }

  const result = [];
  matchedDomains.sort((a, b) => b.confidence - a.confidence).forEach((d) => result.push(d.topic));
  specificTopics.forEach((t) => {
    if (!result.includes(t)) result.push(t);
  });

  return result.slice(0, 6);
}

/**
 * 8. Exam-Oriented Academic Concept Extraction:
 * Extracts definitions, comparisons, procedures/algorithms, advantages, disadvantages, and formulas.
 */
function extractAcademicConcepts(text) {
  const sentences = segmentSentences(text);
  const concepts = {
    definitions: [],
    comparisons: [],
    algorithms: [],
    advantages: [],
    disadvantages: [],
    formulas: [],
  };

  const seen = new Set();

  sentences.forEach((sentence) => {
    const sLower = sentence.toLowerCase().trim();
    if (seen.has(sLower)) return;

    // A. Definitions
    if (
      /(?:is\s+defined\s+as|refers\s+to|can\s+be\s+defined\s+as|is\s+the\s+process\s+of|is\s+a\s+technique\s+that|is\s+known\s+as)\b/i.test(sentence) ||
      /^[A-Z][a-zA-Z0-9\s-]{2,30}\s+(?:is|are)\s+(?:a|an|the)\s+/i.test(sentence)
    ) {
      if (sentence.length >= 25 && sentence.length <= 300) {
        concepts.definitions.push(sentence.trim());
        seen.add(sLower);
        return;
      }
    }

    // B. Comparisons / Differences
    if (
      /(?:difference\s+between|differs\s+from|compared\s+to|in\s+contrast\s+to|whereas|versus|\bvs\b|unlike|while\s+[a-z]+\s+is)/i.test(sentence)
    ) {
      if (sentence.length >= 25 && sentence.length <= 350) {
        concepts.comparisons.push(sentence.trim());
        seen.add(sLower);
        return;
      }
    }

    // C. Algorithms, Steps & Procedures
    if (
      /(?:algorithm|step\s+\d+|steps\s+to|procedure|pseudocode|following\s+steps|working\s+of|flowchart)/i.test(sentence)
    ) {
      if (sentence.length >= 20 && sentence.length <= 300) {
        concepts.algorithms.push(sentence.trim());
        seen.add(sLower);
        return;
      }
    }

    // D. Advantages & Disadvantages
    if (/(?:advantage|benefit|merit|positive\s+aspect|pro\b)/i.test(sentence)) {
      if (sentence.length >= 20 && sentence.length <= 250) {
        concepts.advantages.push(sentence.trim());
        seen.add(sLower);
        return;
      }
    }
    if (/(?:disadvantage|drawback|limitation|overhead|demerit|con\b)/i.test(sentence)) {
      if (sentence.length >= 20 && sentence.length <= 250) {
        concepts.disadvantages.push(sentence.trim());
        seen.add(sLower);
        return;
      }
    }

    // E. Formulas, Equations & Conditions
    if (
      /(?:formula|equation|equal\s+to|calculated\s+as|given\s+by|\b[A-Z]{2,}\s*=\s*|\bconditions?\s+for)/i.test(sentence) ||
      /[=><\+\*\/]\s*[a-zA-Z0-9_]{2,}\s*[=><\+\*\/]/.test(sentence)
    ) {
      if (sentence.length >= 15 && sentence.length <= 250) {
        concepts.formulas.push(sentence.trim());
        seen.add(sLower);
      }
    }
  });

  return {
    definitions: concepts.definitions.slice(0, 10),
    comparisons: concepts.comparisons.slice(0, 10),
    algorithms: concepts.algorithms.slice(0, 10),
    advantages: concepts.advantages.slice(0, 8),
    disadvantages: concepts.disadvantages.slice(0, 8),
    formulas: concepts.formulas.slice(0, 8),
  };
}

/**
 * 9. Query Intent Classification:
 * Categorizes student question intent into educational archetypes.
 */
function classifyQuery(query) {
  if (!query || typeof query !== "string") return "explanation";
  const q = query.toLowerCase().trim();

  // Definition intent
  if (
    /^(?:define|what\s+is|what\s+are|what\s+do\s+you\s+mean\s+by|meaning\s+of|concept\s+of|definition\s+of)\b/.test(q) ||
    /\b(?:in\s+one\s+sentence|define\s+it)\b/.test(q)
  ) {
    return "definition";
  }

  // Comparison intent
  if (
    /\b(?:difference\s+between|compare|contrast|versus|\bvs\b|distinguish\s+between|differentiate)\b/.test(q)
  ) {
    return "comparison";
  }

  // Procedure / Algorithmic intent
  if (
    /^(?:how\s+does|how\s+to|steps\s+for|explain\s+how|algorithm\s+for|working\s+of|procedure\s+of|flowchart\s+of)\b/.test(q) ||
    /\b(?:step-by-step|mechanism|how\s+it\s+works)\b/.test(q)
  ) {
    return "procedure";
  }

  // Exam question intent
  if (
    /\b(?:2\s*mark|5\s*mark|10\s*mark|exam\s+questions?|important\s+questions?|university\s+questions?|test\s+questions?)\b/.test(q)
  ) {
    return "exam_question";
  }

  // Advantages / Disadvantages intent
  if (
    /\b(?:advantages?|disadvantages?|pros\s+and\s+cons|benefits|limitations?|drawbacks?|merits?|demerits?)\b/.test(q)
  ) {
    return "advantages_disadvantages";
  }

  // Cause & Effect intent
  if (
    /^(?:why\s+does|why\s+is|what\s+causes|cause\s+of|effect\s+of|reasons?\s+for|impact\s+of)\b/.test(q) ||
    /\b(?:leads\s+to|consequence\s+of|result\s+of)\b/.test(q)
  ) {
    return "cause_effect";
  }

  // Summary intent
  if (
    /^(?:summarize|summary\s+of|overview\s+of|brief\s+summary|recap|give\s+a\s+brief|outline)\b/.test(q)
  ) {
    return "summary";
  }

  // Example intent
  if (
    /\b(?:example\s+of|give\s+an\s+example|illustration\s+of|case\s+study|real-world\s+example)\b/.test(q)
  ) {
    return "example";
  }

  // Short answer
  if (/\b(?:short\s+note|short\s+answer|briefly\s+explain|in\s+short)\b/.test(q)) {
    return "short_answer";
  }

  // Long answer / Essay
  if (/\b(?:detailed\s+answer|long\s+answer|in\s+detail|elaborate|comprehensive\s+explanation)\b/.test(q)) {
    return "long_answer";
  }

  // Revision / Cheat sheet
  if (/\b(?:revision|quick\s+revision|cheat\s+sheet|formula\s+sheet|key\s+takeaways)\b/.test(q)) {
    return "revision";
  }

  return "explanation";
}

/**
 * 10. Semantic Query Expansion: Expands key terms with academic synonyms and related concepts
 */
function expandQuery(query, { maxExpansions = 8 } = {}) {
  const cleanQ = cleanText(query).toLowerCase();
  const expanded = new Set();

  const domainKeywords = {
    deadlock: ["banker's algorithm", "resource allocation graph", "circular wait", "mutual exclusion", "hold and wait", "safe state", "starvation"],
    scheduling: ["cpu scheduling", "preemptive", "non-preemptive", "turnaround time", "waiting time", "round robin", "fcfs", "priority scheduling"],
    paging: ["page table", "virtual memory", "tlb", "page fault", "frame", "internal fragmentation"],
    segmentation: ["segment table", "segmentation fault", "logical address", "external fragmentation"],
    process: ["process control block", "pcb", "context switch", "process states", "interprocess communication", "ipc"],
    synchronization: ["critical section", "race condition", "semaphore", "mutex", "peterson's solution"],
    threads: ["multithreading", "user thread", "kernel thread", "concurrency"],
    memory: ["ram", "cache", "virtual address", "physical address", "swapping"],
    cache: ["cache hit", "cache miss", "direct mapped", "set associative", "l1 l2 l3"],
    tcp: ["connection-oriented", "three-way handshake", "flow control", "congestion window", "transmission control protocol"],
    udp: ["connectionless", "user datagram protocol", "datagram", "unreliable"],
    routing: ["router", "routing table", "dijkstra", "bellman-ford", "distance vector", "link state"],
    sql: ["relational", "ddl", "dml", "join", "foreign key", "primary key", "normalization"],
    transaction: ["acid properties", "atomicity", "consistency", "isolation", "durability", "two-phase locking"],
  };

  Object.entries(domainKeywords).forEach(([key, relatedList]) => {
    if (cleanQ.includes(key)) {
      relatedList.forEach((term) => expanded.add(term));
    }
  });

  return Array.from(expanded).slice(0, maxExpansions);
}

/**
 * 11. Full Query Analysis: Extracts intent, keywords, phrases, topics, and expansions for RAG
 */
function analyzeQuery(query) {
  const cleaned = cleanText(query);
  if (!cleaned) {
    return {
      originalQuery: "",
      cleanQuery: "",
      intent: "explanation",
      keywords: [],
      keyphrases: [],
      stems: [],
      topics: [],
      expandedTerms: [],
    };
  }

  const intent = classifyQuery(cleaned);
  const keywords = extractKeywords(cleaned, { maxCount: 8 }).map((k) => k.keyword);
  const keyphrases = extractKeyphrases(cleaned, { maxCount: 6 }).map((k) => k.keyphrase);
  const stems = tokenize(cleaned, { stem: true });
  const topics = detectTopics(cleaned);
  const expandedTerms = expandQuery(cleaned, { maxExpansions: 6 });

  return {
    originalQuery: query,
    cleanQuery: cleaned,
    intent,
    keywords,
    keyphrases,
    stems: Array.from(new Set(stems)),
    topics,
    expandedTerms,
  };
}

/**
 * 12. Full Document Text Analysis: Comprehensive NLP metadata extraction for uploaded documents
 */
function analyzeText(text, options = {}) {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return {
      cleanText: "",
      sentenceCount: 0,
      keywords: [],
      keyphrases: [],
      entities: { people: [], organizations: [], places: [], acronyms: [] },
      topics: [],
      academicConcepts: { definitions: [], comparisons: [], algorithms: [], advantages: [], disadvantages: [], formulas: [] },
    };
  }

  const sentences = segmentSentences(cleaned);
  const keywords = extractKeywords(cleaned, { maxCount: 20 });
  const keyphrases = extractKeyphrases(cleaned, { maxCount: 15 });
  const entities = extractEntities(cleaned);
  const topics = detectTopics(cleaned);
  const academicConcepts = extractAcademicConcepts(cleaned);

  return {
    cleanText: cleaned,
    sentenceCount: sentences.length,
    keywords: keywords.map((k) => k.keyword),
    keyphrases: keyphrases.map((k) => k.keyphrase),
    entities,
    topics,
    academicConcepts,
  };
}

/**
 * 13. Chunk-Level NLP Analysis: Fast per-chunk enrichment for RAG matching
 */
function analyzeChunk(chunkText) {
  if (!chunkText || typeof chunkText !== "string") {
    return {
      keywords: [],
      keyphrases: [],
      entities: [],
      topics: [],
      hasDefinition: false,
      hasComparison: false,
      hasAlgorithm: false,
      hasSteps: false,
    };
  }

  const textLower = chunkText.toLowerCase();
  const keywords = extractKeywords(chunkText, { maxCount: 6 }).map((k) => k.keyword);
  const keyphrases = extractKeyphrases(chunkText, { maxCount: 4 }).map((k) => k.keyphrase);
  const entitiesObj = extractEntities(chunkText);
  const allEntities = [
    ...entitiesObj.acronyms,
    ...entitiesObj.people,
    ...entitiesObj.organizations,
  ].slice(0, 6);

  const topics = detectTopics(chunkText).slice(0, 3);

  const hasDefinition = /(?:is\s+defined\s+as|refers\s+to|means|is\s+a\s+[a-z]+\s+that|definition:)/i.test(chunkText);
  const hasComparison = /(?:difference\s+between|differs\s+from|in\s+contrast|versus|\bvs\b|whereas)/i.test(chunkText);
  const hasAlgorithm = /(?:algorithm|pseudocode|procedure|banker's|dijkstra|peterson)/i.test(chunkText);
  const hasSteps = /(?:step\s+\d+|1\.\s+[A-Z]|firstly|secondly|phase\s+\d+)/i.test(chunkText);

  return {
    keywords,
    keyphrases,
    entities: allEntities,
    topics,
    hasDefinition,
    hasComparison,
    hasAlgorithm,
    hasSteps,
  };
}

module.exports = {
  cleanText,
  segmentSentences,
  tokenize,
  extractKeywords,
  extractKeyphrases,
  extractEntities,
  detectTopics,
  extractAcademicConcepts,
  classifyQuery,
  expandQuery,
  analyzeQuery,
  analyzeText,
  analyzeChunk,
};

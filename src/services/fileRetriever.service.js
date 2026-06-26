// src/services/fileRetriever.service.js
//
// ═══════════════════════════════════════════════════════════════
//  Finds the most relevant files for a given GitHub issue.
//
//  CURRENT:  keyword string matching (free, fast, good for 80% of cases)
//
//  FUTURE UPGRADE POINT (marked with ── UPGRADE ──):
//  Replace scoreFile() internals with embedding-based cosine similarity.
//  Everything else stays identical.
// ═══════════════════════════════════════════════════════════════

const githubService = require("./github.service");
const {
  STOP_WORDS,
  SOURCE_EXTENSIONS,
  CONFIG_EXTENSIONS,
  SKIP_EXTENSIONS,
  SKIP_FILES,
  SKIP_DIRECTORIES,
} = require("../config/filePatterns.config");

// These are the files always worth including in the context,
// regardless of keyword score (reused from stackRules)
const { ALWAYS_IMPORTANT_FILES } = require("../config/stackRules.config");

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — TOKENIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a raw text string into an array of clean, lowercase search tokens.
 *
 * Handles: camelCase, snake_case, kebab-case, dots, and parentheses.
 *
 * @param {string} text - raw text (issue title or body)
 * @returns {string[]} - array of cleaned, filtered words
 */
const tokenize = (text) => {
  if (!text || typeof text !== "string") return [];

  // Step 1: Split camelCase by inserting a space before each uppercase letter
  //   "useEffect" → "use Effect"
  //   "MyComponent" → "My Component"
  const camelSplit = text.replace(/([a-z])([A-Z])/g, "$1 $2");

  // Step 2: Lowercase everything
  const lowered = camelSplit.toLowerCase();

  // Step 3: Split on any character that's NOT a letter or digit
  //   "click-handler" → ["click", "handler"]
  //   "get_user_data" → ["get", "user", "data"]
  //   "src/auth/token.js" → ["src", "auth", "token", "js"]
  const words = lowered.split(/[^a-z0-9]+/);

  // Step 4: Filter
  return words.filter((word) => {
    if (word.length < 3) return false;          // too short to be meaningful
    if (/^\d+$/.test(word)) return false;        // pure number (e.g. "404", "200")
    if (STOP_WORDS.has(word)) return false;      // stop word
    return true;
  });
};

/**
 * Extracts weighted keywords from an issue.
 * Title keywords get more weight (1.5) than body keywords (1.0),
 * because the title is a curated summary of the problem.
 * Label keywords get weight 0.8 — they're categorical hints.
 *
 * @param {Object} issue - { title, body, labels }
 * @returns {Array<{ word: string, weight: number }>} - sorted by weight desc
 */
const extractKeywords = (issue) => {
  // Only process the first 3000 chars of the body.
  // Long issues put the key details at the top; the rest is usually
  // reproduction steps, logs, and comments — less useful for file matching.
  const bodySnippet = (issue.body || "").substring(0, 3000);

  const titleTokens = tokenize(issue.title || "");
  const bodyTokens = tokenize(bodySnippet);

  // Flatten label names into tokens
  const labelTokens = (issue.labels || [])
    .map((label) => tokenize(typeof label === "string" ? label : label.name || ""))
    .flat();

  // Build a Map from word → its highest weight seen
  // (A word in the title beats the same word in the body)
  const weightMap = new Map();

  titleTokens.forEach((word) => {
    weightMap.set(word, Math.max(weightMap.get(word) || 0, 1.5));
  });

  bodyTokens.forEach((word) => {
    weightMap.set(word, Math.max(weightMap.get(word) || 0, 1.0));
  });

  labelTokens.forEach((word) => {
    weightMap.set(word, Math.max(weightMap.get(word) || 0, 0.8));
  });

  // Convert to array and sort by weight (highest first)
  return Array.from(weightMap.entries())
    .map(([word, weight]) => ({ word, weight }))
    .sort((a, b) => b.weight - a.weight);
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — FILE FILTERING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if a file should be skipped entirely (not scored, not fetched).
 *
 * @param {string} filePath - e.g. "src/middleware/auth.js"
 * @returns {boolean}
 */
const shouldSkipFile = (filePath) => {
  const lower = filePath.toLowerCase();
  const segments = filePath.split("/");
  const filename = segments[segments.length - 1];

  // Check if the file is inside a skip directory
  // We check both the beginning of the path AND inside the path
  // (to catch "packages/lib/node_modules/..." in monorepos)
  if (SKIP_DIRECTORIES.some((dir) =>
    lower.startsWith(dir) || lower.includes("/" + dir)
  )) {
    return true;
  }

  // Get the file extension — handle multi-part extensions like ".test.js"
  const lastDot = filename.lastIndexOf(".");
  const ext = lastDot !== -1 ? filename.substring(lastDot).toLowerCase() : "";

  // Check extension
  if (SKIP_EXTENSIONS.has(ext)) return true;

  // Check by exact filename
  if (SKIP_FILES.has(filename)) return true;

  // Skip minified files (might not catch all but gets common cases)
  if (filename.includes(".min.")) return true;

  // Skip "hidden" files and folders (start with a dot)
  // EXCEPT for common important ones like ".github/", ".env.example"
  const topLevelSegment = segments[0];
  if (
    topLevelSegment.startsWith(".") &&
    topLevelSegment !== ".github" &&
    topLevelSegment !== ".env.example"
  ) {
    return true;
  }

  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — RELEVANCE SCORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scores a single file path against the extracted keywords.
 *
 * ── UPGRADE POINT ────────────────────────────────────────────────────────────
 * To upgrade to embedding-based semantic search:
 *   1. Generate an embedding vector for the issue text (Anthropic/OpenAI API)
 *   2. Generate an embedding vector for each file's path + first 200 chars
 *   3. Replace this function's internals with cosine_similarity(issueVec, fileVec)
 *   4. Return { score: similarity * 100, reasons: ["semantic similarity: 0.87"] }
 *   The function SIGNATURE stays identical. Nothing else changes.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @param {string} filePath - e.g. "src/middleware/auth.js"
 * @param {Array<{ word, weight }>} keywords
 * @returns {{ score: number, reasons: string[] }}
 */
const scoreFile = (filePath, keywords) => {
  let score = 0;
  const reasons = [];

  const segments = filePath.toLowerCase().split("/");
  const filename = segments[segments.length - 1];
  const dirSegments = segments.slice(0, -1); // all folder segments

  // Remove extension to get just the base name
  const lastDot = filename.lastIndexOf(".");
  const filenameNoExt = lastDot !== -1 ? filename.substring(0, lastDot) : filename;

  // Get extension for type bonus
  const ext = lastDot !== -1 ? filename.substring(lastDot) : "";

  // ── KEYWORD MATCHING ────────────────────────────────────────────────────────
  for (const { word, weight } of keywords) {
    // Check 1: Exact filename match (most valuable signal)
    if (filenameNoExt === word) {
      const pts = Math.round(40 * weight);
      score += pts;
      reasons.push(`filename="${word}" +${pts}`);
    }
    // Check 2: Filename contains keyword (partial match)
    else if (filenameNoExt.includes(word)) {
      const pts = Math.round(20 * weight);
      score += pts;
      reasons.push(`filename~"${word}" +${pts}`);
    }

    // Check 3: Directory segment matches
    for (const seg of dirSegments) {
      if (seg === word) {
        // Exact directory name match
        const pts = Math.round(12 * weight);
        score += pts;
        reasons.push(`dir="${seg}/" +${pts}`);
      } else if (seg.includes(word)) {
        // Directory contains keyword
        const pts = Math.round(6 * weight);
        score += pts;
        reasons.push(`dir~"${seg}/" +${pts}`);
      }
    }
  }

  // If no keywords matched, this file has no relation to the issue
  if (score === 0) return { score: 0, reasons: [] };

  // ── FILE TYPE BONUS ─────────────────────────────────────────────────────────
  if (SOURCE_EXTENSIONS.has(ext)) {
    score += 3;
    // Don't add to reasons — minor detail, clutters the display
  } else if (CONFIG_EXTENSIONS.has(ext)) {
    score += 1;
  }

  // ── TEST FILE PENALTY ────────────────────────────────────────────────────────
  // Test files are useful for understanding code, but when an issue mentions
  // "auth", the source file is more useful than "auth.test.js".
  // We reduce their score so they appear lower in the list.
  const isTestFile =
    dirSegments.some((s) =>
      ["test", "tests", "__tests__", "spec", "specs", "__mocks__"].includes(s)
    ) ||
    filenameNoExt.endsWith(".test") ||
    filenameNoExt.endsWith(".spec") ||
    filenameNoExt.includes(".test.") ||
    filenameNoExt.includes(".spec.");

  if (isTestFile) {
    const penalty = Math.min(score - 1, 20); // never go below 1 if there were matches
    score = Math.max(1, score - penalty);
    reasons.push(`test file -${penalty}`);
  }

  return { score, reasons };
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimates the number of AI tokens in a text string.
 * Rule of thumb: 1 token ≈ 4 characters for English/code text.
 *
 * @param {string} text
 * @returns {number}
 */
const estimateTokens = (text) => {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
};

/**
 * Truncates a file's content at a line boundary, then appends a comment
 * so Claude knows the file was cut.
 *
 * @param {string} content - full file content
 * @param {number} maxChars - maximum characters to keep
 * @returns {string}
 */
const truncateAtLineBoundary = (content, maxChars) => {
  if (content.length <= maxChars) return content;

  // Find the last newline BEFORE the maxChars limit
  const lastNewline = content.lastIndexOf("\n", maxChars);

  const cutPoint = lastNewline !== -1 ? lastNewline : maxChars;
  const kept = content.substring(0, cutPoint);

  return (
    kept +
    `\n\n// ... [FILE TRUNCATED: showing first ${maxChars.toLocaleString()} ` +
    `of ${content.length.toLocaleString()} characters]`
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds the most relevant files for a given issue in a GitHub repository.
 * Returns a "Context Package" ready to be turned into an AI prompt.
 *
 * @param {string} owner - GitHub repo owner
 * @param {string} repo  - GitHub repo name
 * @param {Object} issue - { number, title, body, labels }
 * @param {Object} options
 * @param {number} [options.maxFiles=8]           - max files in context
 * @param {number} [options.maxCharsPerFile=8000] - truncate files longer than this
 * @param {number} [options.maxTotalChars=55000]  - total budget across all files
 * @param {string} [options.branch]               - branch to read from
 * @returns {Object} - the Context Package
 */
const getRelevantFiles = async (owner, repo, issue, options = {}) => {
  const {
    maxFiles = 8,
    maxCharsPerFile = 8000,
    maxTotalChars = 55000,
    branch = undefined,
  } = options;

  // ── Step 1: Fetch the full file tree ──────────────────────────────────────
  const tree = await githubService.getRepoTree(owner, repo, branch);
  const allFilePaths = tree.files.map((f) => f.path);

  // ── Step 2: Extract keywords from the issue ────────────────────────────────
  const keywords = extractKeywords(issue);

  // Handle edge case: no keywords extracted (very generic issue title/body)
  if (keywords.length === 0) {
    console.warn("[fileRetriever] No keywords extracted from issue — using key files only");
  }

  // ── Step 3: Score all files ────────────────────────────────────────────────
  const scoredFiles = allFilePaths
    .filter((path) => !shouldSkipFile(path))          // remove skip-listed files
    .map((path) => {
      const { score, reasons } = scoreFile(path, keywords);
      return { path, score, reasons };
    })
    .filter((f) => f.score > 0)                       // only files with matches
    .sort((a, b) => b.score - a.score);               // highest score first

  // ── Step 4: Select files to include in the context ────────────────────────

  // Start with top N scored files
  const selectedPaths = new Set(
    scoredFiles.slice(0, maxFiles).map((f) => f.path)
  );

  // Always try to include key files (README, package.json, etc.)
  // but only if they exist and we haven't hit 2x the normal limit
  const extraSlots = Math.max(0, maxFiles + 2 - selectedPaths.size);
  let slotsAdded = 0;

  for (const importantFile of ALWAYS_IMPORTANT_FILES) {
    if (slotsAdded >= extraSlots) break;
    if (allFilePaths.includes(importantFile) && !selectedPaths.has(importantFile)) {
      selectedPaths.add(importantFile);
      slotsAdded++;
    }
  }

  // ── Step 5: Fetch file contents ────────────────────────────────────────────
  const filesToFetch = Array.from(selectedPaths);
  const fetchedContents = await githubService.getMultipleFiles(
    owner,
    repo,
    filesToFetch,
    branch
  );

  // ── Step 6: Build context files with truncation and token estimation ───────
  let totalChars = 0;
  const contextFiles = [];

  // Sort filesToFetch so the highest-scored files are processed first
  // (if we hit the budget, we drop the lowest-scored files)
  const sortedToFetch = filesToFetch.sort((a, b) => {
    const scoreA = scoredFiles.find((f) => f.path === a)?.score ?? 0;
    const scoreB = scoredFiles.find((f) => f.path === b)?.score ?? 0;
    return scoreB - scoreA;
  });

  for (const path of sortedToFetch) {
    const rawContent = fetchedContents[path];
    if (!rawContent) continue; // file wasn't found (can happen with renamed files)

    // Truncate if needed
    const content = truncateAtLineBoundary(rawContent, maxCharsPerFile);
    const charCount = content.length;

    // Check total budget
    if (totalChars + charCount > maxTotalChars) {
      console.warn(`[fileRetriever] Budget reached at ${totalChars} chars — skipping ${path}`);
      break;
    }

    totalChars += charCount;

    // Find this file's score info (may be undefined for key files with score 0)
    const scoreInfo = scoredFiles.find((f) => f.path === path);

    contextFiles.push({
      path,
      content,
      score: scoreInfo?.score ?? 0,
      reasons: scoreInfo?.reasons ?? ["always-important file"],
      charCount,
      tokenEstimate: estimateTokens(content),
      wasTruncated: rawContent.length > maxCharsPerFile,
    });
  }

  // Sort context files by score (most relevant first — important for the prompt)
  contextFiles.sort((a, b) => b.score - a.score);

  // ── Step 7: Assemble and return the Context Package ────────────────────────
  return {
    issue: {
      number: issue.number,
      title: issue.title,
      body: issue.body || "",
      labels: (issue.labels || []).map((l) =>
        typeof l === "string" ? l : l.name || ""
      ),
    },
    keywords,                         // all extracted keywords with weights
    allScoredFiles: scoredFiles.slice(0, 30), // top 30 for display (not all sent to AI)
    contextFiles,                     // the actual files to include in the prompt
    stats: {
      totalFilesInRepo: allFilePaths.length,
      filesScored: scoredFiles.length,
      filesSkipped: allFilePaths.length - scoredFiles.length,
      filesInContext: contextFiles.length,
      totalChars,
      totalTokenEstimate: estimateTokens(" ".repeat(totalChars)),
    },
  };
};

module.exports = {
  getRelevantFiles,
  extractKeywords,  // exported for testing
  scoreFile,        // exported for testing
  estimateTokens,   // exported for testing
};
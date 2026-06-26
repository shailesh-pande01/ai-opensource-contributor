// src/config/filePatterns.config.js
//
// Scoring rules and lookup tables for the file relevance system.
// ALL DATA lives here. ALL LOGIC lives in fileRetriever.service.js.
//
// To add support for a new skip pattern or stop word,
// edit this file only — no logic changes needed.

// ─── STOP WORDS ───────────────────────────────────────────────────────────────
// Words that appear in issue text but give NO information about which files
// are relevant. We use a Set for O(1) (instant) lookup speed.
//
// Two categories:
//   Grammar words: the, a, in, is — always useless
//   Issue-specific noise: fix, bug, error, issue — describe the problem TYPE,
//   not which files are involved

const STOP_WORDS = new Set([
  // Grammar (English)
  "the", "a", "an", "is", "it", "in", "for", "to", "be", "was", "are",
  "with", "this", "that", "from", "at", "or", "and", "not", "but", "on",
  "if", "by", "as", "its", "into", "been", "has", "have", "had", "will",
  "can", "get", "set", "may", "also", "any", "all", "one", "two", "new",
  "now", "let", "our", "your", "my", "we", "you", "they", "them", "then",
  "when", "where", "what", "how", "why", "which", "who", "does", "did",
  "do", "should", "would", "could", "there", "here", "more", "some",
  "just", "via", "than", "out", "up", "down", "off", "over", "after",
  "before", "about", "above", "below", "too",

  // Issue-specific noise (describe the situation, not the file)
  "fix", "bug", "error", "issue", "problem", "please", "thank", "thanks",
  "update", "change", "add", "remove", "delete", "create", "improve",
  "broken", "wrong", "incorrect", "right", "correct", "expected",
  "actual", "reproduce", "reproduction", "repro", "step", "steps",
  "version", "versions", "release", "releases", "happen", "happens",
  "happening", "found", "find", "see", "seem", "looks", "like", "need",
  "want", "make", "made", "got", "getting", "get", "pull", "push", "run",
  "running", "work", "working", "works", "fail", "fails", "failing",
  "failed", "return", "returns", "call", "calls", "called", "use", "used",
  "using", "try", "tried", "trying", "show", "shown", "shows", "help",
  "feature", "request", "enhancement", "question", "documentation", "docs"
]);

// ─── FILE EXTENSION CATEGORIES ────────────────────────────────────────────────
// Used to give file type bonuses/penalties in scoring.
// Source files (+3): likely contain the actual logic we need to change.
// Config files (+1): useful for context but rarely the files TO change.
// Skip extensions (0 and filtered out): never worth reading.

const SOURCE_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx",   // JavaScript / TypeScript
  ".py",                           // Python
  ".rs",                           // Rust
  ".go",                           // Go
  ".rb",                           // Ruby
  ".java",                         // Java
  ".kt",                           // Kotlin
  ".php",                          // PHP
  ".cs",                           // C#
  ".cpp", ".cc", ".c", ".h",      // C / C++
  ".swift",                        // Swift
  ".dart",                         // Dart (Flutter)
  ".vue", ".svelte",               // Framework-specific components
]);

const CONFIG_EXTENSIONS = new Set([
  ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
  ".md", ".mdx", ".txt", ".sh", ".bash", ".zsh",
  ".env", ".example",
]);

// These extensions are NEVER worth reading in a code context.
// Binary files, generated files, lock files, media, etc.
const SKIP_EXTENSIONS = new Set([
  // Images & media
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
  ".mp4", ".mp3", ".wav", ".avi", ".mov",
  // Fonts
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  // Compiled/binary
  ".pyc", ".pyo", ".class", ".o", ".obj", ".so", ".dll", ".exe",
  ".jar", ".war", ".zip", ".tar", ".gz", ".rar",
  // Generated / minified
  ".min.js", ".min.css", ".map",
  // Database files
  ".db", ".sqlite", ".sqlite3",
  // PDF & documents
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
]);

// ─── FILES TO ALWAYS SKIP ─────────────────────────────────────────────────────
// These files exist in many repos but are never the files to edit.
// Lock files: auto-generated, huge, unreadable.

const SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "poetry.lock",
  "Gemfile.lock",
  "Cargo.lock",
  "composer.lock",
  ".DS_Store",
  "Thumbs.db",
  ".gitkeep",
  ".npmignore",
  ".gitattributes",
  "CHANGELOG.md",   // useful for humans, not for code fixing
  "LICENCE", "LICENSE", "LICENSE.md", "LICENSE.txt",
]);

// ─── DIRECTORIES TO ALWAYS SKIP ───────────────────────────────────────────────
// Entire directories that should never be read.
// These appear as prefixes in file paths.

const SKIP_DIRECTORIES = [
  // Dependencies (NEVER read these — they can be millions of lines)
  "node_modules/",
  "vendor/",
  ".venv/",
  "venv/",
  "__pycache__/",
  "site-packages/",

  // Build output (generated files, not source)
  "dist/",
  "build/",
  "out/",
  "target/",
  ".next/",
  ".nuxt/",
  ".output/",
  "_build/",

  // Coverage / caches
  "coverage/",
  ".nyc_output/",
  ".cache/",
  ".parcel-cache/",

  // Git internals
  ".git/",
];

module.exports = {
  STOP_WORDS,
  SOURCE_EXTENSIONS,
  CONFIG_EXTENSIONS,
  SKIP_EXTENSIONS,
  SKIP_FILES,
  SKIP_DIRECTORIES,
};
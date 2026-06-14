// src/config/stackRules.config.js
//
// ═══════════════════════════════════════════════════════════════
//  THIS FILE CONTAINS DATA ONLY — NO FUNCTIONS, NO LOGIC.
//
//  To add support for a new framework or language, add an entry
//  here. You never need to touch stackDetector.service.js.
// ═══════════════════════════════════════════════════════════════

/**
 * MANIFEST FILES
 * The mere PRESENCE of these files tells us the primary language/ecosystem.
 */
const MANIFEST_FILES = {
  "package.json":      { language: "JavaScript/TypeScript" },
  "requirements.txt":  { language: "Python" },
  "pyproject.toml":    { language: "Python" },
  "Pipfile":           { language: "Python" },
  "Cargo.toml":        { language: "Rust" },
  "go.mod":            { language: "Go" },
  "Gemfile":           { language: "Ruby" },
  "pom.xml":           { language: "Java" },
  "build.gradle":      { language: "Java/Kotlin" },
  "composer.json":     { language: "PHP" },
};

/**
 * FRAMEWORK SIGNATURES
 * Maps a dependency NAME (as found inside package.json / requirements.txt)
 * to a human-readable framework name + category.
 *
 * "category" drives both project-type classification AND the color
 * of the badge shown in the UI.
 */
const FRAMEWORK_SIGNATURES = {
  // ── JavaScript / TypeScript: Frontend ──────────────────────────────
  "react":              { name: "React",        category: "frontend" },
  "react-dom":          { name: "React",        category: "frontend" },
  "vue":                { name: "Vue.js",        category: "frontend" },
  "@angular/core":      { name: "Angular",       category: "frontend" },
  "svelte":             { name: "Svelte",        category: "frontend" },

  // ── JavaScript / TypeScript: Fullstack ─────────────────────────────
  "next":               { name: "Next.js",       category: "fullstack" },
  "nuxt":               { name: "Nuxt.js",       category: "fullstack" },

  // ── JavaScript / TypeScript: Backend ───────────────────────────────
  "express":            { name: "Express.js",    category: "backend" },
  "fastify":            { name: "Fastify",       category: "backend" },
  "@nestjs/core":       { name: "NestJS",        category: "backend" },
  "koa":                { name: "Koa",           category: "backend" },

  // ── Testing ─────────────────────────────────────────────────────────
  "jest":               { name: "Jest",                  category: "testing" },
  "mocha":              { name: "Mocha",                 category: "testing" },
  "vitest":             { name: "Vitest",                category: "testing" },
  "@testing-library/react": { name: "React Testing Library", category: "testing" },
  "cypress":            { name: "Cypress",               category: "testing" },
  "playwright":         { name: "Playwright",            category: "testing" },
  "pytest":             { name: "Pytest",                category: "testing" },

  // ── Build Tools / Tooling ───────────────────────────────────────────
  "vite":               { name: "Vite",         category: "build-tool" },
  "webpack":            { name: "Webpack",       category: "build-tool" },
  "rollup":             { name: "Rollup",        category: "build-tool" },
  "typescript":         { name: "TypeScript",    category: "language" },
  "eslint":             { name: "ESLint",        category: "linting" },
  "prettier":           { name: "Prettier",      category: "linting" },

  // ── Python: Backend ──────────────────────────────────────────────────
  "django":             { name: "Django",        category: "backend" },
  "flask":              { name: "Flask",         category: "backend" },
  "fastapi":            { name: "FastAPI",       category: "backend" },

  // ── Python: Data Science / ML ──────────────────────────────────────
  "numpy":              { name: "NumPy",         category: "data-science" },
  "pandas":             { name: "Pandas",        category: "data-science" },
  "torch":              { name: "PyTorch",       category: "machine-learning" },
  "tensorflow":         { name: "TensorFlow",    category: "machine-learning" },
};

/**
 * PROJECT TYPE INDICATORS
 * Paths that hint at the overall project setup.
 * A path "counts" if it EXACTLY equals the entry, or starts with "entry/".
 */
const PROJECT_TYPE_INDICATORS = {
  hasDockerfile: ["Dockerfile", "dockerfile"],
  hasCI:         [".github/workflows", ".gitlab-ci.yml", ".circleci", "azure-pipelines.yml"],
  hasDocs:       ["docs", "DOCUMENTATION.md"],
  hasTests:      ["test", "tests", "__tests__", "spec"],
};

/**
 * ALWAYS-IMPORTANT FILES
 * Root-level files that are almost always worth looking at,
 * regardless of which issue we're solving. Used for "Key Files".
 */
const ALWAYS_IMPORTANT_FILES = [
  "README.md",
  "package.json",
  "tsconfig.json",
  "requirements.txt",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "pom.xml",
  "Dockerfile",
  "docker-compose.yml",
];

module.exports = {
  MANIFEST_FILES,
  FRAMEWORK_SIGNATURES,
  PROJECT_TYPE_INDICATORS,
  ALWAYS_IMPORTANT_FILES,
};
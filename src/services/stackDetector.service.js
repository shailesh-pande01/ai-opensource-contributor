// src/services/stackDetector.service.js
//
// Takes a repo's file tree + manifest file contents and produces
// a normalized "Repo Profile" object.
//
// This is RULE-BASED (heuristic) detection — fast, free, deterministic.
// All the "knowledge" lives in stackRules.config.js. This file is just LOGIC.

const githubService = require("./github.service");
const {
  MANIFEST_FILES,
  FRAMEWORK_SIGNATURES,
  PROJECT_TYPE_INDICATORS,
  ALWAYS_IMPORTANT_FILES,
} = require("../config/stackRules.config");

/**
 * MAIN ENTRY POINT.
 * Given owner/repo, returns the complete Repo Profile.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} [branch]
 * @returns {Object} - the Repo Profile
 */
const analyzeRepository = async (owner, repo, branch) => {
  // ── Step 1: Resolve the branch ONCE ─────────────────────────────────────
  // We do this here (not just inside getRepoTree) so we only call
  // getRepoInfo a single time, even though getRepoTree could also do it.
  // This is "service composition" — building bigger operations out of
  // smaller, already-tested pieces.
  let targetBranch = branch;
  if (!targetBranch) {
    const repoInfo = await githubService.getRepoInfo(owner, repo);
    targetBranch = repoInfo.defaultBranch;
  }

  // ── Step 2: Get the full file tree ──────────────────────────────────────
  const tree = await githubService.getRepoTree(owner, repo, targetBranch);
  const filePaths = tree.files.map((f) => f.path);

  // ── Step 3: Find which manifest files exist ─────────────────────────────
  const manifestPaths = Object.keys(MANIFEST_FILES).filter((manifest) =>
    filePaths.includes(manifest)
  );

  // ── Step 4: Fetch the content of those manifest files ───────────────────
  const manifestContents = await githubService.getMultipleFiles(
    owner,
    repo,
    manifestPaths,
    targetBranch
  );

  // ── Step 5: Detect languages from manifest presence ─────────────────────
  const languages = detectLanguages(manifestPaths);

  // ── Step 6: Extract dependencies and detect frameworks ───────────────────
  const dependencies = extractDependencies(manifestContents);
  const frameworks = detectFrameworks(dependencies);

  // ── Step 7: Classify project type ────────────────────────────────────────
  const projectType = classifyProjectType(filePaths, frameworks);

  // ── Step 8: Detect indicators (CI, Docker, tests, docs) ──────────────────
  const indicators = detectIndicators(filePaths);

  // ── Step 9: Identify key files ────────────────────────────────────────────
  const keyFiles = identifyKeyFiles(filePaths);

  // ── Step 10: Summarize top-level folder structure ────────────────────────
  const folderStructure = summarizeFolderStructure(filePaths);

  return {
    owner,
    repo,
    branch: targetBranch,
    languages,
    frameworks,
    projectType,
    indicators,
    keyFiles,
    folderStructure,
    stats: {
      totalFiles: tree.totalFiles,
      truncated: tree.truncated,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP FUNCTIONS — each one does ONE job, and is easy to test independently
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects programming languages based on which manifest files exist.
 * Uses a Set so "package.json" and (hypothetically) another JS manifest
 * don't produce duplicate "JavaScript/TypeScript" entries.
 */
const detectLanguages = (manifestPaths) => {
  const languages = new Set();

  manifestPaths.forEach((manifestFile) => {
    const info = MANIFEST_FILES[manifestFile];
    if (info) languages.add(info.language);
  });

  return Array.from(languages);
};

/**
 * Parses manifest contents to extract dependency names.
 * Currently supports:
 *   - package.json   (full JSON parsing — dependencies + devDependencies)
 *   - requirements.txt (line-by-line text parsing)
 *
 * Returns a flat array of lowercase package names, e.g. ["react", "express", "jest"]
 */
const extractDependencies = (manifestContents) => {
  const deps = new Set();

  // ── package.json ──────────────────────────────────────────────────────
  if (manifestContents["package.json"]) {
    try {
      const pkg = JSON.parse(manifestContents["package.json"]);
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };
      Object.keys(allDeps).forEach((dep) => deps.add(dep.toLowerCase()));
    } catch (e) {
      // package.json exists but isn't valid JSON (rare, but possible
      // for repos mid-refactor). We don't crash — just skip it.
      console.warn("[stackDetector] Could not parse package.json:", e.message);
    }
  }

  // ── requirements.txt ──────────────────────────────────────────────────
  // Format: one package per line, e.g. "django==4.2.0" or "flask>=2.0"
  if (manifestContents["requirements.txt"]) {
    const lines = manifestContents["requirements.txt"].split("\n");

    lines.forEach((line) => {
      const trimmed = line.trim();

      // Skip empty lines, comments, and pip flags (start with "-")
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) return;

      // Package name = everything before the first version specifier
      // (==, >=, <=, ~=, etc.)
      const match = trimmed.match(/^([a-zA-Z0-9_-]+)/);
      if (match) deps.add(match[1].toLowerCase());
    });
  }

  return Array.from(deps);
};

/**
 * Maps detected dependencies to known frameworks using FRAMEWORK_SIGNATURES.
 * Multiple dependencies can map to the same framework (react + react-dom → React) —
 * we avoid showing "React" twice.
 */
const detectFrameworks = (dependencies) => {
  const frameworks = [];

  dependencies.forEach((dep) => {
    const signature = FRAMEWORK_SIGNATURES[dep];
    if (!signature) return;

    const alreadyAdded = frameworks.some((f) => f.name === signature.name);
    if (!alreadyAdded) {
      frameworks.push({ ...signature, detectedFrom: dep });
    }
  });

  return frameworks;
};

/**
 * Classifies the overall project type based on detected framework categories.
 *
 *   fullstack-framework  → uses Next.js/Nuxt (frontend + backend in one framework)
 *   fullstack            → has BOTH a frontend AND backend framework
 *   frontend             → frontend framework only
 *   backend              → backend framework only
 *   cli-tool             → no framework, but has a "cli"-related path
 *   library              → fallback (e.g. lodash, axios)
 */
const classifyProjectType = (filePaths, frameworks) => {
  const categories = frameworks.map((f) => f.category);

  if (categories.includes("fullstack")) return "fullstack-framework";

  const hasFrontend = categories.includes("frontend");
  const hasBackend = categories.includes("backend");

  if (hasFrontend && hasBackend) return "fullstack";
  if (hasFrontend) return "frontend";
  if (hasBackend) return "backend";

  if (filePaths.some((p) => p.toLowerCase().includes("cli"))) return "cli-tool";

  return "library";
};

/**
 * Detects project-level indicators: CI/CD, Docker, tests, documentation.
 *
 * A path "counts" if it EXACTLY matches the pattern, or is INSIDE a folder
 * matching the pattern (path.startsWith(`${pattern}/`)).
 * This avoids false positives like "testing-utils.js" matching pattern "test".
 */
const detectIndicators = (filePaths) => {
  const has = (patterns) =>
    patterns.some((pattern) =>
      filePaths.some((path) => path === pattern || path.startsWith(`${pattern}/`))
    );

  return {
    hasDockerfile: has(PROJECT_TYPE_INDICATORS.hasDockerfile),
    hasCI: has(PROJECT_TYPE_INDICATORS.hasCI),
    hasDocs: has(PROJECT_TYPE_INDICATORS.hasDocs),
    hasTests: has(PROJECT_TYPE_INDICATORS.hasTests),
  };
};

/**
 * Returns the root-level files from ALWAYS_IMPORTANT_FILES that actually
 * exist in this repo.
 */
const identifyKeyFiles = (filePaths) => {
  return ALWAYS_IMPORTANT_FILES.filter((important) => filePaths.includes(important));
};

/**
 * Builds a top-level folder/file summary.
 * E.g. ["src/", "test/", "package.json", "README.md"]
 *
 * Uses a Set to avoid listing "src/" once per file inside src/.
 */
const summarizeFolderStructure = (filePaths) => {
  const topLevel = new Set();

  filePaths.forEach((path) => {
    const firstSegment = path.split("/")[0];
    const isInsideFolder = path.includes("/");
    topLevel.add(isInsideFolder ? `${firstSegment}/` : firstSegment);
  });

  return Array.from(topLevel).sort();
};

module.exports = {
  analyzeRepository,
};
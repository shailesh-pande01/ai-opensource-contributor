// src/services/promptGenerator.service.js

/**
 * RESPONSE FORMAT SCHEMA
 * Claude must return responses using these exact XML tags.
 * Day 6's parser reads these tags to extract structured data.
 */
const RESPONSE_SCHEMA = `
You MUST respond using EXACTLY these XML tags, in this order, with no text outside them:

<analysis>
Your understanding of the issue: root cause, what is broken, why it happens.
</analysis>

<affected_files>
List every file path that needs to be created or modified. One per line.
Example:
src/middleware/auth.js
src/utils/token.js
</affected_files>

<code_changes>
For EACH file that needs changes, use this exact format:

FILE: path/to/file.js
CHANGE: brief description of what changed and why
\`\`\`javascript
// Complete modified file content here
// OR clearly marked diff section if file is too large:
// === SECTION TO MODIFY ===
// [old code]
// === REPLACE WITH ===
// [new code]
\`\`\`

Repeat FILE/CHANGE/code block for every affected file.
</code_changes>

<pr_description>
## Summary
One paragraph describing what this PR fixes and how.

## Changes Made
- Bullet list of every change

## How to Test
Step-by-step testing instructions

## Related Issue
Closes #ISSUE_NUMBER
</pr_description>
`.trim();

// ─── SHARED CONTEXT BLOCK ─────────────────────────────────────────────────────
// Used by all 3 prompt modes

const buildRepoContext = (repoProfile, issue, contextPackage) => {
  const profile = repoProfile || {};
  const languages = (profile.languages || []).join(", ") || "Unknown";
  const frameworks = (profile.frameworks || []).map((f) => f.name).join(", ") || "None detected";
  const projectType = profile.projectType || "unknown";
  const indicators = profile.indicators || {};
  const keyFiles = (profile.keyFiles || []).join(", ") || "None";

  return `
## REPOSITORY CONTEXT
- Repo: ${profile.owner || ""}/${profile.repo || ""}
- Language: ${languages}
- Frameworks: ${frameworks}
- Project Type: ${projectType}
- Has Tests: ${indicators.hasTests ? "Yes" : "No"}
- Has CI: ${indicators.hasCI ? "Yes" : "No"}
- Has Docker: ${indicators.hasDockerfile ? "Yes" : "No"}
- Key Config Files: ${keyFiles}
`.trim();
};

const buildIssueContext = (issue) => {
  const labels = (issue.labels || [])
    .map((l) => (typeof l === "string" ? l : l.name))
    .filter(Boolean)
    .join(", ");

  return `
## ISSUE #${issue.number}
**Title:** ${issue.title}
**Labels:** ${labels || "none"}
**Description:**
${(issue.body || "No description provided.").substring(0, 3000)}
`.trim();
};

const buildFilesContext = (contextPackage) => {
  if (!contextPackage || !contextPackage.contextFiles || contextPackage.contextFiles.length === 0) {
    return "## RELEVANT FILES\nNo files retrieved.";
  }

  const fileBlocks = contextPackage.contextFiles
    .map((file) => {
      // Detect language for syntax highlighting hint
      const ext = file.path.split(".").pop().toLowerCase();
      const langMap = {
        js: "javascript", ts: "typescript", jsx: "jsx", tsx: "tsx",
        py: "python", rs: "rust", go: "go", rb: "ruby",
        java: "java", php: "php", md: "markdown", json: "json",
        yml: "yaml", yaml: "yaml", sh: "bash",
      };
      const lang = langMap[ext] || ext;

      return `### ${file.path} (relevance score: ${file.score})\n\`\`\`${lang}\n${file.content}\n\`\`\``;
    })
    .join("\n\n");

  const stats = contextPackage.stats || {};
  return `## RELEVANT FILES
Retrieved ${stats.filesInContext || 0} files (~${(stats.totalTokenEstimate || 0).toLocaleString()} tokens).
Files are ranked by relevance to this issue.

${fileBlocks}`;
};

// ─── PROMPT MODE 1: ANALYZE ───────────────────────────────────────────────────

const buildAnalyzePrompt = (issue, repoProfile, contextPackage) => {
  return `You are an expert open source contributor performing a deep analysis of a GitHub issue.
Your goal is to fully understand the issue before any code is written.

${buildRepoContext(repoProfile, issue, contextPackage)}

${buildIssueContext(issue)}

${buildFilesContext(contextPackage)}

## YOUR TASK
Analyze this issue thoroughly. Focus on:
1. What is the exact root cause?
2. Which files/functions are responsible?
3. What is the correct approach to fix it?
4. Are there any edge cases or risks?
5. What tests should be written or updated?

${RESPONSE_SCHEMA}

Be precise. Reference specific line numbers and function names where possible.
If the provided files are not enough to fully understand the issue, state clearly what additional files you would need.`;
};

// ─── PROMPT MODE 2: GENERATE FIX ─────────────────────────────────────────────

const buildFixPrompt = (issue, repoProfile, contextPackage, priorAnalysis = "") => {
  const analysisSection = priorAnalysis
    ? `## PRIOR ANALYSIS\nYou (or a prior Claude session) already analyzed this issue:\n${priorAnalysis}\n\nUse this analysis to guide your code changes.`
    : "";

  return `You are an expert open source contributor writing a code fix for a GitHub issue.
Your fix must follow the existing code style, patterns, and conventions of this repository.

${buildRepoContext(repoProfile, issue, contextPackage)}

${buildIssueContext(issue)}

${analysisSection ? analysisSection + "\n\n" : ""}${buildFilesContext(contextPackage)}

## YOUR TASK
Write the complete code fix for this issue.

Rules:
- Match the existing code style exactly (indentation, naming, patterns)
- Do not introduce new dependencies unless absolutely necessary
- Write minimal, focused changes — do not refactor unrelated code
- If tests exist in the repo, write or update tests for your fix
- If the fix touches a public API, update documentation/comments
- For each changed file, provide the COMPLETE modified file content (not just a diff)
  UNLESS the file is extremely large — then provide clearly marked before/after sections

${RESPONSE_SCHEMA}`.replace("ISSUE_NUMBER", String(issue.number));
};

// ─── PROMPT MODE 3: PR DESCRIPTION ───────────────────────────────────────────

const buildPRPrompt = (issue, repoProfile, contextPackage, codeChangeSummary = "") => {
  const changesSection = codeChangeSummary
    ? `## CODE CHANGES SUMMARY\n${codeChangeSummary}`
    : `## CODE CHANGES\nThe following files were modified to fix issue #${issue.number}:\n${
        (contextPackage?.contextFiles || []).map((f) => `- ${f.path}`).join("\n") || "No files listed."
      }`;

  return `You are an expert open source contributor writing a professional Pull Request description.
The PR description must be clear, complete, and follow open source contribution best practices.

${buildRepoContext(repoProfile, issue, contextPackage)}

${buildIssueContext(issue)}

${changesSection}

## YOUR TASK
Write a professional Pull Request description for the code changes above.

The PR description should:
- Clearly explain WHAT was changed and WHY
- Be written for someone unfamiliar with the issue
- Include testing instructions a reviewer can follow
- Reference the issue number (Closes #${issue.number})
- Be formatted in clean Markdown
- NOT be too long — aim for clarity over length

${RESPONSE_SCHEMA}`;
};

// ─── MAIN EXPORT FUNCTION ─────────────────────────────────────────────────────

/**
 * Generates a prompt for the given mode.
 *
 * @param {string} mode - "analyze" | "fix" | "pr"
 * @param {Object} issue - the selected issue object
 * @param {Object} repoProfile - from stackDetector (Day 3)
 * @param {Object} contextPackage - from fileRetriever (Day 4)
 * @param {Object} extras - { priorAnalysis, codeChangeSummary }
 * @returns {{ prompt: string, mode: string, stats: Object }}
 */
const generatePrompt = (mode, issue, repoProfile, contextPackage, extras = {}) => {
  if (!issue) throw new Error("issue is required");

  let prompt;

  switch (mode) {
    case "analyze":
      prompt = buildAnalyzePrompt(issue, repoProfile, contextPackage);
      break;
    case "fix":
      prompt = buildFixPrompt(issue, repoProfile, contextPackage, extras.priorAnalysis || "");
      break;
    case "pr":
      prompt = buildPRPrompt(issue, repoProfile, contextPackage, extras.codeChangeSummary || "");
      break;
    default:
      throw new Error(`Unknown prompt mode: "${mode}". Use "analyze", "fix", or "pr".`);
  }

  const charCount = prompt.length;
  const tokenEstimate = Math.ceil(charCount / 4);

  return {
    prompt,
    mode,
    stats: {
      charCount,
      tokenEstimate,
      withinLimit: tokenEstimate < 180000, // Claude.ai chat limit
      warning: tokenEstimate > 150000
        ? "Prompt is very large — consider reducing the number of context files."
        : tokenEstimate > 100000
        ? "Prompt is large — may hit limits in free Claude tier."
        : null,
    },
  };
};

module.exports = { generatePrompt };
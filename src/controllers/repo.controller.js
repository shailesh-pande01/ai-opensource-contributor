// src/controllers/repo.controller.js
//
// Controllers are the "traffic directors" of your API.
// They:
//   1. Receive a request from the route
//   2. Validate the input
//   3. Call the appropriate service
//   4. Send back a response (success or error)
//
// Controllers should NOT contain business logic.
// Business logic lives in services.
// Controllers just coordinate.

const responseParser = require("../services/responseParser.service");
const fileWriter     = require("../services/fileWriter.service");
const promptGenerator = require("../services/promptGenerator.service");
const fileRetriever = require("../services/fileRetriever.service");
const githubService = require("../services/github.service");
const aiService = require("../services/ai.service");
const { parseGitHubURL } = require("../utils/parser.utils");

const stackDetector = require("../services/stackDetector.service");

// ─────────────────────────────────────────────────────────────────────────────
// GET REPOSITORY INFO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles: POST /api/repo/info
 *
 * Request body: { "repoUrl": "https://github.com/facebook/react" }
 * Response:     { "success": true, "data": { ...repoInfo } }
 */
const getRepoInfo = async (req, res) => {
  try {
    // Step 1: Get the URL from the request body
    const { repoUrl } = req.body;

    // Step 2: Validate — make sure a URL was actually provided
    if (!repoUrl) {
      // 400 = "Bad Request" — the client sent incomplete data
      return res.status(400).json({
        success: false,
        message: "Please provide a repoUrl in the request body",
        example: { repoUrl: "https://github.com/facebook/react" },
      });
    }

    // Step 3: Parse the URL to extract owner and repo name
    // parseGitHubURL throws an Error if the URL is invalid
    const { owner, repo } = parseGitHubURL(repoUrl);

    // Step 4: Call the GitHub service
    const repoInfo = await githubService.getRepoInfo(owner, repo);

    // Step 5: Send success response
    // 200 = "OK"
    return res.status(200).json({
      success: true,
      data: repoInfo,
    });

  } catch (error) {
    // If anything above threw an error, it lands here
    // We log it on the server and send a clean message to the client
    console.error("[getRepoInfo] Error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ISSUES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles: POST /api/repo/issues
 *
 * Request body: { "repoUrl": "...", "limit": 20 }
 * Response:     { "success": true, "data": { "total": N, "issues": [...] } }
 */
const getIssues = async (req, res) => {
  try {
    const { repoUrl, limit = 20 } = req.body;

    if (!repoUrl) {
      return res.status(400).json({
        success: false,
        message: "Please provide a repoUrl in the request body",
      });
    }

    const { owner, repo } = parseGitHubURL(repoUrl);

    const issues = await githubService.getIssues(owner, repo, limit);

    return res.status(200).json({
      success: true,
      data: {
        owner,
        repo,
        total: issues.length,
        issues,
      },
    });

  } catch (error) {
    console.error("[getIssues] Error:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET CONTRIBUTORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles: POST /api/repo/contributors
 */
const getContributors = async (req, res) => {
  try {
    const { repoUrl } = req.body;

    if (!repoUrl) {
      return res.status(400).json({
        success: false,
        message: "Please provide a repoUrl",
      });
    }

    const { owner, repo } = parseGitHubURL(repoUrl);
    const contributors = await githubService.getContributors(owner, repo);

    return res.status(200).json({
      success: true,
      data: { contributors },
    });

  } catch (error) {
    console.error("[getContributors] Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET RATE LIMIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles: GET /api/repo/rate-limit
 * Useful for debugging — call this if you think you're being throttled.
 */
const getRateLimit = async (req, res) => {
  try {
    const rateLimit = await githubService.getRateLimit();
    return res.status(200).json({ success: true, data: rateLimit });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET AI STATUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles: GET /api/repo/ai-status
 * Tells the frontend whether AI APIs are configured or we're in manual mode.
 */
const getAIStatus = (req, res) => {
  // aiService.getStatus() is synchronous — no await needed
  const status = aiService.getStatus();
  return res.status(200).json({ success: true, data: status });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET FILE TREE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles: POST /api/repo/tree
 * Request body: { "repoUrl": "...", "branch": "main" (optional) }
 */
const getTree = async (req, res) => {
  try {
    const { repoUrl, branch } = req.body;

    if (!repoUrl) {
      return res.status(400).json({
        success: false,
        message: "Please provide a repoUrl",
      });
    }

    const { owner, repo } = parseGitHubURL(repoUrl);
    const tree = await githubService.getRepoTree(owner, repo, branch);

    return res.status(200).json({ success: true, data: tree });
  } catch (error) {
    console.error("[getTree] Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE FILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles: POST /api/repo/file
 * Request body: { "repoUrl": "...", "path": "package.json", "branch": "main" (optional) }
 */
const getFile = async (req, res) => {
  try {
    const { repoUrl, path: filePath, branch } = req.body;

    if (!repoUrl || !filePath) {
      return res.status(400).json({
        success: false,
        message: "Please provide repoUrl and path",
        example: { repoUrl: "https://github.com/owner/repo", path: "package.json" },
      });
    }

    const { owner, repo } = parseGitHubURL(repoUrl);
    const file = await githubService.getFileContent(owner, repo, filePath, branch);

    return res.status(200).json({ success: true, data: file });
  } catch (error) {
    console.error("[getFile] Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ANALYZE STACK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles: POST /api/repo/analyze
 * Request body: { "repoUrl": "...", "branch": "main" (optional) }
 * Response: { "success": true, "data": <Repo Profile> }
 */
const analyzeStack = async (req, res) => {
  try {
    const { repoUrl, branch } = req.body;

    if (!repoUrl) {
      return res.status(400).json({
        success: false,
        message: "Please provide a repoUrl",
      });
    }

    const { owner, repo } = parseGitHubURL(repoUrl);
    const profile = await stackDetector.analyzeRepository(owner, repo, branch);

    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error("[analyzeStack] Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET RELEVANT FILES (Context Package)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles: POST /api/repo/relevant-files
 *
 * Request body:
 *   {
 *     "repoUrl": "https://github.com/owner/repo",
 *     "issue": {
 *       "number": 123,
 *       "title": "...",
 *       "body": "...",
 *       "labels": [{ "name": "bug" }]
 *     }
 *   }
 *
 * Response:
 *   { "success": true, "data": <Context Package> }
 */
const getRelevantFiles = async (req, res) => {
  try {
    const { repoUrl, issue } = req.body;

    // Validate inputs
    if (!repoUrl) {
      return res.status(400).json({
        success: false,
        message: "Please provide a repoUrl",
      });
    }

    if (!issue || !issue.title) {
      return res.status(400).json({
        success: false,
        message: "Please provide an issue object with at least a title",
        example: {
          issue: {
            number: 123,
            title: "Fix memory leak in auth middleware",
            body: "When using the auth middleware...",
            labels: [{ name: "bug" }],
          },
        },
      });
    }

    const { owner, repo } = parseGitHubURL(repoUrl);

    // This is the slowest endpoint so far — it fetches the file tree
    // AND the contents of 8+ files. Log the start time for debugging.
    const startTime = Date.now();
    console.log(`[getRelevantFiles] Starting for ${owner}/${repo} issue #${issue.number}...`);

    const contextPackage = await fileRetriever.getRelevantFiles(owner, repo, issue);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[getRelevantFiles] Done in ${elapsed}s — ${contextPackage.stats.filesInContext} files, ~${contextPackage.stats.totalTokenEstimate} tokens`);

    return res.status(200).json({ success: true, data: contextPackage });

  } catch (error) {
    console.error("[getRelevantFiles] Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GENERATE PROMPT ──────────────────────────────────────────────────────────

/**
 * POST /api/repo/generate-prompt
 * Body: { mode, issue, repoProfile, contextPackage, extras }
 */
const generatePrompt = (req, res) => {
  try {
    const { mode, issue, repoProfile, contextPackage, extras } = req.body;

    if (!mode || !issue) {
      return res.status(400).json({
        success: false,
        message: "mode and issue are required",
        validModes: ["analyze", "fix", "pr"],
      });
    }

    const result = promptGenerator.generatePrompt(
      mode,
      issue,
      repoProfile,
      contextPackage,
      extras || {}
    );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("[generatePrompt] Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PARSE CLAUDE RESPONSE ────────────────────────────────────────────────────

/**
 * POST /api/repo/parse-response
 * Body: { rawResponse: "...Claude's full response..." }
 */
const parseResponse = (req, res) => {
  try {
    const { rawResponse } = req.body;

    if (!rawResponse) {
      return res.status(400).json({
        success: false,
        message: "rawResponse is required in the request body",
      });
    }

    const parsed = responseParser.parseClaudeResponse(rawResponse);
    return res.status(200).json({ success: true, data: parsed });

  } catch (error) {
    console.error("[parseResponse] Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── APPLY CHANGES (write to output/) ─────────────────────────────────────────

/**
 * POST /api/repo/apply-changes
 * Body: { parsedResponse: {...}, issueNumber: 123 }
 */
const applyChanges = (req, res) => {
  try {
    const { parsedResponse, issueNumber } = req.body;

    if (!parsedResponse) {
      return res.status(400).json({ success: false, message: "parsedResponse is required" });
    }

    if (!issueNumber) {
      return res.status(400).json({ success: false, message: "issueNumber is required" });
    }

    const result = fileWriter.writeChanges(parsedResponse, issueNumber);
    return res.status(200).json({ success: true, data: result });

  } catch (error) {
    console.error("[applyChanges] Error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getRepoInfo,
  getIssues,
  getContributors,
  getRateLimit,
  getAIStatus,
  getTree,
  getFile,
  analyzeStack,
  getRelevantFiles,
  generatePrompt,
  parseResponse,   // ← NEW
  applyChanges,    // ← NEW
};
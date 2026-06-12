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

const githubService = require("../services/github.service");
const aiService = require("../services/ai.service");
const { parseGitHubURL } = require("../utils/parser.utils");

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

module.exports = {
  getRepoInfo,
  getIssues,
  getContributors,
  getRateLimit,
  getAIStatus,
};
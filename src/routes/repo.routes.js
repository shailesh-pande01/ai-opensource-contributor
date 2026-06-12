// src/routes/repo.routes.js
//
// Routes define the "menu" of your API.
// Each line here creates one URL your frontend can call.
//
// Pattern:
//   router.METHOD("path", controllerFunction)
//
// All these routes are prefixed with /api/repo because of how
// server.js mounts them: app.use("/api/repo", repoRoutes)
//
// So router.post("/info", ...) becomes POST /api/repo/info

const { Router } = require("express");
const {
  getRepoInfo,
  getIssues,
  getContributors,
  getRateLimit,
  getAIStatus,
} = require("../controllers/repo.controller");

const router = Router();

// POST /api/repo/info
// Body: { repoUrl: "https://github.com/owner/repo" }
router.post("/info", getRepoInfo);

// POST /api/repo/issues
// Body: { repoUrl: "...", limit: 20 }
router.post("/issues", getIssues);

// POST /api/repo/contributors
// Body: { repoUrl: "..." }
router.post("/contributors", getContributors);

// GET /api/repo/rate-limit
// No body needed
router.get("/rate-limit", getRateLimit);

// GET /api/repo/ai-status
// No body needed — tells frontend if AI API is configured
router.get("/ai-status", getAIStatus);

module.exports = router;
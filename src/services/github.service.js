// src/services/github.service.js
//
// This service handles ALL communication with GitHub's API.
// It uses Octokit — GitHub's official JavaScript library.
//
// Controllers call these functions.
// These functions call GitHub.
// GitHub returns raw data.
// These functions clean up the data and return only what we need.

const { Octokit } = require("@octokit/rest");

// Create one Octokit instance for the entire app.
// Octokit reads GITHUB_TOKEN from process.env automatically.
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  // userAgent: identifies your app to GitHub (good practice)
  userAgent: "ai-contributor-app v1.0.0",
});

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORY INFO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches basic information about a repository.
 *
 * GitHub API endpoint: GET /repos/{owner}/{repo}
 *
 * @param {string} owner - Repository owner (e.g. "facebook")
 * @param {string} repo  - Repository name (e.g. "react")
 * @returns {Object} - Cleaned repo info object
 */
const getRepoInfo = async (owner, repo) => {
  try {
    // octokit.repos.get() calls: GET https://api.github.com/repos/{owner}/{repo}
    // The { data } destructuring pulls out just the data property from the response
    const { data } = await octokit.repos.get({ owner, repo });

    // We don't return the raw GitHub response — it has 100+ fields we don't need.
    // We pick only what matters for our app.
    return {
      name: data.name,
      fullName: data.full_name,             // "facebook/react"
      description: data.description,
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      openIssues: data.open_issues_count,
      language: data.language,
      defaultBranch: data.default_branch,   // "main" or "master"
      url: data.html_url,
      apiUrl: data.url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      topics: data.topics || [],            // e.g. ["javascript", "ui"]
      license: data.license?.name || null,
      isPrivate: data.private,
      isFork: data.fork,
      hasWiki: data.has_wiki,
      hasIssues: data.has_issues,
      owner: {
        login: data.owner.login,
        avatar: data.owner.avatar_url,
        type: data.owner.type,              // "User" or "Organization"
      },
    };
  } catch (error) {
    // Convert GitHub's cryptic errors into human-readable messages
    throw handleGitHubError(error, owner, repo);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ISSUES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches open issues for a repository.
 *
 * GitHub API endpoint: GET /repos/{owner}/{repo}/issues
 *
 * Note: GitHub's issues endpoint also returns Pull Requests.
 * We filter those out because they have a "pull_request" field.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {number} limit - Maximum number of issues to fetch (default: 30)
 * @returns {Array} - Array of cleaned issue objects
 */
const getIssues = async (owner, repo, limit = 30) => {
  try {
    const { data } = await octokit.issues.listForRepo({
      owner,
      repo,
      state: "open",       // only fetch open issues
      per_page: limit,     // how many to return per page
      sort: "updated",     // most recently updated first
      direction: "desc",
    });

    // Filter out Pull Requests (GitHub returns them mixed with issues)
    // A real issue does NOT have a "pull_request" field
    const issuesOnly = data.filter((item) => !item.pull_request);

    // Clean up each issue — again, we only keep what matters
    return issuesOnly.map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body || "",                           // issue description
      state: issue.state,
      labels: issue.labels.map((l) => ({
        name: l.name,
        color: l.color,                                 // hex color like "d73a4a"
        description: l.description,
      })),
      user: {
        login: issue.user.login,
        avatar: issue.user.avatar_url,
      },
      comments: issue.comments,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      url: issue.html_url,
      apiUrl: issue.url,
      // assignees: who is assigned to fix this
      assignees: issue.assignees.map((a) => a.login),
      // milestone: e.g. "v19.0.0"
      milestone: issue.milestone?.title || null,
    }));
  } catch (error) {
    throw handleGitHubError(error, owner, repo);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTRIBUTORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the top contributors for a repository.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {number} limit - Max contributors to return
 * @returns {Array}
 */
const getContributors = async (owner, repo, limit = 10) => {
  try {
    const { data } = await octokit.repos.listContributors({
      owner,
      repo,
      per_page: limit,
    });

    return data.map((contributor) => ({
      login: contributor.login,
      avatar: contributor.avatar_url,
      contributions: contributor.contributions,
      url: contributor.html_url,
    }));
  } catch (error) {
    // Contributors endpoint sometimes fails on empty repos — return empty array
    if (error.status === 204) return [];
    throw handleGitHubError(error, owner, repo);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORY TREE & FILE CONTENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the full recursive file tree of a repository — every file path,
 * in a single API call.
 *
 * GitHub API endpoint: GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} [branch] - if not provided, uses the repo's default branch
 * @returns {Object} - { branch, totalFiles, truncated, files: [{path, size, sha}] }
 */
const getRepoTree = async (owner, repo, branch) => {
  try {
    // If no branch was given, find the default branch first
    // (reuses the function we already wrote in Day 2)
    let targetBranch = branch;
    if (!targetBranch) {
      const repoInfo = await getRepoInfo(owner, repo);
      targetBranch = repoInfo.defaultBranch;
    }

    // recursive: "true" must be a STRING, not a boolean — quirk of this API
    const { data } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: targetBranch, // GitHub resolves branch names to their tip commit's tree
      recursive: "true",
    });

    // data.tree contains BOTH files ("blob") and folders ("tree")
    // We only want files
    const files = data.tree
      .filter((item) => item.type === "blob")
      .map((item) => ({
        path: item.path,
        size: item.size || 0,
        sha: item.sha,
      }));

    return {
      branch: targetBranch,
      totalFiles: files.length,
      truncated: data.truncated, // true only for VERY large repos
      files,
    };
  } catch (error) {
    throw handleGitHubError(error, owner, repo);
  }
};

/**
 * Fetches and decodes the content of ONE file.
 *
 * GitHub API endpoint: GET /repos/{owner}/{repo}/contents/{path}
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} filePath - e.g. "package.json" or "src/index.js" (NO leading slash)
 * @param {string} [branch]
 * @returns {Object} - { path, content (decoded text), size, sha }
 */
const getFileContent = async (owner, repo, filePath, branch) => {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch, // optional — which branch/commit to read from
    });

    // If the path points to a FOLDER, GitHub returns an ARRAY, not an object
    if (Array.isArray(data)) {
      throw new Error(`"${filePath}" is a directory, not a file`);
    }

    // Files over 1MB don't include "content" — GitHub gives a download_url instead.
    // We don't handle that case yet (it's rare for the files we care about).
    if (!data.content) {
      throw new Error(`"${filePath}" is too large to fetch directly (over 1MB)`);
    }

    // Decode: base64 string → raw bytes → readable UTF-8 text
    const decodedContent = Buffer.from(data.content, "base64").toString("utf-8");

    return {
      path: data.path,
      content: decodedContent,
      size: data.size,
      sha: data.sha,
    };
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`File not found: ${filePath}`);
    }
    // Re-throw our own custom errors (directory/too-large) as-is
    if (error.message.includes("directory") || error.message.includes("too large")) {
      throw error;
    }
    throw handleGitHubError(error, owner, repo);
  }
};

/**
 * Fetches MULTIPLE files at once. Files that don't exist are silently skipped
 * (this is intentional — we're CHECKING which manifest files exist).
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string[]} filePaths
 * @param {string} [branch]
 * @returns {Object} - { "package.json": "...content...", "Cargo.toml": "..." }
 *                      only includes keys for files that were FOUND
 */
const getMultipleFiles = async (owner, repo, filePaths, branch) => {
  const results = {};

  // For each path, try to fetch it. If it fails (doesn't exist), mark found:false.
  // Promise.all still waits for ALL of these — but none of them can "crash" the group
  // because each one catches its own errors internally.
  const promises = filePaths.map(async (filePath) => {
    try {
      const file = await getFileContent(owner, repo, filePath, branch);
      return { filePath, content: file.content, found: true };
    } catch {
      return { filePath, content: null, found: false };
    }
  });

  const settled = await Promise.all(promises);

  settled.forEach(({ filePath, content, found }) => {
    if (found) results[filePath] = content;
  });

  return results;
};

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMIT CHECK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks your current GitHub API rate limit.
 * Useful for debugging "am I being throttled?" issues.
 *
 * @returns {Object} - Rate limit info
 */
const getRateLimit = async () => {
  const { data } = await octokit.rateLimit.get();
  const core = data.resources.core;

  return {
    limit: core.limit,                        // total allowed per hour
    remaining: core.remaining,               // how many you have left
    used: core.limit - core.remaining,       // how many you've used
    resetAt: new Date(core.reset * 1000).toISOString(), // when it resets
    isLow: core.remaining < 100,             // warning flag
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts GitHub API errors into human-friendly messages.
 *
 * GitHub returns HTTP status codes:
 *   404 → repo not found (or private)
 *   401 → token is invalid
 *   403 → rate limit exceeded (or token lacks permissions)
 *   422 → invalid input (e.g. bad repo name)
 *
 * @param {Error} error - The raw error from Octokit
 * @param {string} owner
 * @param {string} repo
 * @returns {Error} - A new Error with a helpful message
 */
const handleGitHubError = (error, owner, repo) => {
  const status = error.status;

  if (status === 404) {
    return new Error(
      `Repository "${owner}/${repo}" not found. ` +
      `Check the URL or make sure it's a public repository.`
    );
  }

  if (status === 401) {
    return new Error(
      `GitHub token is invalid or expired. ` +
      `Please generate a new token at github.com/settings/tokens`
    );
  }

  if (status === 403) {
    if (error.message.includes("rate limit")) {
      return new Error(
        `GitHub API rate limit exceeded. ` +
        `Wait an hour, or check that your GITHUB_TOKEN is set correctly.`
      );
    }
    return new Error(
      `Access denied. Your token may not have the required permissions.`
    );
  }

  if (status === 422) {
    return new Error(
      `Invalid repository name. Please check the URL format.`
    );
  }

  // Unknown error — pass through the original message
  return new Error(`GitHub API error: ${error.message}`);
};

// Export all functions
module.exports = {
  getRepoInfo,
  getIssues,
  getContributors,
  getRateLimit,
  getRepoTree,        // ← NEW
  getFileContent,     // ← NEW
  getMultipleFiles,   // ← NEW
};
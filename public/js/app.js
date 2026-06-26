// public/js/app.js
//
// This file runs in the BROWSER (not Node.js).
// It talks to your Express backend using fetch().
// fetch() is the browser's built-in tool for making HTTP requests.
//
// Flow:
//   User types URL → clicks button → app.js calls /api/repo/info
//   → Express handles it → calls GitHub → returns data
//   → app.js receives data → updates the HTML

// ─── State ───────────────────────────────────────────────────────────────────
// This object stores the current data so different functions can share it.
const state = {
  repoUrl: "",
  repoInfo: null,
  issues: [],
  selectedIssue: null,
  repoProfile: null,
  contextPackage: null, // ← NEW: output of file retrieval (input for Day 5 prompt)
};

// ─── DOM References ───────────────────────────────────────────────────────────
// Get references to HTML elements once — faster than searching every time.
const elements = {
  repoUrlInput:  document.getElementById("repoUrlInput"),
  analyzeBtn:    document.getElementById("analyzeBtn"),
  inputError:    document.getElementById("inputError"),
  aiStatus:      document.getElementById("aiStatus"),
  issueSearch:   document.getElementById("issueSearch"),
  issueCount:    document.getElementById("issueCount"),
  // Sections (shown/hidden as stages complete)
  sectionRepo:    document.getElementById("section-repo"),
  sectionIssues:  document.getElementById("section-issues"),
  sectionAnalyze: document.getElementById("section-analyze"),
  sectionPrompt:  document.getElementById("section-prompt"),
  // Content areas
  repoInfo:       document.getElementById("repoInfo"),
  issuesList:     document.getElementById("issuesList"),
  // Stack analysis elements ← NEW
  analyzeLoading: document.getElementById("analyzeLoading"),
  analyzeContent: document.getElementById("analyzeContent"),
  languagesBadges: document.getElementById("languagesBadges"),
  projectTypeBadge: document.getElementById("projectTypeBadge"),
  frameworksBadges: document.getElementById("frameworksBadges"),
  indicatorsBadges: document.getElementById("indicatorsBadges"),
  keyFilesList: document.getElementById("keyFilesList"),
  folderStructure: document.getElementById("folderStructure"),
  totalFilesCount: document.getElementById("totalFilesCount"),
  // Relevant files elements ← NEW
  filesIdle:      document.getElementById("filesIdle"),
  filesLoading:   document.getElementById("filesLoading"),
  filesContent:   document.getElementById("filesContent"),
  filesError:     document.getElementById("filesError"),
  filesCount:     document.getElementById("filesCount"),
  keywordsBadges: document.getElementById("keywordsBadges"),
  scoredFilesList:document.getElementById("scoredFilesList"),
  contextStats:   document.getElementById("contextStats"),
};

// ─── Initialization ───────────────────────────────────────────────────────────
// Runs when the page first loads
document.addEventListener("DOMContentLoaded", () => {
  loadAIStatus();
  setupEventListeners();
});

// ─── Event Listeners ─────────────────────────────────────────────────────────
function setupEventListeners() {
  // Analyze button click
  elements.analyzeBtn.addEventListener("click", handleAnalyze);

  // Allow pressing Enter in the input field
  elements.repoUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAnalyze();
  });

  // Live search filter for issues
  elements.issueSearch.addEventListener("input", handleIssueSearch);
}

// ─── AI Status ────────────────────────────────────────────────────────────────
// Fetches and displays whether the app is in manual or automatic AI mode
async function loadAIStatus() {
  try {
    const response = await fetch("/api/repo/ai-status");
    const result = await response.json();

    if (result.success) {
      const { mode, provider } = result.data;
      const el = elements.aiStatus;

      if (mode === "manual") {
        el.textContent = "🤖 Manual Mode (Claude Chat)";
        el.className = "ai-status manual";
      } else {
        el.textContent = `✅ AI: ${provider}`;
        el.className = "ai-status automatic";
      }
    }
  } catch (error) {
    // Non-critical — don't break the app if this fails
    console.warn("Could not load AI status:", error);
  }
}

// ─── Main Analyze Flow ────────────────────────────────────────────────────────
async function handleAnalyze() {
  const url = elements.repoUrlInput.value.trim();

  // Validate input
  if (!url) {
    showError("Please enter a GitHub repository URL");
    return;
  }

  // Update UI state
  hideError();
  setLoading(true);
  

  try {

    hideAllSections();
    // Run both API calls in parallel (faster than sequential)
    // Promise.all waits for ALL promises to resolve
    const [repoResult, issuesResult] = await Promise.all([
      fetchRepoInfo(url),
      fetchIssues(url),
    ]);

    // Store in state
    state.repoUrl = url;
    state.repoInfo = repoResult;
    state.issues = issuesResult;

    // Render the UI
    renderRepoInfo(repoResult);
    renderIssues(issuesResult);

    // Show the sections
    show(elements.sectionRepo);
    show(elements.sectionIssues);
    show(elements.sectionAnalyze);
    show(elements.sectionFiles); 
    show(elements.sectionPrompt);

    // Update stage progress
    setStageActive(2);

    // ← NEW: kick off stack analysis (runs independently, shows its own loading state)
    loadStackAnalysis(url);

  } catch (error) {
    showError(error.message);
  } finally {
    // Always re-enable the button whether it succeeded or failed
    setLoading(false);
  }
}

// ─── API Calls ────────────────────────────────────────────────────────────────

async function fetchRepoInfo(repoUrl) {
  // fetch() is the browser's HTTP client
  // We're calling our own Express backend, not GitHub directly
  const response = await fetch("/api/repo/info", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // tells the server we're sending JSON
    },
    body: JSON.stringify({ repoUrl }),    // convert JS object to JSON string
  });

  // Parse the JSON response
  const result = await response.json();

  // Check if our API returned an error
  if (!result.success) {
    throw new Error(result.message);
  }

  return result.data;
}

async function fetchIssues(repoUrl) {
  const response = await fetch("/api/repo/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl, limit: 25 }),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message);
  }

  return result.data.issues;
}

// ─── Stack Analysis ────────────────────────────────────────────────────────

/**
 * Fetches the Repo Profile from /api/repo/analyze and renders it.
 * Runs separately from the main fetch because it's slower
 * (it has to fetch the entire file tree + manifest files).
 */
async function loadStackAnalysis(repoUrl) {
  // Reset to loading state
  show(elements.analyzeLoading);
  hide(elements.analyzeContent);
  elements.analyzeLoading.textContent = "Analyzing repository structure...";

  try {
    const response = await fetch("/api/repo/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    state.repoProfile = result.data;
    renderStackAnalysis(result.data);

    hide(elements.analyzeLoading);
    show(elements.analyzeContent);

  } catch (error) {
    elements.analyzeLoading.textContent = `Could not analyze stack: ${error.message}`;
  }
}

/**
 * Renders the Repo Profile object into the Stack Analysis card.
 */
function renderStackAnalysis(profile) {
  // ── Languages ─────────────────────────────────────────────────────────
  elements.languagesBadges.innerHTML = profile.languages.length > 0
    ? profile.languages.map(lang => `<span class="tech-badge lang">${lang}</span>`).join("")
    : `<span class="text-muted">No language manifest detected</span>`;

  // ── Project Type ──────────────────────────────────────────────────────
  elements.projectTypeBadge.innerHTML =
    `<span class="tech-badge type">${formatProjectType(profile.projectType)}</span>`;

  // ── Frameworks ────────────────────────────────────────────────────────
  elements.frameworksBadges.innerHTML = profile.frameworks.length > 0
    ? profile.frameworks.map(fw => `<span class="tech-badge ${fw.category}">${fw.name}</span>`).join("")
    : `<span class="text-muted">No frameworks detected from dependencies</span>`;

  // ── Indicators ────────────────────────────────────────────────────────
  const indicatorList = [
    { key: "hasCI",         label: "CI/CD" },
    { key: "hasDockerfile", label: "Docker" },
    { key: "hasTests",      label: "Tests" },
    { key: "hasDocs",       label: "Docs" },
  ];

  elements.indicatorsBadges.innerHTML = indicatorList.map(ind => {
    const present = profile.indicators[ind.key];
    return `<span class="indicator-badge ${present ? "yes" : "no"}">${present ? "✓" : "✗"} ${ind.label}</span>`;
  }).join("");

  // ── Key Files ─────────────────────────────────────────────────────────
  elements.keyFilesList.innerHTML = profile.keyFiles.length > 0
    ? profile.keyFiles.map(file => `<div class="key-file-item">${file}</div>`).join("")
    : `<span class="text-muted">No standard config files found at root</span>`;

  // ── Folder Structure ─────────────────────────────────────────────────
  elements.totalFilesCount.textContent = `(${profile.stats.totalFiles} files total${profile.stats.truncated ? ", truncated" : ""})`;

  const items = profile.folderStructure.slice(0, 30);
  const remainder = profile.folderStructure.length - items.length;

  elements.folderStructure.innerHTML = items.map(item => {
    const isFolder = item.endsWith("/");
    return `<span class="folder-item ${isFolder ? "is-folder" : ""}">${item}</span>`;
  }).join("") + (remainder > 0 ? `<span class="folder-item">+${remainder} more</span>` : "");
}

/**
 * Converts "fullstack-framework" → "Fullstack Framework"
 */
function formatProjectType(type) {
  return type
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ─── Render Functions ─────────────────────────────────────────────────────────

function renderRepoInfo(repo) {
  // formatNumber is defined below — converts 52000 → "52k"
  const starsFormatted = formatNumber(repo.stars);
  const forksFormatted = formatNumber(repo.forks);

  // Template literals let you embed variables directly in strings
  elements.repoInfo.innerHTML = `
    <img
      src="${repo.owner.avatar}"
      alt="${repo.owner.login}"
      class="repo-avatar"
    />
    <div class="repo-details">
      <div class="repo-name">
        <a href="${repo.url}" target="_blank" rel="noopener">
          ${repo.fullName}
        </a>
      </div>
      ${repo.description
        ? `<div class="repo-description">${escapeHtml(repo.description)}</div>`
        : ""}
      <div class="repo-stats">
        <div class="repo-stat">⭐ <strong>${starsFormatted}</strong> stars</div>
        <div class="repo-stat">🍴 <strong>${forksFormatted}</strong> forks</div>
        <div class="repo-stat">🐛 <strong>${repo.openIssues}</strong> open issues</div>
        ${repo.language
          ? `<div class="repo-stat">💻 <strong>${repo.language}</strong></div>`
          : ""}
        <div class="repo-stat">🌿 <strong>${repo.defaultBranch}</strong></div>
      </div>
      ${repo.topics.length > 0 ? `
        <div class="repo-topics">
          ${repo.topics.slice(0, 8).map(t => `
            <span class="topic-badge">${t}</span>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderIssues(issues) {
  // Update the count badge
  elements.issueCount.textContent = issues.length;

  if (issues.length === 0) {
    elements.issuesList.innerHTML = `
      <div style="color: var(--text-muted); text-align: center; padding: 32px;">
        No open issues found in this repository.
      </div>
    `;
    return;
  }

  // Render each issue
  elements.issuesList.innerHTML = issues.map(issue => `
    <div
      class="issue-item"
      data-number="${issue.number}"
      onclick="selectIssue(${issue.number})"
    >
      <div class="issue-header">
        <span class="issue-number">#${issue.number}</span>
        <span class="issue-title">${escapeHtml(issue.title)}</span>
      </div>
      ${issue.labels.length > 0 ? `
        <div class="issue-labels">
          ${issue.labels.map(label => `
            <span
              class="label-badge"
              style="
                background: #${label.color}22;
                border: 1px solid #${label.color}66;
                color: #${label.color};
              "
            >${label.name}</span>
          `).join("")}
        </div>
      ` : ""}
      ${issue.body ? `
        <div class="issue-body-preview">
          ${escapeHtml(truncate(issue.body, 150))}
        </div>
      ` : ""}
      <div class="issue-meta">
        <span>👤 ${issue.user.login}</span>
        <span>💬 ${issue.comments} comments</span>
        <span>🕐 ${timeAgo(issue.updatedAt)}</span>
      </div>
    </div>
  `).join("");
}

// ─── Issue Selection ─────────────────────────────────────────────────────────

function selectIssue(issueNumber) {
  const issue = state.issues.find((i) => i.number === issueNumber);
  if (!issue) return;

  state.selectedIssue = issue;

  // Visual: deselect all, highlight clicked one
  document.querySelectorAll(".issue-item").forEach((el) => {
    el.classList.remove("selected");
  });
  document.querySelector(`[data-number="${issueNumber}"]`)?.classList.add("selected");

  // Update stage indicator to Stage 3 (Files)
  setStageActive(3);

  // ← NEW: kick off relevant file loading
  loadRelevantFiles(issue, state.repoUrl);
}

// ─── Issue Search ─────────────────────────────────────────────────────────────

function handleIssueSearch(e) {
  const query = e.target.value.toLowerCase();

  // Filter the DOM elements — doesn't re-fetch from API
  document.querySelectorAll(".issue-item").forEach(el => {
    const title = el.querySelector(".issue-title").textContent.toLowerCase();
    const number = el.getAttribute("data-number");
    const visible = title.includes(query) || number.includes(query);
    el.style.display = visible ? "block" : "none";
  });
}

// ─── Example Filler ──────────────────────────────────────────────────────────

function fillExample(url) {
  elements.repoUrlInput.value = url;
  elements.repoUrlInput.focus();
}

// ─── Stage Progress ───────────────────────────────────────────────────────────

function setStageActive(stageNumber) {
  for (let i = 1; i <= 5; i++) {
    const stageEl = document.getElementById(`stage-${i}`);
    if (!stageEl) continue;

    stageEl.classList.remove("active", "completed");
    if (i < stageNumber) stageEl.classList.add("completed");
    if (i === stageNumber) stageEl.classList.add("active");
  }
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function setLoading(isLoading) {
  elements.analyzeBtn.disabled = isLoading;
  elements.analyzeBtn.querySelector(".btn-text").style.display =
    isLoading ? "none" : "inline";
  elements.analyzeBtn.querySelector(".btn-loading").style.display =
    isLoading ? "inline" : "none";
}

function showError(message) {
  elements.inputError.textContent = message;
  elements.inputError.style.display = "block";
}

function hideError() {
  elements.inputError.style.display = "none";
}

// FIXED (null-safe — if element doesn't exist, silently skips)
function show(element) {
  if (!element) {
    console.warn("show() called with null element — check your element IDs");
    return;
  }
  element.style.display = "block";
}

function hide(element) {
  if (!element) {
    console.warn("hide() called with null element — check your element IDs");
    return;
  }
  element.style.display = "none";
}
function hideAllSections() {
  hide(elements.sectionRepo);
  hide(elements.sectionIssues);
  hide(elements.sectionAnalyze);
  hide(elements.sectionFiles);
  hide(elements.sectionPrompt);
}

// ─── Utility Functions ────────────────────────────────────────────────────────

// Converts large numbers: 52000 → "52k"
function formatNumber(num) {
  if (!num) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}k`;
  return num.toLocaleString();
}

// Truncates long text: "Hello world this is..." → "Hello world..."
function truncate(text, maxLength = 150) {
  if (!text) return "";
  const clean = text.replace(/\n/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength) + "...";
}

// Converts ISO date to relative time: "2024-01-15T10:30:00Z" → "3 days ago"
function timeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// Escapes HTML special characters to prevent XSS attacks
// XSS = Cross-Site Scripting — when user input contains <script> tags
// If issue titles contain <script>, this function makes them harmless
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Relevant Files ──────────────────────────────────────────────────────────

/**
 * Fetches the context package for a selected issue and renders it.
 * Called automatically when the user clicks an issue.
 */
async function loadRelevantFiles(issue, repoUrl) {
  // Reset to loading state
  hide(elements.filesIdle);
  hide(elements.filesContent);
  hide(elements.filesError);
  show(elements.filesLoading);
  elements.filesLoading.textContent = `Finding files relevant to issue #${issue.number}...`;
  elements.filesCount.textContent = "0";

  try {
    const response = await fetch("/api/repo/relevant-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl, issue }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    state.contextPackage = result.data;
    renderRelevantFiles(result.data);

    hide(elements.filesLoading);
    show(elements.filesContent);
    elements.filesCount.textContent = result.data.stats.filesInContext;

  } catch (error) {
    hide(elements.filesLoading);
    elements.filesError.textContent = `Could not load relevant files: ${error.message}`;
    show(elements.filesError);
  }
}

/**
 * Renders the context package into the Relevant Files card.
 */
function renderRelevantFiles(pkg) {
  // ── Keywords ─────────────────────────────────────────────────────────────
  if (pkg.keywords.length === 0) {
    elements.keywordsBadges.innerHTML =
      `<span class="text-muted">No specific keywords extracted — issue may be too generic.</span>`;
  } else {
    // Show top 15 keywords. Title keywords (weight 1.5) get a special style.
    elements.keywordsBadges.innerHTML = pkg.keywords
      .slice(0, 15)
      .map(({ word, weight }) => {
        const isTitleKw = weight >= 1.5;
        return `<span class="keyword-badge ${isTitleKw ? "title-keyword" : ""}" title="weight: ${weight}">${word}</span>`;
      })
      .join("");
  }

  // ── Scored Files ──────────────────────────────────────────────────────────
  if (pkg.contextFiles.length === 0) {
    elements.scoredFilesList.innerHTML =
      `<div style="color: var(--text-muted); font-size: 13px; padding: 8px 0;">
        No relevant files found. The issue keywords didn't match any file paths.
        Try an issue with more specific technical terms.
      </div>`;
  } else {
    elements.scoredFilesList.innerHTML = pkg.contextFiles.map((file) => {
      const reasonStr = file.reasons.slice(0, 3).join(" · ");
      return `
        <div class="scored-file-item">
          <div class="scored-file-score">${file.score}</div>
          <div class="scored-file-info">
            <div class="scored-file-path" title="${file.path}">${file.path}</div>
            <div class="scored-file-reasons">${escapeHtml(reasonStr)}</div>
          </div>
          <div class="scored-file-tokens">
            ~${file.tokenEstimate.toLocaleString()} tokens
            ${file.wasTruncated ? `<br><span class="scored-file-truncated">truncated</span>` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  // ── Context Stats ─────────────────────────────────────────────────────────
  const s = pkg.stats;
  elements.contextStats.innerHTML = `
    <div class="context-stat">
      <strong>${s.filesInContext}</strong>
      <span>files in context</span>
    </div>
    <div class="context-stat">
      <strong>~${s.totalTokenEstimate.toLocaleString()}</strong>
      <span>estimated tokens</span>
    </div>
    <div class="context-stat">
      <strong>${s.filesScored}</strong>
      <span>files matched</span>
    </div>
    <div class="context-stat">
      <strong>${s.totalFilesInRepo.toLocaleString()}</strong>
      <span>total files in repo</span>
    </div>
  `;
}
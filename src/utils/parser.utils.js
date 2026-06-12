// src/utils/parser.utils.js
// "utils" = utilities = small helper functions used across the app.
// These functions don't know about Express, GitHub, or AI.
// They just do one simple thing reliably.

/**
 * Parses a GitHub URL and extracts the owner and repo name.
 *
 * Handles all these formats:
 *   https://github.com/facebook/react
 *   https://github.com/facebook/react/
 *   https://github.com/facebook/react/issues
 *   https://github.com/facebook/react/pulls/123
 *   github.com/facebook/react
 *   facebook/react
 *
 * @param {string} url - The GitHub URL to parse
 * @returns {{ owner: string, repo: string }} - The extracted owner and repo
 * @throws {Error} - If the URL format is not recognized
 */
const parseGitHubURL = (url) => {
  // Guard clause: if nothing was passed in, throw immediately
  if (!url || typeof url !== "string") {
    throw new Error("Please provide a valid GitHub URL");
  }

  // Remove leading/trailing whitespace (copy-paste often adds spaces)
  const trimmed = url.trim();

  // Remove trailing slash: "facebook/react/" → "facebook/react"
  const cleaned = trimmed.replace(/\/$/, "");

  // Strategy 1: Full GitHub URL
  // Matches: https://github.com/owner/repo or http://github.com/owner/repo
  const fullURLPattern = /^(?:https?:\/\/)?github\.com\/([^\/]+)\/([^\/]+)/;
  const fullMatch = cleaned.match(fullURLPattern);

  if (fullMatch) {
    return {
      owner: fullMatch[1],  // first capture group = owner
      repo: fullMatch[2],   // second capture group = repo
    };
  }

  // Strategy 2: Short "owner/repo" format
  // Matches: facebook/react
  const shortPattern = /^([^\/]+)\/([^\/]+)$/;
  const shortMatch = cleaned.match(shortPattern);

  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
    };
  }

  // Nothing matched — tell the user what format to use
  throw new Error(
    `Could not parse GitHub URL: "${url}". ` +
    `Please use format: https://github.com/owner/repo`
  );
};

/**
 * Formats a large number into a readable string.
 * Used for displaying star counts.
 *
 * Examples:
 *   1234    → "1,234"
 *   52000   → "52k"
 *   1200000 → "1.2M"
 *
 * @param {number} num
 * @returns {string}
 */
const formatNumber = (num) => {
  if (!num) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}k`;
  return num.toLocaleString();
};

/**
 * Truncates a long string and adds "..." at the end.
 * Used for previewing issue body text.
 *
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum characters to keep
 * @returns {string}
 */
const truncate = (text, maxLength = 200) => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
};

// Export all three functions so other files can import them
module.exports = { parseGitHubURL, formatNumber, truncate };
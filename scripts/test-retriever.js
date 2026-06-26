// scripts/test-retriever.js
//
// Standalone test for the file retriever.
// Run it from your project root like this:
//
//   node scripts/test-retriever.js expressjs/express 5462
//
// (Replace 5462 with any real open issue number from that repo)
//
// This fetches the real issue from GitHub, then runs the full
// relevance scoring pipeline, and prints the results.

require("dotenv").config();

const githubService = require("../src/services/github.service");
const fileRetriever = require("../src/services/fileRetriever.service");
const { parseGitHubURL } = require("../src/utils/parser.utils");

// ─── Parse arguments ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("Usage:");
  console.log("  node scripts/test-retriever.js <owner>/<repo> <issue-number>");
  console.log("  node scripts/test-retriever.js <owner> <repo> <issue-number>");
  console.log("");
  console.log("Examples:");
  console.log("  node scripts/test-retriever.js expressjs/express 5462");
  console.log("  node scripts/test-retriever.js axios axios 6000");
  process.exit(1);
}

let owner, repo, issueNumber;

if (args.length === 2 && args[0].includes("/")) {
  ({ owner, repo } = parseGitHubURL(args[0]));
  issueNumber = parseInt(args[1]);
} else if (args.length === 3) {
  owner = args[0];
  repo = args[1];
  issueNumber = parseInt(args[2]);
} else {
  console.error("Could not parse arguments. See usage above.");
  process.exit(1);
}

// ─── Main logic ───────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n📂 Repo:  ${owner}/${repo}`);
  console.log(`🐛 Issue: #${issueNumber}\n`);

  // Step 1: Fetch the real issue
  console.log("Fetching issue...");
  const issue = await githubService.getIssueByNumber(owner, repo, issueNumber);
  console.log(`Title: "${issue.title}"`);
  console.log(`Labels: ${issue.labels.map((l) => l.name).join(", ") || "none"}`);

  // Step 2: Extract and show keywords (for debugging)
  const { extractKeywords } = fileRetriever;
  const keywords = extractKeywords(issue);

  console.log("\n─── Extracted Keywords ───────────────────────────────");
  keywords.slice(0, 15).forEach(({ word, weight }) => {
    const source = weight === 1.5 ? "(title)" : weight === 0.8 ? "(label)" : "(body)";
    console.log(`  ${source.padEnd(8)} "${word}"`);
  });

  // Step 3: Run the full file retrieval
  console.log("\n─── Running File Relevance Scoring... ────────────────");
  const contextPackage = await fileRetriever.getRelevantFiles(owner, repo, issue);

  // Step 4: Show scored files
  console.log("\n─── Top 10 Scored Files ──────────────────────────────");
  contextPackage.allScoredFiles.slice(0, 10).forEach((file, i) => {
    const bar = "█".repeat(Math.min(20, Math.round(file.score / 5)));
    console.log(`  ${String(i + 1).padStart(2)}. [${String(file.score).padStart(3)}] ${bar}`);
    console.log(`      ${file.path}`);
    console.log(`      ${file.reasons.join(", ")}`);
  });

  // Step 5: Show context files (what will actually be sent to Claude)
  console.log("\n─── Context Files (sent to Claude) ───────────────────");
  contextPackage.contextFiles.forEach((file) => {
    const truncFlag = file.wasTruncated ? " [TRUNCATED]" : "";
    console.log(`  • ${file.path}`);
    console.log(`    Score: ${file.score} | ~${file.tokenEstimate} tokens${truncFlag}`);
  });

  // Step 6: Show stats
  console.log("\n─── Stats ────────────────────────────────────────────");
  const s = contextPackage.stats;
  console.log(`  Total files in repo:   ${s.totalFilesInRepo}`);
  console.log(`  Files scored:          ${s.filesScored}`);
  console.log(`  Files skipped:         ${s.filesSkipped}`);
  console.log(`  Files in context:      ${s.filesInContext}`);
  console.log(`  Total chars:           ${s.totalChars.toLocaleString()}`);
  console.log(`  Token estimate:        ~${s.totalTokenEstimate.toLocaleString()}`);
  console.log("");
}

run().catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});
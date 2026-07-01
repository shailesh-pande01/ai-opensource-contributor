// scripts/test-prompt.js
// Usage: node scripts/test-prompt.js expressjs/express 5432 analyze
// Modes: analyze | fix | pr

require("dotenv").config();

const githubService   = require("../src/services/github.service");
const stackDetector   = require("../src/services/stackDetector.service");
const fileRetriever   = require("../src/services/fileRetriever.service");
const promptGenerator = require("../src/services/promptGenerator.service");
const { parseGitHubURL } = require("../src/utils/parser.utils");

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: node scripts/test-prompt.js <owner/repo> <issue-number> [mode]");
  console.log("Modes: analyze (default) | fix | pr");
  process.exit(1);
}

const { owner, repo } = parseGitHubURL(args[0]);
const issueNumber = parseInt(args[1]);
const mode = args[2] || "analyze";

async function run() {
  console.log(`\n📂 ${owner}/${repo}  🐛 #${issueNumber}  🎯 mode: ${mode}\n`);

  console.log("1/4 Fetching issue...");
  const issue = await githubService.getIssueByNumber(owner, repo, issueNumber);

  console.log("2/4 Analyzing stack...");
  const repoProfile = await stackDetector.analyzeRepository(owner, repo);

  console.log("3/4 Retrieving relevant files...");
  const contextPackage = await fileRetriever.getRelevantFiles(owner, repo, issue);

  console.log("4/4 Generating prompt...\n");
  const result = promptGenerator.generatePrompt(mode, issue, repoProfile, contextPackage);

  console.log("─── PROMPT (" + result.stats.charCount.toLocaleString() + " chars, ~" + result.stats.tokenEstimate.toLocaleString() + " tokens) ───\n");
  console.log(result.prompt);

  if (result.stats.warning) {
    console.log("\n⚠️  WARNING:", result.stats.warning);
  }
}

run().catch((e) => { console.error("❌", e.message); process.exit(1); });
// scripts/test-analyze.js
//
// A standalone debugging tool. Run this from your terminal to test
// the stack detector WITHOUT going through the server or browser.
//
// Usage:
//   node scripts/test-analyze.js facebook/react
//   node scripts/test-analyze.js expressjs express

require("dotenv").config();
const stackDetector = require("../src/services/stackDetector.service");

const args = process.argv.slice(2);
// process.argv = ["node", "scripts/test-analyze.js", "facebook/react"]
// process.argv.slice(2) = ["facebook/react"]

if (args.length === 0) {
  console.log("Usage:");
  console.log("  node scripts/test-analyze.js <owner>/<repo>");
  console.log("  node scripts/test-analyze.js <owner> <repo>");
  process.exit(1);
}

let owner, repo;
if (args.length === 1 && args[0].includes("/")) {
  [owner, repo] = args[0].split("/");
} else {
  [owner, repo] = args;
}

console.log(`Analyzing ${owner}/${repo}...\n`);

stackDetector
  .analyzeRepository(owner, repo)
  .then((profile) => {
    console.log(JSON.stringify(profile, null, 2));
  })
  .catch((error) => {
    console.error("❌ Error:", error.message);
  });
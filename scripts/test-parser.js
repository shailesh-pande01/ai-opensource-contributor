// scripts/test-parser.js
// Usage: node scripts/test-parser.js

const { parseClaudeResponse } = require("../src/services/responseParser.service");

// Sample response matching the schema from Day 5
const SAMPLE = `
<analysis>
The issue is in the Router class where query parameters are dropped when using
nested routers. In lib/router/index.js, the mergeParams option is not being
correctly applied when the child router handles the request.
</analysis>

<affected_files>
lib/router/index.js
lib/router/route.js
</affected_files>

<code_changes>
FILE: lib/router/index.js
CHANGE: Fix mergeParams to properly carry query params into nested routers
\`\`\`javascript
// lib/router/index.js - fixed
var proto = module.exports = function(options) {
  var opts = options || {};
  function router(req, res, next) {
    router.handle(req, res, next);
  }
  router.mergeParams = opts.mergeParams;
  router.strict = opts.strict;
  router.stack = [];
  return router;
};
\`\`\`

FILE: lib/router/route.js
CHANGE: Respect merged params in dispatch
\`\`\`javascript
// lib/router/route.js - fixed dispatch
Route.prototype.dispatch = function dispatch(req, res, done) {
  var idx = 0;
  var stack = this.stack;
  if (stack.length === 0) return done();
  req.route = this;
  next();
  function next(err) {
    if (idx >= stack.length) return done(err);
    var layer = stack[idx++];
    layer.handle_request(req, res, next);
  }
};
\`\`\`
</code_changes>

<pr_description>
## Summary
Fixes query parameter forwarding in nested Express routers by correcting
the mergeParams implementation in the router layer.

## Changes Made
- Fixed mergeParams option handling in lib/router/index.js
- Updated dispatch function in lib/router/route.js

## How to Test
1. Create a parent router with \`?foo=bar\` in the URL
2. Mount a child router at a sub-path
3. Verify \`req.query.foo\` is accessible in the child router

## Related Issue
Closes #123
</pr_description>
`;

const result = parseClaudeResponse(SAMPLE);
console.log("\n─── PARSE RESULT ─────────────────────────────────────");
console.log("Found tags:      ", result.stats.foundTags.join(", "));
console.log("Files changed:   ", result.stats.totalFilesChanged);
console.log("Files with code: ", result.stats.filesWithCode);
console.log("\nAffected files:");
result.affectedFiles.forEach((f) => console.log("  •", f));
console.log("\nFile changes:");
result.fileChanges.forEach((f) => {
  console.log(`  • ${f.path} — ${f.charCount || 0} chars`);
  console.log(`    ${f.description}`);
});
console.log("\nAnalysis preview:");
console.log(" ", result.analysis?.substring(0, 120) + "...");
console.log("\nPR description preview:");
console.log(" ", result.prDescription?.substring(0, 120) + "...");
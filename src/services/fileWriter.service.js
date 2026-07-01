// src/services/fileWriter.service.js

const fs   = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(process.cwd(), "output");

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Writes parsed file changes to output/issue-{issueNumber}/
 * Preserves the original repo directory structure.
 *
 * @param {Object} parsedResponse - output of parseClaudeResponse()
 * @param {number} issueNumber
 * @returns {Object} write result
 */
const writeChanges = (parsedResponse, issueNumber) => {
  const issueDir = path.join(OUTPUT_DIR, `issue-${issueNumber}`);
  ensureDir(issueDir);

  const writtenFiles = [];
  const skippedFiles = [];

  for (const fileChange of parsedResponse.fileChanges) {
    if (!fileChange.hasCode || !fileChange.content) {
      skippedFiles.push({ path: fileChange.path, reason: "No code content extracted" });
      continue;
    }

    const outputFilePath = path.join(issueDir, fileChange.path);
    const outputFileDir  = path.dirname(outputFilePath);
    ensureDir(outputFileDir);

    fs.writeFileSync(outputFilePath, fileChange.content, "utf-8");

    writtenFiles.push({
      originalPath: fileChange.path,
      outputPath:   path.relative(process.cwd(), outputFilePath),
      description:  fileChange.description,
      size:         fileChange.content.length,
    });
  }

  // Write _summary.json alongside the files
  const summary = {
    issueNumber,
    generatedAt:   new Date().toISOString(),
    analysis:      parsedResponse.analysis      || null,
    prDescription: parsedResponse.prDescription || null,
    affectedFiles: parsedResponse.affectedFiles || [],
    writtenFiles,
    skippedFiles,
  };

  const summaryPath = path.join(issueDir, "_summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

  return {
    outputDir:    path.relative(process.cwd(), issueDir),
    writtenFiles,
    skippedFiles,
    summaryPath:  path.relative(process.cwd(), summaryPath),
    totalWritten: writtenFiles.length,
  };
};

module.exports = { writeChanges, OUTPUT_DIR };
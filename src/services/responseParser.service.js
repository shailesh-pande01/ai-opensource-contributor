// src/services/responseParser.service.js

/**
 * Extracts content between XML tags — handles multiline content.
 */
const extractTag = (text, tag) => {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = text.match(regex);
  if (!match) return null;
  return match[1].trim();
};

/**
 * Extracts all ```language ... ``` code blocks from a string.
 */
const extractCodeBlocks = (text) => {
  const blocks = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || "text",
      code: match[2].trim(),
    });
  }
  return blocks;
};

/**
 * Parses the <code_changes> section into individual file change objects.
 *
 * Expected format:
 *   FILE: path/to/file.js
 *   CHANGE: what changed and why
 *   ```javascript
 *   // full file content
 *   ```
 */
const parseFileChanges = (codeChangesText) => {
  if (!codeChangesText) return [];

  const fileChanges = [];

  // Split on FILE: markers — each chunk = one file
  const sections = codeChangesText.split(/(?=^FILE:)/m).filter((s) => s.trim());

  for (const section of sections) {
    const lines = section.split("\n");

    // First line after "FILE:" is the path
    const filePath = lines[0].replace(/^FILE:\s*/i, "").trim();
    if (!filePath) continue;

    // Find CHANGE: description line
    const changeLine = lines.find((l) => l.trim().toUpperCase().startsWith("CHANGE:"));
    const description = changeLine
      ? changeLine.replace(/^CHANGE:\s*/i, "").trim()
      : "";

    // Extract code blocks from the rest of the section
    const bodyText = lines.slice(1).join("\n");
    const codeBlocks = extractCodeBlocks(bodyText);

    if (codeBlocks.length === 0) {
      // Claude mentioned the file but gave no code — still record it
      fileChanges.push({ path: filePath, description, content: null, language: "", hasCode: false });
      continue;
    }

    fileChanges.push({
      path: filePath,
      description,
      content: codeBlocks[0].code,
      language: codeBlocks[0].language,
      hasCode: true,
      charCount: codeBlocks[0].code.length,
    });
  }

  return fileChanges;
};

/**
 * Main function — parses Claude's complete raw response into structured data.
 *
 * @param {string} rawResponse
 * @returns {Object} parsedResponse
 */
const parseClaudeResponse = (rawResponse) => {
  if (!rawResponse || typeof rawResponse !== "string") {
    throw new Error("Response must be a non-empty string.");
  }

  const text = rawResponse.trim();

  const analysis       = extractTag(text, "analysis");
  const affectedRaw    = extractTag(text, "affected_files");
  const codeChangesRaw = extractTag(text, "code_changes");
  const prDescription  = extractTag(text, "pr_description");

  const affectedFiles = affectedRaw
    ? affectedRaw.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    : [];

  const fileChanges = parseFileChanges(codeChangesRaw);

  const foundTags = [
    analysis       && "analysis",
    affectedRaw    && "affected_files",
    codeChangesRaw && "code_changes",
    prDescription  && "pr_description",
  ].filter(Boolean);

  if (foundTags.length === 0) {
    throw new Error(
      "No XML tags found. Make sure you copied Claude's COMPLETE response " +
      "including tags like <analysis>, <code_changes>, <pr_description>."
    );
  }

  return {
    analysis,
    affectedFiles,
    fileChanges,
    prDescription,
    stats: {
      foundTags,
      totalFilesChanged: fileChanges.length,
      filesWithCode:     fileChanges.filter((f) => f.hasCode).length,
      hasAnalysis:       !!analysis,
      hasCodeChanges:    !!codeChangesRaw,
      hasPRDescription:  !!prDescription,
    },
  };
};

module.exports = {
  parseClaudeResponse,
  extractTag,
  extractCodeBlocks,
  parseFileChanges,
};
// src/services/ai.service.js
//
// ═══════════════════════════════════════════════════════════════
//  ARCHITECTURE NOTE — READ THIS
// ═══════════════════════════════════════════════════════════════
//
// This file is the ONLY place in the project that talks to AI.
// All other files (controllers, routes, frontend) call this file.
// They never call an AI API directly.
//
// Currently: returns null → human pastes prompts into Claude Chat
//
// TO UPGRADE to an AI API, you only edit THIS file.
// Nothing else in the project needs to change.
//
// UPGRADE OPTIONS:
// ┌─────────────────┬──────────────────────────────────────────┐
// │ Claude API      │ npm install @anthropic-ai/sdk            │
// │                 │ Add ANTHROPIC_API_KEY to .env            │
// ├─────────────────┼──────────────────────────────────────────┤
// │ OpenAI API      │ npm install openai                       │
// │                 │ Add OPENAI_API_KEY to .env               │
// ├─────────────────┼──────────────────────────────────────────┤
// │ Gemini API      │ npm install @google/generative-ai        │
// │                 │ Add GEMINI_API_KEY to .env               │
// │                 │ Has free tier!                           │
// ├─────────────────┼──────────────────────────────────────────┤
// │ Ollama (local)  │ Install from ollama.com                  │
// │                 │ Run: ollama pull codellama               │
// │                 │ Completely free, runs offline            │
// └─────────────────┴──────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════

class AIService {

  constructor() {
    // Detect if any AI API key is configured
    // This will be used by the frontend to show/hide the "Auto" option
    this.provider = this._detectProvider();
  }

  /**
   * Checks which AI provider is configured (if any).
   * Reads from environment variables.
   * @returns {string} - "anthropic" | "openai" | "gemini" | "ollama" | "manual"
   */
  _detectProvider() {
    if (process.env.ANTHROPIC_API_KEY) return "anthropic";
    if (process.env.OPENAI_API_KEY) return "openai";
    if (process.env.GEMINI_API_KEY) return "gemini";
    if (process.env.OLLAMA_URL) return "ollama";
    return "manual"; // default: human-in-the-loop mode
  }

  /**
   * Returns true if an AI API is configured and can be called automatically.
   * Returns false if we're in manual (human-in-the-loop) mode.
   */
  isAvailable() {
    return this.provider !== "manual";
  }

  /**
   * Analyzes a GitHub issue.
   *
   * CURRENT BEHAVIOR: Returns null — user will paste prompt into Claude Chat.
   *
   * UPGRADE: Replace "return null" with your API call.
   * The prompt parameter contains everything Claude needs — just send it.
   *
   * @param {string} prompt - The fully assembled prompt from the prompt engine
   * @returns {Promise<string|null>} - AI response text, or null for manual mode
   */
  async analyzeIssue(prompt) {
    if (!this.isAvailable()) {
      // Manual mode: return null, UI will show copy/paste interface
      return null;
    }

    // ── UPGRADE POINT ──────────────────────────────────────────────────────
    // When you add an API, replace everything below this comment
    // with your API call. The prompt is already formatted correctly.
    //
    // Example (Claude API):
    //   const Anthropic = require("@anthropic-ai/sdk");
    //   const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    //   const response = await client.messages.create({
    //     model: "claude-opus-4-5",
    //     max_tokens: 4096,
    //     messages: [{ role: "user", content: prompt }]
    //   });
    //   return response.content[0].text;
    // ───────────────────────────────────────────────────────────────────────

    return null;
  }

  /**
   * Generates a code fix for an issue.
   * Same upgrade pattern as analyzeIssue.
   *
   * @param {string} prompt
   * @returns {Promise<string|null>}
   */
  async generateFix(prompt) {
    if (!this.isAvailable()) return null;
    // ── UPGRADE POINT ──
    return null;
  }

  /**
   * Generates a PR description from the analysis and code changes.
   *
   * @param {string} prompt
   * @returns {Promise<string|null>}
   */
  async generatePRDescription(prompt) {
    if (!this.isAvailable()) return null;
    // ── UPGRADE POINT ──
    return null;
  }

  /**
   * Returns info about the current AI configuration.
   * Used by the frontend to show the right UI mode.
   */
  getStatus() {
    return {
      provider: this.provider,
      isAvailable: this.isAvailable(),
      mode: this.isAvailable() ? "automatic" : "manual",
      message: this.isAvailable()
        ? `AI powered by ${this.provider}`
        : "Manual mode — paste prompts into Claude Chat",
    };
  }
}

// Export a single instance (singleton pattern)
// This means everywhere in the app uses the SAME AIService object
module.exports = new AIService();
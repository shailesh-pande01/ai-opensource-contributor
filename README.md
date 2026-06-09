# AI Open Source Contributor

An AI-powered agent that automatically contributes to GitHub repositories by analyzing issues and generating code fixes.

## Features
- Fetches open issues from any GitHub repository
- Analyzes repository structure and detects tech stack
- Uses AI to understand issues and generate fixes
- Automatically creates branches, commits, and Pull Requests

## Setup

1. Clone this repository
2. Install dependencies: npm install
3. Copy the environment template: cp .env.example.env
4. Fill in your API keys in `.env`
5. Start the development server: npm run dev

## API Endpoints

| Method | Endpoint  | Description           |
|--------|-----------|---------------------- |
| GET    | /health   | Server health check   |

## Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **AI:** Anthropic Claude API
- **GitHub:** Octokit REST client
require("dotenv").config();
const express = require("express");
const path = require("path");
const healthRoutes = require("./src/routes/health.routes");
const repoRoutes = require("./src/routes/repo.routes");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/health", healthRoutes);
app.use("/api/repo", repoRoutes);



const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("─────────────────────────────────────────");
  console.log(`  AI Contributor Server`);
  console.log(`  Status:      Running`);
  console.log(`  Port:        ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`  Health:      http://localhost:${PORT}/health`);
  console.log("─────────────────────────────────────────");
});

app.use((req, res) => {
  // If it's an API request, return JSON error
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: `API route ${req.originalUrl} not found`,
    });
  }
  // If it's a browser request, serve the frontend
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

module.exports = app;
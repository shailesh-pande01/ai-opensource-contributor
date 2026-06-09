require("dotenv").config();
const express = require("express");
const healthRoutes = require("./src/routes/health.routes");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/health", healthRoutes);



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
  res.status(404).json({
    status: "error",
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      "GET /health"
    ]
  });
});

module.exports = app;
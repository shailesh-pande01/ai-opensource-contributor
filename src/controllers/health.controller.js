const getHealth = (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "AI Contributor server is running perfectly",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development"
  });
};

module.exports = { getHealth };
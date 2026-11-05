let app;
let initError = null;

try {
  app = require("../server/server");
} catch (err) {
  initError = err;
  console.error("[vercel-entry] Failed to initialize Express app:", err);
}

module.exports = (req, res) => {
  if (initError || !app) {
    return res.status(500).json({
      error: `Server initialization error: ${initError ? initError.message : "Unknown error"}`,
    });
  }
  return app(req, res);
};

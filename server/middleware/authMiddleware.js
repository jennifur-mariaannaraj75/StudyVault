const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "notebooklm_super_secret_jwt_key_2026";

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.headers["x-auth-token"];

  if (!token) {
    // Attach default guest user for backward compatibility
    req.user = { id: "guest", name: "Guest Student", email: "guest@local", role: "user" };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired authorization token." });
  }
}

function requireAuth(req, res, next) {
  if (!req.user || req.user.id === "guest") {
    return res.status(401).json({ error: "Authentication required. Please log in." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin privileges required." });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  requireAuth,
  requireAdmin
};

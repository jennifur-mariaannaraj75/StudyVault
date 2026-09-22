const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const store = require("../config/store");
const { JWT_SECRET, authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      role: user.role || "user",
      avatar: user.avatar || ""
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const existingUser = await store.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const user = await store.createUser({
      name,
      email,
      password,
      role: "user",
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`
    });

    const token = createToken(user);
    res.status(201).json({
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error("[auth] Register error:", err);
    res.status(500).json({ error: err.message || "Failed to register user." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await store.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (!user.password) {
      return res.status(400).json({ error: "This account uses Google Sign-In. Please click 'Sign in with Google'." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = createToken(user);
    res.json({
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error("[auth] Login error:", err);
    res.status(500).json({ error: err.message || "Failed to log in." });
  }
});

// POST /api/auth/google
router.post("/google", async (req, res) => {
  try {
    const { credential, email, name, googleId, avatar } = req.body;
    let payload = { email, name, googleId, avatar };

    if (credential) {
      try {
        // Verify Google ID token using Google Token Info API
        const tokenRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (tokenRes.data && tokenRes.data.email) {
          payload = {
            email: tokenRes.data.email,
            name: tokenRes.data.name || tokenRes.data.email.split("@")[0],
            googleId: tokenRes.data.sub,
            avatar: tokenRes.data.picture || ""
          };
        }
      } catch (err) {
        console.warn("[auth] Google token verification fallback:", err.message);
      }
    }

    if (!payload.email) {
      return res.status(400).json({ error: "Google authentication failed. No valid email received." });
    }

    let user = await store.getUserByEmail(payload.email);
    if (!user) {
      user = await store.createUser({
        name: payload.name || "Student",
        email: payload.email,
        googleId: payload.googleId,
        avatar: payload.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(payload.email)}`,
        role: "user"
      });
    }

    const token = createToken(user);
    res.json({
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error("[auth] Google Auth error:", err);
    res.status(500).json({ error: err.message || "Google authentication failed." });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

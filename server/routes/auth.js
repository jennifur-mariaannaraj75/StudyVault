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
      plan: user.plan || (user.role === "admin" ? "pro" : "free"),
      status: user.status || "active",
      avatar: user.avatar || ""
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// GET /api/auth/config (Exposes public Google Client ID if set on server)
router.get("/config", (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || ""
  });
});

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
        plan: user.plan || "free",
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error("[auth] Register error:", err);
    res.status(500).json({ error: err.message || "Failed to register user." });
  }
});

// POST /api/auth/guest
router.post("/guest", async (req, res) => {
  try {
    const guestId = "guest_" + Math.random().toString(36).substring(2, 9);
    const user = {
      _id: guestId,
      id: guestId,
      name: "Guest",
      email: `${guestId}@studyvault.local`,
      role: "user",
      plan: "free",
      avatar: "🎓"
    };
    const token = createToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: "Failed to create guest session" });
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

    if (user.status === "disabled") {
      return res.status(403).json({ error: "Your account has been disabled by an administrator. Please contact support." });
    }

    if (!user.password) {
      return res.status(400).json({ error: "This account uses Google Sign-In. Please click 'Sign in with Google'." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.role === "admin") {
      store.createAuditLog({
        adminUser: { id: user._id || user.id, email: user.email, name: user.name },
        action: "admin_login",
        affectedEntity: "auth",
        metadata: { method: "password_login", ip: req.ip }
      }).catch(err => console.warn("[auth] Failed to record admin login audit:", err.message));
    }

    const token = createToken(user);
    res.json({
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan || (user.role === "admin" ? "pro" : "free"),
        status: user.status || "active",
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
        const tokenRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`, {
          timeout: 8000,
        });
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
        try {
          const parts = String(credential).split(".");
          if (parts.length >= 2) {
            const decoded = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
            if (decoded && decoded.email) {
              payload = {
                email: decoded.email,
                name: decoded.name || decoded.email.split("@")[0],
                googleId: decoded.sub || "",
                avatar: decoded.picture || ""
              };
            }
          }
        } catch (_) {}
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
        plan: user.plan || (user.role === "admin" ? "pro" : "free"),
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
  try {
    const planStatus = await store.getUserPlanStatus(req.user?.id, req.user?.role);
    res.json({
      user: {
        ...req.user,
        plan: planStatus.plan,
        planName: planStatus.planName
      },
      planStatus
    });
  } catch (err) {
    res.json({ user: req.user });
  }
});

// GET /api/auth/plan — Returns current user's subscription tier, limits, live daily usage, and plan catalog
router.get("/plan", authenticateToken, async (req, res) => {
  try {
    const planStatus = await store.getUserPlanStatus(req.user?.id, req.user?.role);
    const catalog = store.getPlansConfig();
    res.json({
      planStatus,
      catalog
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch subscription plan status." });
  }
});

// POST /api/auth/plan — Upgrade or switch subscription plan for the current user
router.post("/plan", authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;
    const cleanPlan = String(plan || "").toLowerCase();
    if (!["free", "plus", "pro"].includes(cleanPlan)) {
      return res.status(400).json({ error: "Invalid subscription plan. Choose free, plus, or pro." });
    }

    const userId = req.user?.id;
    if (!userId || userId === "guest" || String(userId).startsWith("guest_")) {
      return res.status(401).json({
        error: "Please create a free account or sign in before upgrading to Plus or Pro.",
        code: "AUTH_REQUIRED"
      });
    }

    const updatedUser = await store.updateUserPlan(userId, cleanPlan);
    if (!updatedUser || updatedUser.error) {
      return res.status(400).json({ error: updatedUser?.error || "User account not found." });
    }

    await store.createAuditLog({
      adminUser: { id: userId, email: updatedUser.email, name: updatedUser.name },
      action: "user_plan_switched",
      affectedEntity: `user:${updatedUser.email}`,
      metadata: { newPlan: cleanPlan }
    });

    const token = createToken(updatedUser);
    const planStatus = await store.getUserPlanStatus(userId, updatedUser.role);

    res.json({
      success: true,
      token,
      user: {
        id: updatedUser._id || updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        plan: updatedUser.plan,
        status: updatedUser.status || "active",
        avatar: updatedUser.avatar
      },
      planStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update subscription plan." });
  }
});

module.exports = router;

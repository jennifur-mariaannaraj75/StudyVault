const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const store = require("../config/store");

const router = express.Router();

function sanitizeString(str) {
  if (!str) return "";
  // Strip any passwords or credentials in URIs like mongodb+srv://user:pass@host
  return String(str)
    .replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+@/gi, "$1****@")
    .replace(/password[:=]\s*["']?[^"'&\s]+/gi, "password=****");
}

function getHostWithoutCredentials() {
  try {
    if (mongoose.connection && mongoose.connection.host) {
      return mongoose.connection.host;
    }
  } catch (_) {}
  return "unknown";
}

/**
 * GET /api/system/db-check
 * Diagnostic endpoint confirming actual database connection status and latency via User.findOne().
 * Never exposes credentials or sensitive user data.
 */
router.get("/db-check", async (req, res) => {
  const startTime = process.hrtime.bigint();

  const readyStates = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };

  const currentState = mongoose.connection ? mongoose.connection.readyState : 0;
  const isMongoConnected = currentState === 1;

  try {
    if (!isMongoConnected && !store.isMongoMode()) {
      // Local fallback mode: check in-memory/JSON store
      const localUsers = await store.getUsers();
      const endTime = process.hrtime.bigint();
      const latencyMs = Number(endTime - startTime) / 1e6;

      return res.status(200).json({
        success: true,
        status: "local_storage_connected",
        latencyMs: Math.round(latencyMs * 100) / 100,
        database: {
          type: "local_storage",
          connected: true,
          mode: "Zero-Config Local JSON",
          readyState: currentState,
          stateLabel: readyStates[currentState] || "unknown",
          file: "server/data/local_db.json"
        },
        modelCheck: {
          model: "User",
          operation: "findOne",
          success: true,
          userFound: localUsers && localUsers.length > 0
        },
        timestamp: new Date().toISOString()
      });
    }

    // Direct Mongoose User.findOne query
    const queryTimeout = 5000;
    const findPromise = User.findOne({}, { _id: 1, role: 1, status: 1 }).lean().exec();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database findOne operation timed out")), queryTimeout)
    );

    const user = await Promise.race([findPromise, timeoutPromise]);
    const endTime = process.hrtime.bigint();
    const latencyMs = Number(endTime - startTime) / 1e6;

    return res.status(200).json({
      success: true,
      status: "connected",
      latencyMs: Math.round(latencyMs * 100) / 100,
      database: {
        type: "mongodb",
        connected: true,
        readyState: currentState,
        stateLabel: readyStates[currentState] || "connected",
        host: getHostWithoutCredentials(),
        name: mongoose.connection.name || "studyvault"
      },
      modelCheck: {
        model: "User",
        operation: "findOne",
        success: true,
        userFound: Boolean(user),
        recordId: user ? String(user._id) : null
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const endTime = process.hrtime.bigint();
    const latencyMs = Number(endTime - startTime) / 1e6;

    const safeErrorMessage = sanitizeString(err.message || "Database check failed");

    return res.status(503).json({
      success: false,
      status: "disconnected",
      latencyMs: Math.round(latencyMs * 100) / 100,
      database: {
        type: store.isMongoMode() ? "mongodb" : "local_storage",
        connected: false,
        readyState: currentState,
        stateLabel: readyStates[currentState] || "disconnected"
      },
      modelCheck: {
        model: "User",
        operation: "findOne",
        success: false,
        error: safeErrorMessage
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;

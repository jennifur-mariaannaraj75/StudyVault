const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/notebooklm_clone";
  try {
    await mongoose.connect(uri);
    console.log("[db] MongoDB connected:", uri);
  } catch (err) {
    console.error("[db] MongoDB connection failed:", err.message);
    console.error("[db] Make sure MongoDB is running and MONGO_URI in .env is correct.");
    process.exit(1);
  }
}

module.exports = connectDB;

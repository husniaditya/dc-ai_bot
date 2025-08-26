const mongoose = require("mongoose");
require('dotenv').config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri, {
  serverSelectionTimeoutMS: 10000, // helps diagnose connection issues
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error:", err));

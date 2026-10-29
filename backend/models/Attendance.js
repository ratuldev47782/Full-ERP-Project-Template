// backend/models/Attendance.js

const mongoose = require('mongoose');

const s = new mongoose.Schema({
  userId: { type: String, required: true },
  timestamp: { type: Date, required: true },
  device: String,
});
s.index({ userId: 1, timestamp: 1, device: 1 }, { unique: true }); // একই পাঞ্চ দুইবার সেভ হবে না

module.exports = mongoose.model('Attendance', s);
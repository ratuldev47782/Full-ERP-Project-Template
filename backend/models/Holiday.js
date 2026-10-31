// backend/models/Holiday.js

const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // yyyy-mm-dd (Asia/Dhaka)
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Holiday', schema);
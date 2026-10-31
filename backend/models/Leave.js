// backend/models/Leave.js

const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true }, // yyyy-mm-dd (Asia/Dhaka)
    type: { type: String, enum: ['CL', 'SL', 'EL'], required: true },
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);
schema.index({ employee: 1, date: 1 }, { unique: true }); // ek din-e ekta-i leave

module.exports = mongoose.model('Leave', schema);
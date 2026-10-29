// backend/models/Employee.js

// backend/models/Employee.js

const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    joinDate: { type: Date },
    grade: { type: String, trim: true, default: '' },
    line: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    section: { type: String, trim: true, default: '' },
    subSection: { type: String, trim: true, default: '' },
    cardNo: { type: String, trim: true, default: '' },
    // ডিভাইসের User ID = Proximity Id (এটাই মূল ম্যাচিং কী)
    proximityId: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', schema);
// backend/models/DeviceUser.js

const mongoose = require('mongoose');
module.exports = mongoose.model('DeviceUser', new mongoose.Schema({
  userId: { type: String, unique: true },
  name: String,
}));

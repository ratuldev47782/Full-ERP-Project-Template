// backend/models/Setting.js
// Admin Settings (ekta-i document, key = 'main')

const mongoose = require('mongoose');

// Purono .env-er WEEKEND_DAYS thakle shetai prothom default hobe (backward compatible)
const envWeekend = () => {
  const v = String(process.env.WEEKEND_DAYS ?? '5')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return v.length ? v : [5];
};

const schema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    officeStart: { type: String, default: '07:30' },
    officeEnd: { type: String, default: '16:30' },
    lunchStart: { type: String, default: '12:00' },
    lunchEnd: { type: String, default: '13:00' },
    weekendDays: { type: [Number], default: envWeekend }, // 0=Sun ... 6=Sat
    companyName: { type: String, default: 'HKD Outdoor Innovations Ltd.' },
    companyAddress: { type: String, default: 'Plot # 45-50, Sector#2, KEPZ, Chittagong.' },
  },
  { timestamps: true }
);

schema.statics.current = async function () {
  let s = await this.findOne({ key: 'main' });
  if (!s) {
    try {
      s = await this.create({ key: 'main' });
    } catch {
      s = await this.findOne({ key: 'main' });
    }
  }
  return s;
};

module.exports = mongoose.model('Setting', schema);
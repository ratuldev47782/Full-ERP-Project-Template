// backend/models/model.js
// All database models and schemas in one file.

const mongoose = require('mongoose');

// ---- Attendance (raw device punch) ----
const attendanceSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  timestamp: { type: Date, required: true },
  device: String,
});
attendanceSchema.index({ userId: 1, timestamp: 1, device: 1 }, { unique: true }); // একই পাঞ্চ দুইবার সেভ হবে না
const Attendance = mongoose.model('Attendance', attendanceSchema);

// ---- DeviceUser ----
const DeviceUser = mongoose.model(
  'DeviceUser',
  new mongoose.Schema({
    userId: { type: String, unique: true },
    name: String,
  })
);

// ---- Employee ----
const employeeSchema = new mongoose.Schema(
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
const Employee = mongoose.model('Employee', employeeSchema);

// ---- Holiday ----
const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // yyyy-mm-dd (Asia/Dhaka)
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);
const Holiday = mongoose.model('Holiday', holidaySchema);

// ---- Leave ----
const leaveSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true }, // yyyy-mm-dd (Asia/Dhaka)
    type: { type: String, enum: ['CL', 'SL', 'EL'], required: true },
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);
leaveSchema.index({ employee: 1, date: 1 }, { unique: true }); // ek din-e ekta-i leave
const Leave = mongoose.model('Leave', leaveSchema);

// ---- Setting (Admin Settings, ekta-i document, key = 'main') ----
// Purono .env-er WEEKEND_DAYS thakle shetai prothom default hobe (backward compatible)
const envWeekend = () => {
  const v = String(process.env.WEEKEND_DAYS ?? '5')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return v.length ? v : [5];
};

const settingSchema = new mongoose.Schema(
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

settingSchema.statics.current = async function () {
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
const Setting = mongoose.model('Setting', settingSchema);

module.exports = { Attendance, DeviceUser, Employee, Holiday, Leave, Setting };

// backend/daily.js

const Attendance = require('./models/Attendance');
const Employee = require('./models/Employee');

// রেজিস্টার্ড কর্মীদের Proximity Id দিয়ে পাঞ্চ ম্যাচ করে হাজিরা
// প্রথম পাঞ্চ = IN, শেষ পাঞ্চ = OUT
async function dailyReport(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);

  const employees = await Employee.find().sort({ employeeId: 1 }).lean();
  const ids = employees.map((e) => e.proximityId);

  const logs = await Attendance.find({
    userId: { $in: ids },
    timestamp: { $gte: start, $lte: end },
  })
    .sort({ timestamp: 1 })
    .lean();

  const byUser = {};
  for (const l of logs) (byUser[l.userId] ||= []).push(l.timestamp);

  return employees.map((e) => {
    const times = byUser[e.proximityId] || [];
    const inTime = times[0] || null;
    const outTime = times.length > 1 ? times[times.length - 1] : null;

    return {
      _id: e._id,
      employeeId: e.employeeId,
      name: e.name,
      proximityId: e.proximityId,
      designation: e.designation,
      department: e.department,
      section: e.section,
      line: e.line,
      inTime,
      outTime,
      hours: outTime ? Number(((outTime - inTime) / 3600000).toFixed(2)) : null,
      punches: times.length,
      status: !times.length ? 'Absent' : outTime ? 'Present' : 'Missing Out',
    };
  });
}

module.exports = { dailyReport };
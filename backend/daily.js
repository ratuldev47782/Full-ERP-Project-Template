// backend/daily.js

const Attendance = require('./models/Attendance');
const Employee = require('./models/Employee');

const localDate = (d) => new Date(d).toLocaleDateString('en-CA'); // yyyy-mm-dd

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

// একজন কর্মীর মাসভিত্তিক হাজিরা (month = 'YYYY-MM')
async function monthlyReport(empId, month) {
  const emp = await Employee.findById(empId).lean();
  if (!emp) return null;

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1); // exclusive

  const logs = await Attendance.find({
    userId: emp.proximityId,
    timestamp: { $gte: start, $lt: end },
  })
    .sort({ timestamp: 1 })
    .lean();

  const byDay = {};
  for (const l of logs) (byDay[localDate(l.timestamp)] ||= []).push(l.timestamp);

  const todayStr = localDate(new Date());
  const summary = { present: 0, absent: 0, missingOut: 0, totalHours: 0 };
  const days = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const times = byDay[date] || [];
    const inTime = times[0] || null;
    const outTime = times.length > 1 ? times[times.length - 1] : null;
    const hours = outTime ? Number(((outTime - inTime) / 3600000).toFixed(2)) : null;

    let status = '';
    if (date <= todayStr) {
      status = !times.length ? 'Absent' : outTime ? 'Present' : 'Missing Out';
      if (status === 'Present') summary.present++;
      else if (status === 'Absent') summary.absent++;
      else summary.missingOut++;
    }
    if (hours) summary.totalHours += hours;

    days.push({ date, inTime, outTime, hours, punches: times.length, status });
  }
  summary.totalHours = Number(summary.totalHours.toFixed(2));

  return { employee: emp, summary, days };
}

module.exports = { dailyReport, monthlyReport };
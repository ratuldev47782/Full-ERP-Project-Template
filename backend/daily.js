// backend/daily.js

const Attendance = require('./models/Attendance');
const Employee = require('./models/Employee');

const localDate = (d) => new Date(d).toLocaleDateString('en-CA'); // yyyy-mm-dd (server local time)
const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null); // joinDate (date input) -> yyyy-mm-dd

// Weekend din (0=Sun ... 5=Fri, 6=Sat). .env-e WEEKEND_DAYS=5 (default Friday). Duto hole: WEEKEND_DAYS=5,6
const weekendDays = () =>
  String(process.env.WEEKEND_DAYS ?? '5')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n));

const isWeekendDate = (dateStr) => weekendDays().includes(new Date(`${dateStr}T00:00:00`).getDay());

// Ek din-er hisab: prothom punch = IN, shesh punch = OUT
// Status rule:
//   punch ache            -> Present (OUT ache) / Missing Out (shudhu 1 ta punch)
//   punch nai:
//     join date-er age    -> Not Joined
//     weekend             -> Weekend
//     ajker din ba ager   -> Absent
//     bhobishyot          -> '' (kichu dekhabe na)
function buildDay(date, times, joinStr, todayStr) {
  const inTime = times[0] || null;
  const outTime = times.length > 1 ? times[times.length - 1] : null;
  const hours = outTime ? Number(((outTime - inTime) / 3600000).toFixed(2)) : null;
  const isWeekend = isWeekendDate(date);

  let status = '';
  if (times.length) status = outTime ? 'Present' : 'Missing Out';
  else if (joinStr && date < joinStr) status = 'Not Joined';
  else if (isWeekend) status = 'Weekend';
  else if (date <= todayStr) status = 'Absent';

  return { date, inTime, outTime, hours, punches: times.length, status, isWeekend };
}

// রেজিস্টার্ড কর্মীদের Proximity Id দিয়ে পাঞ্চ ম্যাচ করে হাজিরা
async function dailyReport(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  const todayStr = localDate(new Date());

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
    const day = buildDay(dateStr, byUser[e.proximityId] || [], isoDate(e.joinDate), todayStr);
    return {
      _id: e._id,
      employeeId: e.employeeId,
      name: e.name,
      proximityId: e.proximityId,
      designation: e.designation,
      department: e.department,
      section: e.section,
      line: e.line,
      inTime: day.inTime,
      outTime: day.outTime,
      hours: day.hours,
      punches: day.punches,
      status: day.status,
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
  const joinStr = isoDate(emp.joinDate);
  const summary = { present: 0, absent: 0, missingOut: 0, weekend: 0, totalHours: 0 };
  const days = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const day = buildDay(date, byDay[date] || [], joinStr, todayStr);

    if (day.status === 'Present') summary.present++;
    else if (day.status === 'Absent') summary.absent++;
    else if (day.status === 'Missing Out') summary.missingOut++;
    else if (day.status === 'Weekend') summary.weekend++;
    if (day.hours) summary.totalHours += day.hours;

    days.push(day);
  }
  summary.totalHours = Number(summary.totalHours.toFixed(2));

  return { employee: emp, summary, days };
}

module.exports = { dailyReport, monthlyReport };
// backend/daily.js
// Daily + monthly attendance. Raw punch (Attendance) theke live hisab kora hoy,
// tai settings/holiday/leave change korle report sathe sathe thik thake (stale data hoy na).

const Attendance = require('./models/Attendance');
const Employee = require('./models/Employee');
const Holiday = require('./models/Holiday');
const Leave = require('./models/Leave');
const Setting = require('./models/Setting');
const {
  pad, dhakaDate, dayStart, dayEnd, dayOfWeek, monthInfo, computeWork, computeHolidayWork,
} = require('./calc');

const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null); // joinDate (date input) -> yyyy-mm-dd

// Ek din-er hisab: prothom punch = IN, shesh punch = OUT
// Status priority: Not Joined (punch nai) > Holiday > Leave (CL/SL/EL) > Present / Missing Out > Weekend > Absent
// Holiday/Leave-e punch thakle punch time preserve thake.
function buildDay(date, times, ctx) {
  const { settings, holiday, leave, joinStr, todayStr } = ctx;
  const inTime = times[0] || null;
  const outTime = times.length > 1 ? times[times.length - 1] : null;
  const isWeekend = settings.weekendDays.includes(dayOfWeek(date));
  const hasPunch = times.length > 0;

  let status = '';
  if (!hasPunch && joinStr && date < joinStr) status = 'Not Joined';
  else if (holiday) status = 'Holiday';
  else if (leave) status = leave.type;
  else if (hasPunch) status = outTime ? 'Present' : 'Missing Out';
  else if (isWeekend) status = 'Weekend';
  else if (date <= todayStr) status = 'Absent';

  const day = {
    date, inTime, outTime, effectiveIn: null, hours: null, punches: times.length, status, isWeekend,
    workedMinutes: 0, regularMinutes: 0, otActualMinutes: 0, otFinalMinutes: 0,
    holidayWork: null, holidayName: holiday ? holiday.name : null,
    leaveType: leave ? leave.type : null, leaveNote: leave ? leave.note || '' : '',
  };

  if (status === 'Present') {
    Object.assign(day, computeWork(date, inTime, outTime, settings));
    day.hours = Number((day.workedMinutes / 60).toFixed(2));
  } else if (status === 'Holiday' && outTime) {
    day.holidayWork = computeHolidayWork(date, inTime, outTime, settings);
  }
  return day;
}

const KEY = { Present: 'present', Absent: 'absent', 'Missing Out': 'missingOut', Weekend: 'weekend', Holiday: 'holiday', CL: 'cl', SL: 'sl', EL: 'el' };

function summarize(days, todayStr = dhakaDate(new Date())) {
  const s = {
    present: 0, absent: 0, missingOut: 0, weekend: 0, holiday: 0, cl: 0, sl: 0, el: 0,
    totalHours: 0, otActualMinutes: 0, otFinalMinutes: 0,
    holidayWorkMinutes: 0, holidayOtActualMinutes: 0, holidayOtFinalMinutes: 0,
    totalDays: 0, workingDays: 0,
  };
  for (const d of days) {
    if (d.date > todayStr) continue; // ajker por-er din hishebe dhora hoy na
    if (KEY[d.status]) s[KEY[d.status]]++;
    if (d.status && d.status !== 'Not Joined') {
      s.totalDays++;
      if (d.status !== 'Weekend' && d.status !== 'Holiday') s.workingDays++;
    }
    if (d.hours) s.totalHours += d.hours;
    s.otActualMinutes += d.otActualMinutes;
    s.otFinalMinutes += d.otFinalMinutes;
    if (d.holidayWork) {
      s.holidayWorkMinutes += d.holidayWork.workedMinutes;
      s.holidayOtActualMinutes += d.holidayWork.otActualMinutes;
      s.holidayOtFinalMinutes += d.holidayWork.otFinalMinutes;
    }
  }
  s.totalHours = Number(s.totalHours.toFixed(2));
  s.presentDays = s.present + s.missingOut;
  s.leave = s.cl + s.sl + s.el;
  s.holidayTotal = s.holiday + s.weekend; // time card-e weekend-o H
  s.otHours = s.otFinalMinutes / 60;
  s.holidayOtHours = s.holidayOtFinalMinutes / 60;
  return s;
}

// রেজিস্টার্ড কর্মীদের Proximity Id দিয়ে পাঞ্চ ম্যাচ করে হাজিরা
async function dailyReport(dateStr) {
  const todayStr = dhakaDate(new Date());
  const settings = (await Setting.current()).toObject();
  const holiday = await Holiday.findOne({ date: dateStr }).lean();
  const leaves = await Leave.find({ date: dateStr }).lean();
  const leaveBy = Object.fromEntries(leaves.map((l) => [String(l.employee), l]));

  const employees = await Employee.find().sort({ employeeId: 1 }).lean();
  const ids = employees.map((e) => e.proximityId);

  const logs = await Attendance.find({
    userId: { $in: ids },
    timestamp: { $gte: dayStart(dateStr), $lte: dayEnd(dateStr) },
  })
    .sort({ timestamp: 1 })
    .lean();

  const byUser = {};
  for (const l of logs) (byUser[l.userId] ||= []).push(l.timestamp);

  return employees.map((e) => {
    const day = buildDay(dateStr, byUser[e.proximityId] || [], {
      settings, holiday, leave: leaveBy[String(e._id)], joinStr: isoDate(e.joinDate), todayStr,
    });
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
      effectiveIn: day.effectiveIn,
      hours: day.hours,
      punches: day.punches,
      status: day.status,
      otActualMinutes: day.otActualMinutes,
      otFinalMinutes: day.otFinalMinutes,
      holidayWork: day.holidayWork,
      holidayName: day.holidayName,
    };
  });
}

// একজন কর্মীর মাসভিত্তিক হাজিরা (month = 'YYYY-MM')
async function monthlyReport(empId, month) {
  const emp = await Employee.findById(empId).lean();
  if (!emp) return null;

  const settings = (await Setting.current()).toObject();
  const { days: n, start, end } = monthInfo(month);
  const range = { $gte: `${month}-01`, $lte: `${month}-${pad(n)}` };

  const [logs, holidays, leaves] = await Promise.all([
    Attendance.find({ userId: emp.proximityId, timestamp: { $gte: start, $lt: end } }).sort({ timestamp: 1 }).lean(),
    Holiday.find({ date: range }).lean(),
    Leave.find({ employee: emp._id, date: range }).lean(),
  ]);

  const byDay = {};
  for (const l of logs) (byDay[dhakaDate(l.timestamp)] ||= []).push(l.timestamp);
  const holidayBy = Object.fromEntries(holidays.map((h) => [h.date, h]));
  const leaveBy = Object.fromEntries(leaves.map((l) => [l.date, l]));

  const todayStr = dhakaDate(new Date());
  const joinStr = isoDate(emp.joinDate);
  const days = [];
  for (let d = 1; d <= n; d++) {
    const date = `${month}-${pad(d)}`;
    days.push(
      buildDay(date, byDay[date] || [], {
        settings, holiday: holidayBy[date], leave: leaveBy[date], joinStr, todayStr,
      })
    );
  }

  return { employee: emp, month, summary: summarize(days, todayStr), days };
}

module.exports = { dailyReport, monthlyReport, buildDay, summarize };
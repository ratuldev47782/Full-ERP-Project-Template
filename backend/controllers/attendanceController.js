// backend/controllers/attendanceController.js
// Attendance calculation, daily/monthly reports and the monthly PDF time card.
// Timezone: Asia/Dhaka (UTC+6, DST nai). Raw punch kokhono change hoy na; ekhane shudhu hisab kora hoy.

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const { Attendance, AttendanceEdit, Employee, Holiday, Leave, Setting } = require('../models/model');

/* ================= calc ================= */

const TZ_OFFSET_MS = 6 * 3600000;
const MIN = 60000;
const OT_ROUND_MIN = 15; // default; Settings theke change kora jay (Setting.otRoundMin)

const pad = (n) => String(n).padStart(2, '0');
const shifted = (d) => new Date(new Date(d).getTime() + TZ_OFFSET_MS);

const dhakaDate = (d) => shifted(d).toISOString().slice(0, 10); // yyyy-mm-dd (Dhaka)
const dhakaTime = (d) => shifted(d).toISOString().slice(11, 19); // HH:MM:SS (Dhaka)
const dayStart = (s) => new Date(`${s}T00:00:00+06:00`);
const dayEnd = (s) => new Date(dayStart(s).getTime() + 86400000 - 1);
const dayOfWeek = (s) => new Date(`${s}T00:00:00Z`).getUTCDay(); // 0=Sun ... 6=Sat

const isValidDate = (s) =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const hhmmToMin = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};
const fmtHM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

function monthInfo(month) {
  const [y, m] = month.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return {
    days: new Date(Date.UTC(y, m, 0)).getUTCDate(),
    start: dayStart(`${month}-01`),
    end: dayStart(`${ny}-${pad(nm)}-01`), // exclusive
  };
}

const overlap = (aS, aE, bS, bE) => Math.max(0, Math.min(aE, bE) - Math.max(aS, bS));

// OT rounding (round = Setting.otRoundMin, default 15 min):
//   puri ghonta always count hoy; baki minute gulo tokhon-i porer ghontay uthbe
//   jokhon segulo porer ghontar theke round-min ba tar beshi (pachay) hoy.
//   round 15 hole: 1:45 -> 2h, kintu 1:44 -> 1h | 0:45 -> 1h, 0:44 -> 0h
const otRound = (s) => {
  const r = Number(s && s.otRoundMin);
  return Number.isInteger(r) && r >= 0 && r <= 59 ? r : OT_ROUND_MIN;
};

const roundOtMinutes = (actualMin, roundMin = OT_ROUND_MIN) => {
  const total = Math.max(0, Math.floor(Number(actualMin) || 0));
  const full = Math.floor(total / 60);
  const rest = total % 60;
  const bumped = rest > 0 && rest >= 60 - roundMin;
  return (bumped ? full + 1 : full) * 60;
};

// Normal working day (holiday-te present thakleo ekhoni hisab hoy).
//   effective in = MAX(actual in, office start)
//   lunch shudhu tokhon-i bad jay jokhon interval-er sathe overlap kore
//   OT = office end-er por theke (second ignore)
function computeWork(date, inTime, outTime, s) {
  const base = dayStart(date).getTime();
  const at = (hhmm) => Math.floor((base + hhmmToMin(hhmm) * MIN) / MIN);
  const startM = at(s.officeStart);
  const endM = at(s.officeEnd);
  const lsM = at(s.lunchStart);
  const leM = at(s.lunchEnd);

  const actualInM = Math.floor(new Date(inTime).getTime() / MIN);
  const outM = Math.floor(new Date(outTime).getTime() / MIN);
  const inM = Math.max(actualInM, startM);

  const lunch = overlap(inM, outM, lsM, leM);
  const workedMinutes = Math.max(0, outM - inM - lunch); // OT shoho
  const regEnd = Math.min(outM, endM);
  const regularMinutes = Math.max(0, regEnd - inM - overlap(inM, regEnd, lsM, leM));
  const otActualMinutes = Math.max(0, outM - Math.max(endM, inM));

  const startDate = new Date(base + hhmmToMin(s.officeStart) * MIN);
  return {
    effectiveIn: new Date(inTime) > startDate ? new Date(inTime) : startDate,
    workedMinutes,
    regularMinutes,
    otActualMinutes,
    otFinalMinutes: roundOtMinutes(otActualMinutes, otRound(s)),
  };
}

const settingsInfo = (s) => {
  const total = hhmmToMin(s.officeEnd) - hhmmToMin(s.officeStart);
  const lunch = hhmmToMin(s.lunchEnd) - hhmmToMin(s.lunchStart);
  return { totalOfficeMinutes: total, lunchMinutes: lunch, workingMinutes: total - lunch };
};

/* ================= daily + monthly attendance ================= */
// Raw punch (Attendance) theke live hisab kora hoy,
// tai settings/holiday/leave/edit change korle report sathe sathe thik thake (stale data hoy na).

const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null); // joinDate (date input) -> yyyy-mm-dd

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const atTime = (date, hhmm) => (HHMM_RE.test(String(hhmm || '')) ? new Date(`${date}T${hhmm}:00+06:00`) : null);

// Ek din-er hisab: prothom punch = IN, shesh punch = OUT
// Manual edit (AttendanceEdit) thakle oi din-er In/Out/OT override hoy; raw punch change hoy na.
// Manual OT dile: OT = oi value, ar Hours = regular hours + manual OT (duto-i ek shathe adjust hoy).
// Status priority: Not Joined (punch nai) > Holiday (punch na thakle) > Leave (CL/SL/EL) > Present / Missing Out > Weekend > Absent
// Holiday-te punch thakle ta general duty: Present / Missing Out hishebe normal-e count hoy (alada Holiday OT nai).
function buildDay(date, times, ctx) {
  const { settings, holiday, leave, joinStr, todayStr, edit } = ctx;
  const rawIn = times[0] || null;
  const rawOut = times.length > 1 ? times[times.length - 1] : null;
  const inTime = (edit && atTime(date, edit.inTime)) || rawIn;
  const outTime = (edit && atTime(date, edit.outTime)) || rawOut;
  const isWeekend = settings.weekendDays.includes(dayOfWeek(date));
  const hasPunch = times.length > 0 || Boolean(inTime);

  let status = '';
  if (!hasPunch && joinStr && date < joinStr) status = 'Not Joined';
  else if (holiday) status = hasPunch ? (outTime ? 'Present' : 'Missing Out') : 'Holiday';
  else if (leave) status = leave.type;
  else if (hasPunch) status = outTime ? 'Present' : 'Missing Out';
  else if (isWeekend) status = 'Weekend';
  else if (date <= todayStr) status = 'Absent';

  const day = {
    date, inTime, outTime, effectiveIn: null, hours: null, punches: times.length, status, isWeekend,
    workedMinutes: 0, regularMinutes: 0, otActualMinutes: 0, otFinalMinutes: 0,
    autoOtMinutes: 0, // auto hisab-er OT (manual override chhara)
    holidayName: holiday ? holiday.name : null,
    leaveType: leave ? leave.type : null, leaveNote: leave ? leave.note || '' : '',
    edited: Boolean(edit),
    manualOt: Boolean(edit && edit.otMinutes != null),
    edit: edit
      ? { inTime: edit.inTime || '', outTime: edit.outTime || '', otMinutes: edit.otMinutes ?? null, note: edit.note || '' }
      : null,
    rawIn,
    rawOut,
  };

  if (status === 'Present') {
    Object.assign(day, computeWork(date, inTime, outTime, settings));
    day.autoOtMinutes = day.otFinalMinutes;
    if (day.manualOt) {
      // Manual OT: OT ar Hours duto-i adjust
      day.otActualMinutes = edit.otMinutes;
      day.otFinalMinutes = edit.otMinutes;
      day.workedMinutes = day.regularMinutes + edit.otMinutes;
    }
    day.hours = Number((day.workedMinutes / 60).toFixed(2));
  }
  return day;
}

const KEY = { Present: 'present', Absent: 'absent', 'Missing Out': 'missingOut', Weekend: 'weekend', Holiday: 'holiday', CL: 'cl', SL: 'sl', EL: 'el' };

function summarize(days, todayStr = dhakaDate(new Date())) {
  const s = {
    present: 0, absent: 0, missingOut: 0, weekend: 0, holiday: 0, cl: 0, sl: 0, el: 0,
    totalHours: 0, otActualMinutes: 0, otFinalMinutes: 0,
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
  }
  s.totalHours = Number(s.totalHours.toFixed(2));
  s.presentDays = s.present + s.missingOut;
  s.leave = s.cl + s.sl + s.el;
  s.holidayTotal = s.holiday + s.weekend; // time card-e weekend-o H
  s.otHours = s.otFinalMinutes / 60;
  return s;
}

// রেজিস্টার্ড কর্মীদের Proximity Id দিয়ে পাঞ্চ ম্যাচ করে হাজিরা
async function dailyReport(dateStr) {
  const todayStr = dhakaDate(new Date());
  const settings = (await Setting.current()).toObject();
  const holiday = await Holiday.findOne({ date: dateStr }).lean();
  const leaves = await Leave.find({ date: dateStr }).lean();
  const leaveBy = Object.fromEntries(leaves.map((l) => [String(l.employee), l]));
  const edits = await AttendanceEdit.find({ date: dateStr }).lean();
  const editBy = Object.fromEntries(edits.map((x) => [String(x.employee), x]));

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
      edit: editBy[String(e._id)],
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
      holidayName: day.holidayName,
      edited: day.edited,
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

  const [logs, holidays, leaves, edits] = await Promise.all([
    Attendance.find({ userId: emp.proximityId, timestamp: { $gte: start, $lt: end } }).sort({ timestamp: 1 }).lean(),
    Holiday.find({ date: range }).lean(),
    Leave.find({ employee: emp._id, date: range }).lean(),
    AttendanceEdit.find({ employee: emp._id, date: range }).lean(),
  ]);

  const byDay = {};
  for (const l of logs) (byDay[dhakaDate(l.timestamp)] ||= []).push(l.timestamp);
  const holidayBy = Object.fromEntries(holidays.map((h) => [h.date, h]));
  const leaveBy = Object.fromEntries(leaves.map((l) => [l.date, l]));
  const editBy = Object.fromEntries(edits.map((x) => [x.date, x]));

  const todayStr = dhakaDate(new Date());
  const joinStr = isoDate(emp.joinDate);
  const days = [];
  for (let d = 1; d <= n; d++) {
    const date = `${month}-${pad(d)}`;
    days.push(
      buildDay(date, byDay[date] || [], {
        settings, holiday: holidayBy[date], leave: leaveBy[date], joinStr, todayStr, edit: editBy[date],
      })
    );
  }

  return { employee: emp, month, summary: summarize(days, todayStr), days };
}

/* ================= monthly PDF (A4, ek page) ================= */
// Logo: backend/assets/logo.png (ba .jpg) rakhle header-e boshbe.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map((m) => m.slice(0, 3));
const CODE = { Present: 'P', 'Missing Out': 'P', Absent: 'A', Weekend: 'H', Holiday: 'H', CL: 'CL', SL: 'SL', EL: 'EL', 'Not Joined': 'NJ' };
const LEAVE_NAME = { CL: 'Casual Leave', SL: 'Sick Leave', EL: 'Earned Leave' };

const shortDate = (s) => {
  const [y, m, d] = s.split('-');
  return `${d}-${MON[Number(m) - 1]}-${y.slice(2)}`;
};
const hms = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}:00`;

function printStamp() {
  const now = new Date();
  const t = dhakaTime(now);
  let h = Number(t.slice(0, 2));
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${dhakaDate(now)} ${pad(h)}:${t.slice(3, 5)} ${ap}`;
}

// Logo lookup order: LOGO_PATH env > frontend/public/HKD_LOGO.png > backend/assets/HKD_LOGO.png > backend/assets/logo.*
function findLogo() {
  const candidates = [
    process.env.LOGO_PATH,
    path.join(__dirname, '..', '..', 'frontend', 'public', 'HKD_LOGO.png'),
    path.join(__dirname, '..', 'assets', 'HKD_LOGO.png'),
    path.join(__dirname, '..', 'assets', 'logo.png'),
    path.join(__dirname, '..', 'assets', 'logo.jpg'),
    path.join(__dirname, '..', 'assets', 'logo.jpeg'),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function buildPdf(res, { report, settings, month }) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Time Card ${month}` } });
  doc.pipe(res);

  const W = 595.28;
  const L = 29;
  const R = W - 29;
  const CW = R - L;
  const [y, m] = month.split('-').map(Number);
  const emp = report.employee;
  const sum = report.summary;
  const todayStr = dhakaDate(new Date());

  // ---- Header ----
  const logo = findLogo();
  if (logo) {
    try {
      // Logo company name/address block-er thik bam pashe boshe (reference-er moto), aspect ratio thik rekhe
      const LOGO_H = 46;
      const img = doc.openImage(logo);
      const lw = img.width * (LOGO_H / img.height);
      const textW = Math.max(
        doc.font('Helvetica-Bold').fontSize(16).widthOfString(settings.companyName || ''),
        doc.font('Helvetica').fontSize(10).widthOfString(settings.companyAddress || '')
      );
      const lx = Math.max(L, (W - textW) / 2 - lw - 14);
      doc.image(logo, lx, 14, { width: lw, height: LOGO_H });
    } catch (e) {}
  }
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(16).text(settings.companyName, L, 16, { width: CW, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(10).text(settings.companyAddress, L, 36, { width: CW, align: 'center', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(8.5).text(`EMPLOYEE TIME CARD MONTH OF : (${MONTHS[m - 1]} - ${y} )`, L, 50, { width: CW, align: 'center', lineBreak: false });
  doc.lineWidth(1.2).strokeColor('#000').moveTo(L, 64).lineTo(R, 64).stroke();

  // ---- Employee info ----
  const joinDate = emp.joinDate ? new Date(emp.joinDate).toISOString().slice(0, 10) : '';
  const left = [['EMPLOYEE ID', emp.employeeId], ['NAME', emp.name], ['JOIN DATE', joinDate], ['GRADE', emp.grade], ['LINE', emp.line]];
  const right = [['DESIGNATION', emp.designation], ['DEPARTMENT', emp.department], ['SECTION', emp.section], ['SUB-SECTION', emp.subSection], ['CARD NO', emp.cardNo]];
  const infoY = 71;
  const rowI = 17;
  const put = (label, val, lx, vx, w, yy) => {
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(8.5).text(label, lx, yy, { width: vx - lx, lineBreak: false });
    doc.text(`: ${val || ''}`, vx, yy, { width: w, lineBreak: false, ellipsis: true });
  };
  left.forEach(([a, b], i) => put(a, b, L + 2, L + 119, 200, infoY + i * rowI));
  right.forEach(([a, b], i) => put(a, b, L + 298, L + 390, R - (L + 390), infoY + i * rowI));

  // ---- Table ----
  const cols = [
    ['DATE', 0.107], ['IN TIME', 0.118], ['OUT TIME', 0.15], ['OT HOURS', 0.175], ['STATUS', 0.17], ['SPECIAL STATUS', 0.28],
  ].map(([t, f]) => [t, f * CW]);
  const ty = infoY + 5 * rowI + 2;
  const hH = 18;
  const rH = 16.4;

  const cell = (x, yy, w, h, text, o = {}) => {
    if (o.fill) doc.save().rect(x, yy, w, h).fill(o.fill).restore();
    doc.lineWidth(0.7).strokeColor('#000').rect(x, yy, w, h).stroke();
    const size = o.size || 8;
    doc.fillColor('#000').font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
    doc.text(String(text ?? ''), x + 3, yy + (h - size) / 2 - 0.5, { width: w - 6, align: o.align || 'center', lineBreak: false, ellipsis: true });
  };

  let x = L;
  cols.forEach(([t, w]) => {
    cell(x, ty, w, hH, t, { bold: true, fill: '#d9d9d9', size: 8 });
    x += w;
  });

  let yy = ty + hH;
  // Pura mash-er shob din; ajker por-er din-gulo shudhu date, baki cell faka
  for (const d of report.days) {
    const blank = d.date > todayStr || d.status === '';
    if (blank) {
      const emptyVals = [shortDate(d.date), '', '', '', '', ''];
      x = L;
      cols.forEach(([, w], i) => {
        cell(x, yy, w, rH, emptyVals[i], { bold: i === 0, size: 8 });
        x += w;
      });
      yy += rH;
      continue;
    }

    const code = CODE[d.status] || '';

    // Special status: holiday name / leave name / missing check-out (weekend blank)
    let special = '';
    if (d.status === 'Holiday') special = d.holidayName || '';
    else if (d.holidayName) special = `${d.holidayName} (duty)`;
    else if (LEAVE_NAME[d.status]) special = LEAVE_NAME[d.status];
    else if (d.status === 'Missing Out') special = 'Missing check-out';

    const vals = [
      shortDate(d.date),
      d.inTime ? dhakaTime(d.inTime) : '00:00:00',
      d.outTime ? dhakaTime(d.outTime) : '00:00:00',
      hms(d.otFinalMinutes),
      code,
      special,
    ];
    x = L;
    cols.forEach(([, w], i) => {
      cell(x, yy, w, rH, vals[i], { bold: i !== 5, size: 8, align: i === 5 ? 'left' : 'center' });
      x += w;
    });
    yy += rH;
  }

  // Total OT (shudhu number, jemon 36)
  const otX = L + cols[0][1] + cols[1][1] + cols[2][1];
  cell(otX, yy, cols[3][1], rH, Number(sum.otHours.toFixed(2)), { bold: true, fill: '#d9d9d9', size: 8 });
  yy += rH + 8;

  // ---- Monthly summary (bottom right, 5 box) ----
  const sumCols = [
    ['Present', sum.presentDays], ['Absent', sum.absent], ['Holiday', sum.holidayTotal],
    ['Leave', sum.leave], ['Total Days', sum.totalDays],
  ];
  const sumW = 216;
  const sx0 = R - sumW;
  const sw = sumW / sumCols.length;
  doc.fillColor('#000').font('Helvetica').fontSize(8.5).text('Monthly Attendance Summary', sx0, yy, { width: sumW, align: 'center', lineBreak: false });
  yy += 13;
  sumCols.forEach(([t, v], i) => {
    cell(sx0 + i * sw, yy, sw, 16, t, { size: 7.5 });
    cell(sx0 + i * sw, yy + 16, sw, 18, v, { size: 8.5 });
  });

  // ---- Signatures (bottom left) ----
  const sigs = [['SIGNATURE OF EMPLOYEE', 733], ['SIGNATURE OF SV/OFFICER', 753]];
  sigs.forEach(([t, sy]) => {
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(8.5).text(t, L + 2, sy, { width: 150, lineBreak: false });
    doc.lineWidth(0.8).strokeColor('#000').moveTo(L + 152, sy + 9).lineTo(L + 295, sy + 9).stroke();
  });

  // ---- Footer ----
  doc.lineWidth(1).strokeColor('#000').moveTo(L, 806).lineTo(R, 806).stroke();
  doc.fillColor('#000').font('Helvetica').fontSize(8.5).text(`Print Date & Time: ${printStamp()}`, L, 812, { width: CW, align: 'right', lineBreak: false });

  doc.end();
}

/* ================= route handlers ================= */

const errText = (e) => e.message || String(e);

async function logs(req, res) {
  try {
    const { date, userId } = req.query;
    const q = {};
    if (date) q.timestamp = { $gte: dayStart(date), $lte: dayEnd(date) };
    if (userId) q.userId = userId;
    const list = await Attendance.find(q).sort({ timestamp: -1 }).limit(500).lean();
    const names = Object.fromEntries((await Employee.find().lean()).map((e) => [e.proximityId, e.name]));
    res.json(list.map((l) => ({ ...l, name: names[l.userId] || '' })));
  } catch (e) {
    res.status(500).json({ error: errText(e) });
  }
}

async function daily(req, res) {
  try {
    const date = req.query.date || dhakaDate(new Date());
    res.json(await dailyReport(date));
  } catch (e) {
    res.status(500).json({ error: errText(e) });
  }
}

async function monthly(req, res) {
  const { id } = req.params;
  const { month } = req.query;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid employee ID' });
  }
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: 'Month must be in YYYY-MM format' });
  }

  try {
    const report = await monthlyReport(id, month);
    if (!report) return res.status(404).json({ error: 'Employee not found' });
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: errText(e) });
  }
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

async function monthlyPdf(req, res) {
  const { id } = req.params;
  const { month } = req.query;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid employee ID' });
  if (typeof month !== 'string' || !MONTH.test(month)) return res.status(400).json({ error: 'Month must be in YYYY-MM format' });
  try {
    const report = await monthlyReport(id, month);
    if (!report) return res.status(404).json({ error: 'Employee not found' });
    const settings = (await Setting.current()).toObject();
    const file = `Attendance_${String(report.employee.employeeId).replace(/[^\w-]/g, '_')}_${month}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    buildPdf(res, { report, settings, month });
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: errText(e) });
  }
}

// PUT /employees/:id/attendance-edit  { date, inTime, outTime, otMinutes, note }
// Shob khali pathale override muche jay (device data-te ferot).
async function saveEdit(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw new Error('Invalid employee ID');
    const b = req.body || {};

    const date = String(b.date || '');
    if (!isValidDate(date)) throw new Error('Date is invalid');
    if (date > dhakaDate(new Date())) throw new Error('Future date cannot be edited');

    const inT = String(b.inTime || '').trim();
    const outT = String(b.outTime || '').trim();
    if (inT && !HHMM_RE.test(inT)) throw new Error('In time is invalid (HH:MM)');
    if (outT && !HHMM_RE.test(outT)) throw new Error('Out time is invalid (HH:MM)');

    let ot = null;
    if (b.otMinutes !== undefined && b.otMinutes !== null && b.otMinutes !== '') {
      ot = Number(b.otMinutes);
      if (!Number.isInteger(ot) || ot < 0 || ot > 1440) throw new Error('Overtime must be between 00:00 and 24:00');
    }
    const note = String(b.note || '').trim().slice(0, 200);

    const emp = await Employee.findById(id).lean();
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // Sob khali: override muche felo
    if (!inT && !outT && ot === null) {
      await AttendanceEdit.deleteOne({ employee: id, date });
      return res.json({ ok: true, removed: true });
    }

    const raw = await Attendance.find({
      userId: emp.proximityId,
      timestamp: { $gte: dayStart(date), $lte: dayEnd(date) },
    })
      .sort({ timestamp: 1 })
      .lean();

    const effIn = inT ? atTime(date, inT) : raw[0] ? raw[0].timestamp : null;
    const effOut = outT ? atTime(date, outT) : raw.length > 1 ? raw[raw.length - 1].timestamp : null;
    if (!effIn) throw new Error('No device punch on this day. Enter an In time.');
    if (effOut && new Date(effOut) <= new Date(effIn)) throw new Error('Out time must be after In time');
    if (ot !== null && !effOut) throw new Error('Overtime needs an Out time. Enter an Out time.');

    const saved = await AttendanceEdit.findOneAndUpdate(
      { employee: id, date },
      { $set: { inTime: inT, outTime: outT, otMinutes: ot, note } },
      { upsert: true, new: true }
    );
    res.json(saved);
  } catch (e) {
    res.status(400).json({ error: errText(e) });
  }
}

module.exports = {
  // calc
  OT_ROUND_MIN, pad, dhakaDate, dhakaTime, dayStart, dayEnd, dayOfWeek, isValidDate,
  hhmmToMin, fmtHM, monthInfo, roundOtMinutes, otRound, computeWork, settingsInfo,
  // reports
  dailyReport, monthlyReport, buildDay, summarize, buildPdf,
  // handlers
  logs, daily, monthly, monthlyPdf, saveEdit,
};
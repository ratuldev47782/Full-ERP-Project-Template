// backend/seeds/seedOct6450.js
// Run:  node seeds/seedOct6450.js        (from the backend folder)
//
// October 2026 test data for device (proximity) ID 6450.
// - raw punches go into Attendance (same shape as the device sync)
// - leaves go into Leave, one manual edit goes into AttendanceEdit
// - safe to re-run: it first deletes 6450's Oct data (punches / leaves / edits) and re-creates it
// - the random times are seeded, so every run gives the same data

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Attendance, AttendanceEdit, Employee, Holiday, Leave, Setting } = require('../models/model');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/attendance'; // <-- adjust if your env name differs
const DEVICE = process.env.ZK_IP || 'SEED';

const MONTH = '2026-10';
const PROX_ID = '6450';

// ---- Scenario ----
// No punch at all (=> Absent)
const ABSENT = ['2026-10-05', '2026-10-15', '2026-10-22', '2026-10-28'];
// Leave days (no punch)
const LEAVES = {
  '2026-10-07': ['CL', 'Casual leave'],
  '2026-10-13': ['SL', 'Sick leave'],
  '2026-10-14': ['SL', 'Sick leave'],
  '2026-10-26': ['EL', 'Earned leave'],
};
// Only one punch (=> Missing Out)
const MISSING_OUT = ['2026-10-19'];
// Public holiday (no punch). Adjust the date/name, or set to {} to skip. Only inserted if that date is free.
const HOLIDAYS = { '2026-10-20': 'Durga Puja (Vijaya Dashami)' };
// Manual edit example: out time forced + manual OT (minutes)
const EDIT = { date: '2026-10-08', inTime: '07:30', outTime: '19:00', otMinutes: 150, note: 'Seed: manual OT' };

// ---- helpers ----
const pad = (n) => String(n).padStart(2, '0');
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rnd = mulberry32(6450);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const mk = (date, h, m, s = ri(0, 59)) => new Date(`${date}T${pad(h)}:${pad(m)}:${pad(s)}+06:00`);
const dow = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

function punchesFor(date) {
  const list = [];
  // IN: mostly 07:10-07:29, sometimes late (07:31-07:55)
  const late = rnd() < 0.2;
  const inH = 7;
  const inM = late ? ri(31, 55) : ri(10, 29);
  list.push(mk(date, inH, inM));
  if (rnd() < 0.25) list.push(mk(date, inH, Math.min(59, inM + 1))); // double tap on arrival

  if (MISSING_OUT.includes(date)) return list;

  // lunch punches sometimes (first = IN, last = OUT, so the middle ones are ignored)
  if (rnd() < 0.3) list.push(mk(date, 12, ri(0, 10)));
  if (rnd() < 0.3) list.push(mk(date, 12, ri(50, 59)));

  // OUT: 65% on time (16:30-16:55), 35% overtime (17:20-19:50)
  let outH;
  let outM;
  if (rnd() < 0.65) { outH = 16; outM = ri(30, 55); }
  else { outH = ri(17, 19); outM = outH === 19 ? ri(0, 50) : ri(0, 59); }
  list.push(mk(date, outH, outM));
  if (rnd() < 0.15) list.push(mk(date, outH, Math.min(59, outM + 1))); // double tap on leaving
  return list;
}

(async () => {
  await mongoose.connect(MONGO_URI);
  const settings = (await Setting.current()).toObject();

  // Employee (create if device 6450 is not registered yet)
  let emp = await Employee.findOne({ proximityId: PROX_ID });
  if (!emp) {
    emp = await Employee.create({
      employeeId: `SEED-${PROX_ID}`,
      name: 'Test Employee 6450',
      joinDate: new Date('2026-01-01T00:00:00Z'),
      grade: 'G-5',
      line: 'Line-1',
      designation: 'Operator',
      department: 'Production',
      section: 'Sewing',
      subSection: 'Sewing-A',
      cardNo: PROX_ID,
      proximityId: PROX_ID,
    });
    console.log(`Employee created: ${emp.employeeId}`);
  } else {
    console.log(`Using existing employee: ${emp.employeeId} - ${emp.name}`);
  }

  // Clean old Oct data for this employee/device
  const from = new Date(`${MONTH}-01T00:00:00+06:00`);
  const to = new Date(`2026-11-01T00:00:00+06:00`);
  const dateRange = { $gte: `${MONTH}-01`, $lte: `${MONTH}-31` };
  const del = await Promise.all([
    Attendance.deleteMany({ userId: PROX_ID, timestamp: { $gte: from, $lt: to } }),
    Leave.deleteMany({ employee: emp._id, date: dateRange }),
    AttendanceEdit.deleteMany({ employee: emp._id, date: dateRange }),
  ]);
  console.log(`Cleared old Oct data: ${del[0].deletedCount} punches, ${del[1].deletedCount} leaves, ${del[2].deletedCount} edits`);

  // Holidays (keep existing ones untouched)
  for (const [date, name] of Object.entries(HOLIDAYS)) {
    const r = await Holiday.updateOne({ date }, { $setOnInsert: { date, name } }, { upsert: true });
    console.log(r.upsertedCount ? `Holiday added: ${date} ${name}` : `Holiday already exists: ${date}`);
  }
  const holidayDates = new Set((await Holiday.find({ date: dateRange }).lean()).map((h) => h.date));

  // Leaves
  const leaveDocs = Object.entries(LEAVES).map(([date, [type, note]]) => ({ employee: emp._id, date, type, note }));
  if (leaveDocs.length) await Leave.insertMany(leaveDocs);

  // Punches
  const punches = [];
  const stat = { worked: 0, weekend: 0, holiday: 0, leave: 0, absent: 0, missingOut: 0 };
  for (let d = 1; d <= 31; d++) {
    const date = `${MONTH}-${pad(d)}`;
    if (settings.weekendDays.includes(dow(date))) { stat.weekend++; continue; }
    if (holidayDates.has(date)) { stat.holiday++; continue; }
    if (LEAVES[date]) { stat.leave++; continue; }
    if (ABSENT.includes(date)) { stat.absent++; continue; }
    for (const t of punchesFor(date)) punches.push({ userId: PROX_ID, timestamp: t, device: DEVICE });
    if (MISSING_OUT.includes(date)) stat.missingOut++; else stat.worked++;
  }
  await Attendance.insertMany(punches, { ordered: false });

  // Manual edit example
  if (EDIT) {
    await AttendanceEdit.create({
      employee: emp._id,
      date: EDIT.date,
      inTime: EDIT.inTime,
      outTime: EDIT.outTime,
      otMinutes: EDIT.otMinutes,
      note: EDIT.note,
    });
  }

  console.log(`Inserted ${punches.length} punches for device ${PROX_ID}`);
  console.log('Days:', stat);
  console.log('Absent (no log):', ABSENT.join(', '));
  console.log('Leave:', Object.entries(LEAVES).map(([k, v]) => `${k}=${v[0]}`).join(', '));
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error('Seed failed:', e.message || e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
// backend/controllers/adminController.js
// Settings, Holidays and Leaves (CL / SL / EL).

const mongoose = require('mongoose');
const { Employee, Holiday, Leave, Setting } = require('../models/model');
const { isValidDate, dayOfWeek, hhmmToMin, settingsInfo, dhakaDate } = require('./attendanceController');

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const LEAVE_TYPES = ['CL', 'SL', 'EL'];
const errText = (e) => e.message || String(e);

/* ================= Settings ================= */

const withInfo = (s) => ({ ...s, ...settingsInfo(s) });

async function getSettings(req, res) {
  try {
    res.json(withInfo((await Setting.current()).toObject()));
  } catch (e) {
    res.status(500).json({ error: errText(e) });
  }
}

async function updateSettings(req, res) {
  try {
    const b = req.body || {};
    const data = {};
    const labels = { officeStart: 'Office Start', officeEnd: 'Office End', lunchStart: 'Lunch Start', lunchEnd: 'Lunch End' };
    for (const k of Object.keys(labels)) {
      if (!HHMM.test(String(b[k] || ''))) throw new Error(`${labels[k]} time is invalid (HH:MM)`);
      data[k] = b[k];
    }
    const os = hhmmToMin(data.officeStart);
    const oe = hhmmToMin(data.officeEnd);
    const ls = hhmmToMin(data.lunchStart);
    const le = hhmmToMin(data.lunchEnd);
    if (os >= oe) throw new Error('Office End must be after Office Start');
    if (ls >= le) throw new Error('Lunch End must be after Lunch Start');
    if (ls < os || le > oe) throw new Error('Lunch time must be within office hours');

    if (!Array.isArray(b.weekendDays)) throw new Error('Weekend days are invalid');
    const wd = [...new Set(b.weekendDays.map(Number))];
    if (wd.some((n) => !Number.isInteger(n) || n < 0 || n > 6)) throw new Error('Weekend days are invalid');
    data.weekendDays = wd.sort();

    if (typeof b.companyName === 'string' && b.companyName.trim()) data.companyName = b.companyName.trim();
    if (typeof b.companyAddress === 'string') data.companyAddress = b.companyAddress.trim();

    await Setting.current(); // ensure exists
    const s = await Setting.findOneAndUpdate({ key: 'main' }, { $set: data }, { new: true });
    res.json(withInfo(s.toObject()));
  } catch (e) {
    res.status(400).json({ error: errText(e) });
  }
}

/* ================= Holidays ================= */

const holidayBody = (b) => {
  const date = String(b.date || '');
  const name = String(b.name || '').trim();
  if (!isValidDate(date)) throw new Error('Holiday date is invalid');
  if (!name) throw new Error('Holiday name is required');
  if (name.length > 100) throw new Error('Holiday name is too long');
  return { date, name };
};
const holidayErr = (e) => (e.code === 11000 ? 'A holiday is already configured for this date' : errText(e));

async function listHolidays(req, res) {
  try {
    const y = /^\d{4}$/.test(String(req.query.year || '')) ? req.query.year : dhakaDate(new Date()).slice(0, 4);
    res.json(await Holiday.find({ date: { $gte: `${y}-01-01`, $lte: `${y}-12-31` } }).sort({ date: 1 }).lean());
  } catch (e) {
    res.status(500).json({ error: errText(e) });
  }
}

async function createHoliday(req, res) {
  try {
    const data = holidayBody(req.body || {});
    const h = await Holiday.create(data);
    const conflictingLeaves = await Leave.countDocuments({ date: data.date });
    res.status(201).json({ ...h.toObject(), conflictingLeaves });
  } catch (e) {
    res.status(400).json({ error: holidayErr(e) });
  }
}

async function updateHoliday(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new Error('Invalid holiday ID');
    const data = holidayBody(req.body || {});
    const h = await Holiday.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!h) return res.status(404).json({ error: 'Holiday not found' });
    res.json(h);
  } catch (e) {
    res.status(400).json({ error: holidayErr(e) });
  }
}

async function deleteHoliday(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new Error('Invalid holiday ID');
    await Holiday.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: errText(e) });
  }
}

/* ================= Leaves (CL / SL / EL) ================= */

async function checkLeave({ employee, date, type }, selfId) {
  if (!mongoose.isValidObjectId(employee)) throw new Error('Select an employee first');
  if (!isValidDate(date)) throw new Error('Select a valid date');
  if (!LEAVE_TYPES.includes(type)) throw new Error('Leave type must be CL, SL or EL');
  if (!(await Employee.exists({ _id: employee }))) throw new Error('Employee not found');
  const hol = await Holiday.findOne({ date }).lean();
  if (hol) throw new Error(`This date is a holiday (${hol.name}). Leave cannot be assigned on a holiday.`);
  const s = await Setting.current();
  if (s.weekendDays.includes(dayOfWeek(date))) throw new Error('This date is a weekend. Leave cannot be assigned on a weekend.');
  const dup = await Leave.findOne({ employee, date, ...(selfId && { _id: { $ne: selfId } }) }).lean();
  if (dup) throw new Error('A leave is already assigned to this employee on this date');
}
const leaveErr = (e) => (e.code === 11000 ? 'A leave is already assigned to this employee on this date' : errText(e));

async function listLeaves(req, res) {
  try {
    const q = {};
    if (mongoose.isValidObjectId(req.query.employee)) q.employee = req.query.employee;
    if (MONTH.test(String(req.query.month || ''))) q.date = { $gte: `${req.query.month}-01`, $lte: `${req.query.month}-31` };
    const list = await Leave.find(q).populate('employee').sort({ date: -1 }).limit(500).lean();
    res.json(list.filter((l) => l.employee)); // delete kora employee-er leave bad
  } catch (e) {
    res.status(500).json({ error: errText(e) });
  }
}

async function createLeave(req, res) {
  try {
    const { employee, date, type, note } = req.body || {};
    await checkLeave({ employee, date, type });
    res.status(201).json(await Leave.create({ employee, date, type, note: String(note || '').slice(0, 200) }));
  } catch (e) {
    res.status(400).json({ error: leaveErr(e) });
  }
}

async function updateLeave(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new Error('Invalid leave ID');
    const old = await Leave.findById(req.params.id);
    if (!old) return res.status(404).json({ error: 'Leave not found' });
    const b = req.body || {};
    const next = { employee: String(old.employee), date: b.date ?? old.date, type: b.type ?? old.type };
    await checkLeave(next, old._id);
    old.date = next.date;
    old.type = next.type;
    if (b.note !== undefined) old.note = String(b.note || '').slice(0, 200);
    await old.save();
    res.json(old);
  } catch (e) {
    res.status(400).json({ error: leaveErr(e) });
  }
}

async function deleteLeave(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new Error('Invalid leave ID');
    await Leave.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: errText(e) });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  listLeaves,
  createLeave,
  updateLeave,
  deleteLeave,
};

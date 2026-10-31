// backend/controllers/employeeController.js
// Employee register / list / update / delete and employee search.

const { Employee } = require('../models/model');

const dupMsg = (e) =>
  e.code === 11000
    ? `${Object.keys(e.keyPattern || {})[0] === 'proximityId' ? 'Proximity ID' : 'Employee ID'} already exists`
    : e.message || String(e);

const errText = (e) => e.message || String(e);

async function list(req, res) {
  try {
    res.json(await Employee.find().sort({ employeeId: 1 }).lean());
  } catch (e) {
    res.status(500).json({ error: errText(e) });
  }
}

async function create(req, res) {
  try {
    const emp = await Employee.create(req.body);
    res.status(201).json(emp);
  } catch (e) {
    res.status(400).json({ error: dupMsg(e) });
  }
}

async function update(req, res) {
  try {
    const emp = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json(emp);
  } catch (e) {
    res.status(400).json({ error: dupMsg(e) });
  }
}

async function remove(req, res) {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: errText(e) });
  }
}

// Employee ID / Proximity ID / Name diye search
async function search(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    res.json(
      await Employee.find({ $or: [{ employeeId: rx }, { proximityId: rx }, { name: rx }] })
        .sort({ employeeId: 1 })
        .limit(15)
        .lean()
    );
  } catch (e) {
    res.status(500).json({ error: errText(e) });
  }
}

module.exports = { list, create, update, remove, search };

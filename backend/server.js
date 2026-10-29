// backend/server.js

require('dotenv').config();
process.on('uncaughtException', (e) => console.log('Guarded error:', e.message));
process.on('unhandledRejection', (e) => console.log('Guarded rejection:', (e && e.message) || e));

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cron = require('node-cron');
const Attendance = require('./models/Attendance');
const Employee = require('./models/Employee');
const { getInfo, syncDevice } = require('./zk');
const { dailyReport } = require('./daily');

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((e) => {
    console.error('MongoDB error:', e.message);
    process.exit(1);
  });

// ---- Login ----
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Incorrect username or password' });
});

const auth = (req, res, next) => {
  try {
    jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ---- Device ----
app.get('/api/status', auth, async (req, res) => {
  try {
    const info = await getInfo();
    res.json({ connected: true, ip: process.env.ZK_IP, port: process.env.ZK_PORT, info });
  } catch (e) {
    res.json({ connected: false, ip: process.env.ZK_IP, port: process.env.ZK_PORT, error: e.message || String(e) });
  }
});

// one sync at a time (shared by cron and manual button)
let syncing = false;

app.post('/api/sync', auth, async (req, res) => {
  if (syncing) return res.status(409).json({ error: 'Sync already running, try again shortly' });
  syncing = true;
  try {
    res.json(await syncDevice());
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  } finally {
    syncing = false;
  }
});

// ---- Data ----
app.get('/api/logs', auth, async (req, res) => {
  try {
    const { date, userId } = req.query;
    const q = {};
    if (date) q.timestamp = { $gte: new Date(`${date}T00:00:00`), $lte: new Date(`${date}T23:59:59.999`) };
    if (userId) q.userId = userId;
    const logs = await Attendance.find(q).sort({ timestamp: -1 }).limit(500).lean();
    const names = Object.fromEntries((await Employee.find().lean()).map((e) => [e.proximityId, e.name]));
    res.json(logs.map((l) => ({ ...l, name: names[l.userId] || '' })));
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.get('/api/daily', auth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toLocaleDateString('en-CA');
    res.json(await dailyReport(date));
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// ---- Employees ----
const dupMsg = (e) =>
  e.code === 11000
    ? `${Object.keys(e.keyPattern || {})[0] === 'proximityId' ? 'Proximity ID' : 'Employee ID'} already exists`
    : e.message || String(e);

app.get('/api/employees', auth, async (req, res) => {
  try {
    res.json(await Employee.find().sort({ employeeId: 1 }).lean());
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.post('/api/employees', auth, async (req, res) => {
  try {
    const emp = await Employee.create(req.body);
    res.status(201).json(emp);
  } catch (e) {
    res.status(400).json({ error: dupMsg(e) });
  }
});

app.put('/api/employees/:id', auth, async (req, res) => {
  try {
    const emp = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json(emp);
  } catch (e) {
    res.status(400).json({ error: dupMsg(e) });
  }
});

app.delete('/api/employees/:id', auth, async (req, res) => {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

// ---- Auto sync ----
const mins = Number(process.env.SYNC_MINUTES || 5);
cron.schedule(`*/${mins} * * * *`, async () => {
  if (syncing) return; // previous sync still running, skip this tick
  syncing = true;
  try {
    console.log('Auto sync:', await syncDevice());
  } catch (e) {
    console.log('Auto sync failed:', e.message || e);
  } finally {
    syncing = false;
  }
});

app.listen(process.env.PORT || 5000, () => console.log(`Backend running on port ${process.env.PORT || 5000}`));
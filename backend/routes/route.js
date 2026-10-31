// backend/routes/route.js
// All API routes in one place. server.js-e: app.use('/api', require('./routes/route')(auth));

const express = require('express');
const jwt = require('jsonwebtoken');
const attendance = require('../controllers/attendanceController');
const employee = require('../controllers/employeeController');
const device = require('../controllers/deviceController');
const admin = require('../controllers/adminController');

module.exports = function routes(auth) {
  const r = express.Router();

  // ---- Login ----
  r.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
      const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token });
    }
    res.status(401).json({ error: 'Incorrect username or password' });
  });

  // ---- Device ----
  r.get('/status', auth, device.status);
  r.post('/sync', auth, device.sync);

  // ---- Device log clear (manual, 2 step) ----
  r.post('/clear-device/prepare', auth, device.prepareClearHandler);
  r.post('/clear-device/confirm', auth, device.confirmClearHandler);

  // ---- Data ----
  r.get('/logs', auth, attendance.logs);
  r.get('/daily', auth, attendance.daily);

  // ---- Employees ----
  r.get('/employees', auth, employee.list);
  r.get('/employees/:id/monthly', auth, attendance.monthly);
  r.post('/employees', auth, employee.create);
  r.put('/employees/:id', auth, employee.update);
  r.delete('/employees/:id', auth, employee.remove);

  // ---- Settings ----
  r.get('/settings', auth, admin.getSettings);
  r.put('/settings', auth, admin.updateSettings);

  // ---- Employee search (Employee ID / Proximity ID / Name) ----
  r.get('/employee-search', auth, employee.search);

  // ---- Holidays ----
  r.get('/holidays', auth, admin.listHolidays);
  r.post('/holidays', auth, admin.createHoliday);
  r.put('/holidays/:id', auth, admin.updateHoliday);
  r.delete('/holidays/:id', auth, admin.deleteHoliday);

  // ---- Leaves (CL / SL / EL) ----
  r.get('/leaves', auth, admin.listLeaves);
  r.post('/leaves', auth, admin.createLeave);
  r.put('/leaves/:id', auth, admin.updateLeave);
  r.delete('/leaves/:id', auth, admin.deleteLeave);

  // ---- Monthly PDF ----
  r.get('/employees/:id/monthly-pdf', auth, attendance.monthlyPdf);

  return r;
};

// backend/server.js

process.env.TZ = 'Asia/Dhaka'; // dotenv-er age; device punch time Bangladesh time-e thik thakbe
require('dotenv').config();
process.on('uncaughtException', (e) => console.log('Guarded error:', e.message));
process.on('unhandledRejection', (e) => console.log('Guarded rejection:', (e && e.message) || e));

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { runSync, isSyncing } = require('./controllers/deviceController');
const routes = require('./routes/route');

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

const auth = (req, res, next) => {
  try {
    jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

app.use('/api', routes(auth));

// ---- Auto sync ----
const mins = Math.max(1, Number(process.env.SYNC_MINUTES || 5));
cron.schedule(`*/${mins} * * * *`, async () => {
  if (isSyncing()) return; // previous sync still running, skip this tick
  try {
    console.log('Auto sync:', await runSync());
  } catch (e) {
    console.log('Auto sync failed:', e.message || e);
  }
});

app.listen(process.env.PORT || 5000, () => console.log(`Backend running on port ${process.env.PORT || 5000}`));

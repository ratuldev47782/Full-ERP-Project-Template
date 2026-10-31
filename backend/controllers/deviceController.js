// backend/controllers/deviceController.js
// Device communication (ZKLib), status, auto sync and device log clear.

const ZKLib = require('node-zklib');
const { Attendance } = require('../models/model');

const errMsg = (e) => (e && (e.message || (e.err && e.err.message))) || String(e);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Device ek connection chhere dite shomoy nay. Duto connection-er majhe ei gap rakhi.
const GAP_MS = 2000;
let lastEnd = 0;

async function doWithDevice(fn) {
  const wait = lastEnd + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);

  const zk = new ZKLib(process.env.ZK_IP, Number(process.env.ZK_PORT || 4370), 60000, 4000);
  let timer;
  try {
    await zk.createSocket();
    const limit = new Promise((_, rej) => {
      timer = setTimeout(() => rej(new Error('Device response timeout')), 120000);
    });
    return await Promise.race([fn(zk), limit]);
  } finally {
    clearTimeout(timer);
    try { await zk.disconnect(); } catch (e) {}
    lastEnd = Date.now();
  }
}

// one connection at a time
let queue = Promise.resolve();
function withDevice(fn, tries = 3) {
  const run = queue.then(async () => {
    let last;
    for (let i = 1; i <= tries; i++) {
      try { return await doWithDevice(fn); }
      catch (e) {
        last = e;
        console.log(`Device attempt ${i}/${tries} failed:`, errMsg(e));
        if (i < tries) await sleep(3000);
      }
    }
    throw new Error(errMsg(last));
  });
  queue = run.catch(() => {});
  return run;
}

const getInfo = () => withDevice((zk) => zk.getInfo(), 1);

// ---------- Normal sync (kichu delete hoy na) ----------
async function syncDevice() {
  return withDevice(async (zk) => {
    const logs = (await zk.getAttendances()).data || [];

    // only write records from the last stored time (minus 1 day safety)
    const last = await Attendance.findOne({ device: process.env.ZK_IP })
      .sort({ timestamp: -1 })
      .select('timestamp')
      .lean();
    const since = last ? last.timestamp.getTime() - 24 * 3600 * 1000 : 0;
    const fresh = logs.filter((l) => new Date(l.recordTime).getTime() >= since);

    if (fresh.length) {
      await Attendance.bulkWrite(
        fresh.map((l) => {
          const doc = {
            userId: String(l.deviceUserId),
            timestamp: new Date(l.recordTime),
            device: process.env.ZK_IP,
          };
          return {
            updateOne: {
              filter: doc,
              update: { $setOnInsert: doc },
              upsert: true,
            },
          };
        }),
        { ordered: false }
      );
    }
    return { logs: logs.length, written: fresh.length };
  });
}

// ---------- Device log clear (manual, 2 step) ----------

// device-er raw log -> unique, valid doc list
const toDocs = (logs) => {
  const seen = new Set();
  const docs = [];
  for (const l of logs) {
    const t = new Date(l.recordTime);
    if (Number.isNaN(t.getTime())) continue;
    const userId = String(l.deviceUserId);
    const key = `${userId}|${t.getTime()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    docs.push({ userId, timestamp: t, device: process.env.ZK_IP });
  }
  return docs;
};

// Device-er jei log gulo DB-te nai segulo ber kore
async function findMissing(docs) {
  if (!docs.length) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const d of docs) {
    const t = d.timestamp.getTime();
    if (t < min) min = t;
    if (t > max) max = t;
  }
  const inDb = await Attendance.find({
    device: process.env.ZK_IP,
    timestamp: { $gte: new Date(min), $lte: new Date(max) },
  })
    .select('userId timestamp -_id')
    .lean();
  const have = new Set(inDb.map((d) => `${d.userId}|${d.timestamp.getTime()}`));
  return docs.filter((d) => !have.has(`${d.userId}|${d.timestamp.getTime()}`));
}

const uploadDocs = (docs) =>
  Attendance.bulkWrite(
    docs.map((doc) => ({ updateOne: { filter: doc, update: { $setOnInsert: doc }, upsert: true } })),
    { ordered: false }
  );

// STEP 1: shudhu upload + verify. Device theke kichu delete hoy na.
async function prepareClear() {
  return withDevice(async (zk) => {
    const docs = toDocs((await zk.getAttendances()).data || []);
    if (!docs.length) return { logs: 0, alreadyInDb: 0, uploaded: 0, verified: true };

    const missing = await findMissing(docs);
    if (missing.length) await uploadDocs(missing);

    const stillMissing = await findMissing(docs);
    if (stillMissing.length) {
      throw new Error(`${stillMissing.length} ta log DB-te save hoyni. Delete kora jabe na.`);
    }
    return {
      logs: docs.length,
      alreadyInDb: docs.length - missing.length,
      uploaded: missing.length,
      verified: true,
    };
  }, 1); // retry nai
}

// STEP 2: user confirm korle. Abar verify kore tarpor delete.
async function confirmClear(expectedLogs) {
  return withDevice(async (zk) => {
    const docs = toDocs((await zk.getAttendances()).data || []);
    if (!docs.length) return { cleared: false, logs: 0 };

    const missing = await findMissing(docs);
    if (missing.length) {
      await uploadDocs(missing);
      throw new Error(`${missing.length} ta notun log pawa geche, DB-te upload hoyeche. Delete hoyni, abar chalao.`);
    }
    if (docs.length !== expectedLogs) {
      throw new Error('Device-er log sonkhya bodle geche. Delete hoyni, abar chalao.');
    }

    await zk.clearAttendanceLog();
    return { cleared: true, logs: docs.length };
  }, 1); // retry nai, clear command duibar jabe na
}

// ---------- Status cache ----------
// Status 30 second cache kora thake, jate dashboard reload-e bar bar device-e connect na kore.
// Ekshathe onek request ashleo ekta-i device check cholbe.
const STATUS_TTL = 30000;
let statusCache = { at: 0, data: null };
let statusPromise = null;

function checkDeviceStatus() {
  if (statusCache.data && Date.now() - statusCache.at < STATUS_TTL) {
    return Promise.resolve(statusCache.data);
  }
  if (!statusPromise) {
    const base = { ip: process.env.ZK_IP, port: process.env.ZK_PORT };
    statusPromise = getInfo()
      .then((info) => ({ connected: true, ...base, info }))
      .catch((e) => ({ connected: false, ...base, error: e.message || String(e) }))
      .then((data) => {
        statusCache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        statusPromise = null;
      });
  }
  return statusPromise;
}

// Ek shomoy ekta-i sync cholbe. Sync cholar shomoy keu abar sync chaile
// error na diye SEI cholte thaka sync-er result-er jonno wait korbe
// (cron ar manual/auto button duto-i ek-i promise share kore).
let syncPromise = null;
function runSync() {
  if (!syncPromise) {
    syncPromise = syncDevice()
      .then((r) => {
        // sync sofol mane device connected, status cache fresh kore dao
        statusCache = {
          at: Date.now(),
          data: { connected: true, ip: process.env.ZK_IP, port: process.env.ZK_PORT },
        };
        return r;
      })
      .finally(() => {
        syncPromise = null;
      });
  }
  return syncPromise;
}

const isSyncing = () => Boolean(syncPromise);

// ---------- Route handlers ----------
async function status(req, res) {
  res.json(await checkDeviceStatus());
}

async function sync(req, res) {
  try {
    res.json(await runSync());
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}

async function prepareClearHandler(req, res) {
  try {
    res.json(await prepareClear());
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}

async function confirmClearHandler(req, res) {
  const expected = Number(req.body?.expectedLogs);
  if (req.body?.confirm !== 'CLEAR' || !Number.isInteger(expected)) {
    return res.status(400).json({ error: 'Confirmation missing' });
  }
  try {
    res.json(await confirmClear(expected));
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}

module.exports = {
  getInfo,
  syncDevice,
  prepareClear,
  confirmClear,
  checkDeviceStatus,
  runSync,
  isSyncing,
  status,
  sync,
  prepareClearHandler,
  confirmClearHandler,
};

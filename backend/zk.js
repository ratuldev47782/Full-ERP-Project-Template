// backend/zk.js

const ZKLib = require('node-zklib');
const Attendance = require('./models/Attendance');

const errMsg = (e) => (e && (e.message || (e.err && e.err.message))) || String(e);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function doWithDevice(fn) {
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

module.exports = { getInfo, syncDevice, prepareClear, confirmClear };
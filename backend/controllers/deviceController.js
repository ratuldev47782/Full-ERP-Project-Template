// backend/controllers/deviceController.js
// Device communication (ZKLib), status, auto sync and device log clear.

const ZKLib = require('node-zklib');
const { Attendance } = require('../models/model');

const errMsg = (e) => (e && (e.message || (e.err && e.err.message))) || String(e);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Device ek connection chhere dite shomoy nay. Duto connection-er majhe ei gap rakhi.
const GAP_MS = 2000;
const CONNECT_TIMEOUT_MS = 15000; // device offline thakle createSocket() hang korte pare
const RESPONSE_TIMEOUT_MS = 120000;
const CLOSE_TIMEOUT_MS = 5000;
let lastEnd = 0;

// Socket jodi thik moto bondho na hoy (timeout / unreachable), tokhon force close.
// Eta na korle porer sync purono half-open session-e atke thakte pare.
async function closeQuietly(zk) {
  try {
    await Promise.race([zk.disconnect(), sleep(CLOSE_TIMEOUT_MS)]);
  } catch (e) {}
  for (const lib of [zk.zklibTcp, zk.zklibUdp]) {
    if (!lib) continue;
    try { if (lib.socket) lib.socket.destroy(); } catch (e) {}
    lib.socket = null;
  }
}

async function doWithDevice(fn) {
  const wait = lastEnd + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);

  const zk = new ZKLib(process.env.ZK_IP, Number(process.env.ZK_PORT || 4370), 60000, 4000);
  let connectTimer;
  let responseTimer;
  try {
    // library-er createSocket() shob shomoy settle kore na, tai bound kora hoy
    await Promise.race([
      zk.createSocket(),
      new Promise((_, rej) => {
        connectTimer = setTimeout(() => rej(new Error('Device connection timeout')), CONNECT_TIMEOUT_MS);
      }),
    ]);

    const work = fn(zk);
    work.catch(() => {}); // timeout-er por background promise reject korle unhandled na hoy
    return await Promise.race([
      work,
      new Promise((_, rej) => {
        responseTimer = setTimeout(() => rej(new Error('Device response timeout')), RESPONSE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(connectTimer);
    clearTimeout(responseTimer);
    await closeQuietly(zk);
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
        // porer try te aro beshi shomoy dei, jate device purono session chhere dite pare
        if (i < tries) await sleep(3000 * i);
      }
    }
    throw new Error(`${errMsg(last)}${tries > 1 ? ` (after ${tries} attempts)` : ''}`);
  });
  queue = run.catch(() => {});
  return run;
}

const getInfo = () => withDevice((zk) => zk.getInfo(), 1);

// Device-er general info: { userCounts, logCounts, logCapacity }.
// Settings-er storage board ei data diye-i capacity ar log count dekhay.
async function readDeviceInfo(zk) {
  try {
    const info = await zk.getInfo();
    return info && typeof info === 'object' ? info : null;
  } catch (e) {
    return null;
  }
}

const logCountOf = (info) => {
  const n = Number(info && info.logCounts);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Device-e koto gulo attendance log ache (na janle null). getInfo kom shomoy ney.
// Empty device-e getAttendances() call korle library timeout kore / hang kore,
// tai download korar age ei check ta kori.
async function readDeviceLogCount(zk) {
  return logCountOf(await readDeviceInfo(zk));
}

// ---------- Normal sync (kichu delete hoy na) ----------
// Boro device history ek command-e likhle MongoDB command size limit-e dhaka khete pare,
// tai chhoto batch-e likhi.
const UPSERT_BATCH = 500;

const isDupKey = (e) =>
  e && (e.code === 11000 || (Array.isArray(e.writeErrors) && e.writeErrors.length > 0 && e.writeErrors.every((w) => w.code === 11000)));

async function upsertAttendance(docs) {
  let inserted = 0;
  for (let i = 0; i < docs.length; i += UPSERT_BATCH) {
    const batch = docs.slice(i, i + UPSERT_BATCH);
    try {
      const r = await Attendance.bulkWrite(
        batch.map((doc) => ({ updateOne: { filter: doc, update: { $setOnInsert: doc }, upsert: true } })),
        { ordered: false }
      );
      inserted += r.upsertedCount || 0;
    } catch (e) {
      // duplicate key (same punch duibar) hole baki batch bondho koro na
      if (!isDupKey(e)) throw e;
      inserted += (e.result && e.result.upsertedCount) || 0;
    }
  }
  return inserted;
}

async function syncDevice() {
  return withDevice(async (zk) => {
    // Device-e kono log na thakle attendance download korar dorkar nai.
    // (Empty device-e library-er read long time wait kore / error dey - tai age-i check.)
    const info = await readDeviceInfo(zk);
    const deviceLogs = logCountOf(info);
    if (deviceLogs === 0) return { logs: 0, written: 0, deviceLogs: 0, info };

    const res = await zk.getAttendances();
    // adhuro read (packet timeout) hole retry hobe, adhuro data save hobe na
    if (res && res.err) throw res.err;
    const logs = (res && res.data) || [];

    // Debug: device theke asha record-er shob property console-e dekhi
    if (logs.length) {
      console.log(`[device sync] ${logs.length} record(s) from device`);
      console.log('[device sync] properties:', Object.keys(logs[0]));
      logs.slice(0, 20).forEach((l, i) => console.log(`[device sync] #${i + 1}`, l));
      if (logs.length > 20) console.log(`[device sync] ... ${logs.length - 20} more record(s) not printed`);
    } else {
      console.log('[device sync] device returned no attendance records');
    }

    // only write records from the last stored time (minus 1 day safety)
    const last = await Attendance.findOne({ device: process.env.ZK_IP })
      .sort({ timestamp: -1 })
      .select('timestamp')
      .lean();
    const since = last ? last.timestamp.getTime() - 24 * 3600 * 1000 : 0;
    const fresh = logs.filter((l) => {
      const t = new Date(l.recordTime).getTime();
      return Number.isFinite(t) && t >= since;
    });

    const written = fresh.length
      ? await upsertAttendance(
          fresh.map((l) => ({
            userId: String(l.deviceUserId),
            timestamp: new Date(l.recordTime),
            device: process.env.ZK_IP,
          }))
        )
      : 0;

    return { logs: logs.length, written, deviceLogs, info };
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

const uploadDocs = (docs) => upsertAttendance(docs);

// STEP 1: shudhu upload + verify. Device theke kichu delete hoy na.
async function prepareClear() {
  return withDevice(async (zk) => {
    // Device already empty hole delete korar kichu nai, tai download o korbo na.
    // (Empty device-e getAttendances() 60s wait kore TIMEOUT_ON_RECEIVING_REQUEST_DATA dey.)
    const deviceLogs = await readDeviceLogCount(zk);
    if (deviceLogs === 0) return { logs: 0, alreadyInDb: 0, uploaded: 0, verified: true, deviceLogs: 0 };

    const res = await zk.getAttendances();
    // adhuro read hole verify kora jay na, tai upload-o korbo na
    if (res && res.err) throw res.err;
    const docs = toDocs((res && res.data) || []);
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
    // Device already empty hole clear korar kichu nai
    const deviceLogs = await readDeviceLogCount(zk);
    if (deviceLogs === 0) return { cleared: false, logs: 0, alreadyEmpty: true };

    const res = await zk.getAttendances();
    // adhuro read mane DB-te verify kora jayni -> device theke kichu delete korbo na
    if (res && res.err) {
      throw new Error(`Log pora shompurno hoyni (${res.err.message || res.err}). Device theke kichu delete hoyni.`);
    }
    const docs = toDocs((res && res.data) || []);
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

// fresh=true mane cache bad diye device theke notun kore pora hoy
// (Settings-er Refresh button eita use kore).
function checkDeviceStatus(fresh = false) {
  if (!fresh && statusCache.data && Date.now() - statusCache.at < STATUS_TTL) {
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
        // sync sofol mane device connected, status cache fresh kore dao.
        // sync-er somoy pora info (log count / capacity) o cache-e rakhi.
        statusCache = {
          at: Date.now(),
          data: {
            connected: true,
            ip: process.env.ZK_IP,
            port: process.env.ZK_PORT,
            info: r.info || null,
          },
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
  // ?fresh=1 -> cache bad diye device theke notun kore pora hoy
  res.json(await checkDeviceStatus(req.query.fresh === '1'));
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

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

// শুধু পাঞ্চ লগ আনা হয়, ডিভাইস ইউজার sync নেই
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

module.exports = { getInfo, syncDevice };
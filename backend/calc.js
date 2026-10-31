// backend/calc.js
// Attendance-er shob calculation ek jaygay. Timezone: Asia/Dhaka (UTC+6, DST nai).
// Raw punch kokhono change hoy na; ekhane shudhu hisab kora hoy.

const TZ_OFFSET_MS = 6 * 3600000;
const MIN = 60000;
const OT_GRACE_MIN = 15; // fixed

const pad = (n) => String(n).padStart(2, '0');
const shifted = (d) => new Date(new Date(d).getTime() + TZ_OFFSET_MS);

const dhakaDate = (d) => shifted(d).toISOString().slice(0, 10); // yyyy-mm-dd (Dhaka)
const dhakaTime = (d) => shifted(d).toISOString().slice(11, 19); // HH:MM:SS (Dhaka)
const dayStart = (s) => new Date(`${s}T00:00:00+06:00`);
const dayEnd = (s) => new Date(dayStart(s).getTime() + 86400000 - 1);
const dayOfWeek = (s) => new Date(`${s}T00:00:00Z`).getUTCDay(); // 0=Sun ... 6=Sat

const isValidDate = (s) =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const hhmmToMin = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};
const fmtHM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

function monthInfo(month) {
  const [y, m] = month.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return {
    days: new Date(Date.UTC(y, m, 0)).getUTCDate(),
    start: dayStart(`${month}-01`),
    end: dayStart(`${ny}-${pad(nm)}-01`), // exclusive
  };
}

const overlap = (aS, aE, bS, bE) => Math.max(0, Math.min(aE, bE) - Math.max(aS, bS));

// OT rounding (15 min grace, protiti ghontay):
//   0:00-0:15 -> 0h | 0:16-1:15 -> 1h | 1:16-2:15 -> 2h | 2:16-3:15 -> 3h ...
const roundOtMinutes = (actualMin) => Math.max(0, Math.ceil((actualMin - OT_GRACE_MIN) / 60)) * 60;

// Normal working day.
//   effective in = MAX(actual in, office start)
//   lunch shudhu tokhon-i bad jay jokhon interval-er sathe overlap kore
//   OT = office end-er por theke (second ignore)
function computeWork(date, inTime, outTime, s) {
  const base = dayStart(date).getTime();
  const at = (hhmm) => Math.floor((base + hhmmToMin(hhmm) * MIN) / MIN);
  const startM = at(s.officeStart);
  const endM = at(s.officeEnd);
  const lsM = at(s.lunchStart);
  const leM = at(s.lunchEnd);

  const actualInM = Math.floor(new Date(inTime).getTime() / MIN);
  const outM = Math.floor(new Date(outTime).getTime() / MIN);
  const inM = Math.max(actualInM, startM);

  const lunch = overlap(inM, outM, lsM, leM);
  const workedMinutes = Math.max(0, outM - inM - lunch); // OT shoho
  const regEnd = Math.min(outM, endM);
  const regularMinutes = Math.max(0, regEnd - inM - overlap(inM, regEnd, lsM, leM));
  const otActualMinutes = Math.max(0, outM - Math.max(endM, inM));

  const startDate = new Date(base + hhmmToMin(s.officeStart) * MIN);
  return {
    effectiveIn: new Date(inTime) > startDate ? new Date(inTime) : startDate,
    workedMinutes,
    regularMinutes,
    otActualMinutes,
    otFinalMinutes: roundOtMinutes(otActualMinutes),
  };
}

// Holiday-te kaj korle: puro kaj-er somoy (lunch bad) holiday work/OT hishebe alada rakha hoy.
function computeHolidayWork(date, inTime, outTime, s) {
  const base = dayStart(date).getTime();
  const at = (hhmm) => Math.floor((base + hhmmToMin(hhmm) * MIN) / MIN);
  const inM = Math.floor(new Date(inTime).getTime() / MIN);
  const outM = Math.floor(new Date(outTime).getTime() / MIN);
  const worked = Math.max(0, outM - inM - overlap(inM, outM, at(s.lunchStart), at(s.lunchEnd)));
  return { workedMinutes: worked, otActualMinutes: worked, otFinalMinutes: roundOtMinutes(worked) };
}

const settingsInfo = (s) => {
  const total = hhmmToMin(s.officeEnd) - hhmmToMin(s.officeStart);
  const lunch = hhmmToMin(s.lunchEnd) - hhmmToMin(s.lunchStart);
  return { totalOfficeMinutes: total, lunchMinutes: lunch, workingMinutes: total - lunch };
};

module.exports = {
  OT_GRACE_MIN, pad, dhakaDate, dhakaTime, dayStart, dayEnd, dayOfWeek, isValidDate,
  hhmmToMin, fmtHM, monthInfo, roundOtMinutes, computeWork, computeHolidayWork, settingsInfo,
};
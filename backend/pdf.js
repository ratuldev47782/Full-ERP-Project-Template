// backend/pdf.js
// Monthly Employee Time Card (A4, ek page). Layout reference image onujayi.
// Logo: backend/assets/logo.png (ba .jpg) rakhle header-e boshbe.

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { pad, dhakaDate, dhakaTime } = require('./calc');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map((m) => m.slice(0, 3));
const CODE = { Present: 'P', 'Missing Out': 'P', Absent: 'A', Weekend: 'H', Holiday: 'H', CL: 'CL', SL: 'SL', EL: 'EL', 'Not Joined': 'NJ' };
const LEAVE_NAME = { CL: 'Casual Leave', SL: 'Sick Leave', EL: 'Earned Leave' };

const shortDate = (s) => {
  const [y, m, d] = s.split('-');
  return `${d}-${MON[Number(m) - 1]}-${y.slice(2)}`;
};
const hms = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}:00`;

function printStamp() {
  const now = new Date();
  const t = dhakaTime(now);
  let h = Number(t.slice(0, 2));
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${dhakaDate(now)} ${pad(h)}:${t.slice(3, 5)} ${ap}`;
}

function findLogo() {
  for (const f of ['logo.png', 'logo.jpg', 'logo.jpeg']) {
    const p = path.join(__dirname, 'assets', f);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function buildPdf(res, { report, settings, month }) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Time Card ${month}` } });
  doc.pipe(res);

  const W = 595.28;
  const L = 28;
  const R = W - 28;
  const CW = R - L;
  const [y, m] = month.split('-').map(Number);
  const emp = report.employee;
  const sum = report.summary;

  // ---- Header ----
  const logo = findLogo();
  if (logo) {
    try { doc.image(logo, L + 4, 22, { fit: [56, 56] }); } catch (e) {}
  }
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(16).text(settings.companyName, L, 24, { width: CW, align: 'center' });
  doc.font('Helvetica').fontSize(9).text(settings.companyAddress, L, 44, { width: CW, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(9).text(`EMPLOYEE TIME CARD MONTH OF : (${MONTHS[m - 1]} - ${y})`, L, 58, { width: CW, align: 'center' });
  doc.lineWidth(1.2).moveTo(L, 82).lineTo(R, 82).stroke();

  // ---- Employee info ----
  const joinDate = emp.joinDate ? new Date(emp.joinDate).toISOString().slice(0, 10) : '';
  const left = [['EMPLOYEE ID', emp.employeeId], ['NAME', emp.name], ['JOIN DATE', joinDate], ['GRADE', emp.grade], ['LINE', emp.line]];
  const right = [['DESIGNATION', emp.designation], ['DEPARTMENT', emp.department], ['SECTION', emp.section], ['SUB-SECTION', emp.subSection], ['CARD NO', emp.cardNo]];
  const infoY = 90;
  const rowI = 14;
  const put = (label, val, lx, vx, w, yy) => {
    doc.font('Helvetica-Bold').fontSize(8.5).text(label, lx, yy, { width: vx - lx, lineBreak: false });
    doc.text(`: ${val || ''}`, vx, yy, { width: w, lineBreak: false, ellipsis: true });
  };
  left.forEach(([a, b], i) => put(a, b, L + 4, L + 90, 190, infoY + i * rowI));
  right.forEach(([a, b], i) => put(a, b, L + 290, L + 375, CW - 380, infoY + i * rowI));

  // ---- Table ----
  const cols = [
    ['DATE', 0.14], ['IN TIME', 0.15], ['OUT TIME', 0.16], ['OT HOURS', 0.15], ['STATUS', 0.12], ['SPECIAL STATUS', 0.28],
  ].map(([t, f]) => [t, f * CW]);
  const ty = infoY + 5 * rowI + 8;
  const hH = 18;
  const rH = 15.5;

  const cell = (x, yy, w, h, text, o = {}) => {
    if (o.fill) doc.save().rect(x, yy, w, h).fill(o.fill).restore();
    doc.lineWidth(0.6).strokeColor('#000').rect(x, yy, w, h).stroke();
    doc.fillColor('#000').font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.size || 8);
    doc.text(String(text ?? ''), x + 2, yy + (h - (o.size || 8)) / 2 - 0.5, { width: w - 4, align: o.align || 'center', lineBreak: false, ellipsis: true });
  };

  let x = L;
  cols.forEach(([t, w]) => {
    cell(x, ty, w, hH, t, { bold: true, fill: '#d9d9d9', size: 8 });
    x += w;
  });

  let yy = ty + hH;
  const rows = report.days.filter((d) => d.status !== '' && d.date <= dhakaDate(new Date()));
  for (const d of rows) {
    const code = CODE[d.status] || '';
    const hw = d.status === 'Holiday' ? d.holidayWork : null;
    const ot = hw ? hw.otFinalMinutes : d.otFinalMinutes;
    let special = '';
    if (d.status === 'Holiday') special = (d.holidayName || 'Holiday') + (d.inTime ? ' (worked)' : '');
    else if (d.status === 'Weekend') special = 'Weekend';
    else if (LEAVE_NAME[d.status]) special = LEAVE_NAME[d.status];
    else if (d.status === 'Missing Out') special = 'Missing check-out';
    else if (d.status === 'Not Joined') special = 'Not joined';

    const fill = code === 'H' ? '#f0f0f0' : null;
    const vals = [
      shortDate(d.date),
      d.inTime ? dhakaTime(d.inTime) : '00:00:00',
      d.outTime ? dhakaTime(d.outTime) : '00:00:00',
      hms(ot),
      code,
      special,
    ];
    x = L;
    cols.forEach(([, w], i) => {
      cell(x, yy, w, rH, vals[i], { fill, bold: i === 4, size: 7.5, align: i === 5 ? 'left' : 'center' });
      x += w;
    });
    yy += rH;
  }

  // Total OT (reference-er niche-er 36 box)
  const otX = L + cols[0][1] + cols[1][1] + cols[2][1];
  cell(otX, yy, cols[3][1], rH, `Total ${hms(sum.otFinalMinutes)}`, { bold: true, fill: '#d9d9d9', size: 7.5 });
  yy += rH + 14;

  // ---- Monthly summary ----
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000').text('Monthly Attendance Summary', L, yy, { width: CW, align: 'center' });
  yy += 14;
  const hol = (sum.holidayTotal);
  const sumCols = [
    ['Total Days', sum.totalDays], ['Working Days', sum.workingDays], ['Present', sum.presentDays], ['Absent', sum.absent],
    ['Holiday', hol], ['CL', sum.cl], ['SL', sum.sl], ['EL', sum.el],
    ['OT Hours', Number(sum.otHours.toFixed(2))], ['Holiday OT', Number(sum.holidayOtHours.toFixed(2))],
  ];
  const sw = CW / sumCols.length;
  sumCols.forEach(([t, v], i) => {
    cell(L + i * sw, yy, sw, 16, t, { bold: true, fill: '#d9d9d9', size: 7 });
    cell(L + i * sw, yy + 16, sw, 18, v, { bold: true, size: 9 });
  });

  // ---- Signatures ----
  const sy = 770;
  const sigW = 150;
  [['Prepared By', L], ['Checked By', L + (CW - sigW) / 2], ['Authorized Signature', R - sigW]].forEach(([t, sx]) => {
    doc.lineWidth(0.8).moveTo(sx, sy).lineTo(sx + sigW, sy).stroke();
    doc.font('Helvetica-Bold').fontSize(8.5).text(t, sx, sy + 4, { width: sigW, align: 'center', lineBreak: false });
  });

  // ---- Footer ----
  doc.lineWidth(1).moveTo(L, 806).lineTo(R, 806).stroke();
  doc.font('Helvetica').fontSize(8.5).text(`Print Date & Time: ${printStamp()}`, L, 812, { width: CW, align: 'right', lineBreak: false });

  doc.end();
}

module.exports = { buildPdf };
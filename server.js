require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const upload = multer({ dest: UPLOAD_DIR });

function filePath(name) {
  return path.join(DATA_DIR, name);
}

function readJson(name, fallback) {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function writeJson(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf8');
}

function id(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function toNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function calcHours(entry) {
  // Supports manual hours OR start/end/pause fields.
  const manual = toNumber(entry.hours ?? entry.timer ?? entry.totalHours, NaN);
  if (Number.isFinite(manual) && manual > 0) return manual;

  const start = entry.startTime || entry.start || entry.from;
  const end = entry.endTime || entry.end || entry.to;
  if (!start || !end) return 0;

  const date = entry.date || new Date().toISOString().slice(0, 10);
  const a = new Date(`${date}T${start}`);
  const b = new Date(`${date}T${end}`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;

  let diff = (b - a) / 3600000;
  if (diff < 0) diff += 24;
  const pause = toNumber(entry.pauseMinutes ?? entry.pause ?? entry.breakMinutes, 0) / 60;
  return Math.max(0, diff - pause);
}

function getRules(employeeId) {
  const all = readJson('overtime-rules.json', {});
  return all[employeeId] || all.default || {
    enabled: true,
    overtimeAfterHoursPerShift: 8,
    overtimeAfterHoursPerWeek: 37,
    rounding: 0.25,
    normalHourlyRate: 160,
    overtimeHourlyRate: 220,
    customerHourlyRate: 320,
    vatRate: 25
  };
}

function roundTo(value, step) {
  const s = toNumber(step, 0);
  if (!s) return value;
  return Math.round(value / s) * s;
}

function calculateEntry(entry) {
  const employeeId = entry.employeeId || entry.medarbejderId || entry.workerId || 'UNKNOWN';
  const rules = { ...getRules(employeeId), ...(entry.rules || {}) };
  const hours = calcHours(entry);
  const overtimeAfter = toNumber(rules.overtimeAfterHoursPerShift, 8);
  const rounding = toNumber(rules.rounding, 0.25);

  let overtimeHours = rules.enabled === false ? 0 : Math.max(0, hours - overtimeAfter);
  overtimeHours = roundTo(overtimeHours, rounding);
  const normalHours = Math.max(0, hours - overtimeHours);

  const normalRate = toNumber(entry.normalHourlyRate ?? rules.normalHourlyRate, 160);
  const overtimeRate = toNumber(entry.overtimeHourlyRate ?? rules.overtimeHourlyRate, normalRate);
  const customerRate = toNumber(entry.customerHourlyRate ?? rules.customerHourlyRate, 320);
  const vatRate = toNumber(entry.vatRate ?? rules.vatRate, 25);

  const normalPay = normalHours * normalRate;
  const overtimePay = overtimeHours * overtimeRate;
  const employeePay = normalPay + overtimePay;
  const customerTotalExVat = hours * customerRate;
  const customerVat = customerTotalExVat * vatRate / 100;
  const customerTotalIncVat = customerTotalExVat + customerVat;
  const marginExVat = customerTotalExVat - employeePay;

  return {
    hours,
    normalHours,
    overtimeHours,
    normalRate,
    overtimeRate,
    customerRate,
    vatRate,
    normalPay,
    overtimePay,
    employeePay,
    customerTotalExVat,
    customerVat,
    customerTotalIncVat,
    marginExVat
  };
}

app.get('/', (req, res) => {
  res.json({
    ok: true,
    app: 'Pengedag Backend',
    version: '1.1.1',
    note: 'Mobile endpoints aktive. Brug /health og /api/mobile/time-entries.'
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'healthy', version: '1.1.1' });
});

// ---------- Mobile time entries ----------
function listTimeEntries(req, res) {
  const entries = readJson('time-entries.json', []);
  const employeeId = req.query.employeeId || req.query.medarbejderId;
  const status = req.query.status;
  let out = entries;
  if (employeeId) out = out.filter(e => String(e.employeeId) === String(employeeId));
  if (status) out = out.filter(e => String(e.status) === String(status));
  res.json({ ok: true, count: out.length, entries: out });
}

function createTimeEntry(req, res) {
  const body = req.body || {};
  const employeeId = body.employeeId || body.medarbejderId || body.workerId;
  if (!employeeId) return res.status(400).json({ ok: false, error: 'employeeId mangler' });

  const entry = {
    id: body.id || id('time'),
    employeeId,
    employeeName: body.employeeName || body.name || body.medarbejderNavn || '',
    email: body.email || '',
    customerId: body.customerId || body.kundeId || '',
    customerName: body.customerName || body.kundeNavn || '',
    jobId: body.jobId || '',
    date: body.date || new Date().toISOString().slice(0, 10),
    startTime: body.startTime || body.start || '',
    endTime: body.endTime || body.end || '',
    pauseMinutes: toNumber(body.pauseMinutes ?? body.pause ?? body.breakMinutes, 0),
    note: body.note || body.description || '',
    status: body.status || 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  entry.calculation = calculateEntry({ ...body, ...entry });

  const entries = readJson('time-entries.json', []);
  entries.push(entry);
  writeJson('time-entries.json', entries);
  res.json({ ok: true, entry });
}

app.get('/api/mobile/time-entries', listTimeEntries);
app.get('/api/mobile/times', listTimeEntries);
app.get('/api/mobile/timesheets', listTimeEntries);
app.get('/api/mobile/entries', listTimeEntries);

app.post('/api/mobile/time-entry', createTimeEntry);
app.post('/api/mobile/time-entries', createTimeEntry);
app.post('/api/mobile/times', createTimeEntry);
app.post('/api/mobile/timesheets', createTimeEntry);
app.post('/api/mobile/entries', createTimeEntry);

function approveEntry(req, res) {
  const entryId = req.params.id || req.body.id;
  const status = req.body.status || 'approved';
  const entries = readJson('time-entries.json', []);
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return res.status(404).json({ ok: false, error: 'Timeseddel ikke fundet' });
  entry.status = status;
  entry.approvedAt = new Date().toISOString();
  entry.approvedBy = req.body.approvedBy || 'desktop';
  entry.updatedAt = new Date().toISOString();
  entry.calculation = calculateEntry(entry);
  writeJson('time-entries.json', entries);
  res.json({ ok: true, entry });
}

app.post('/api/mobile/time-entries/:id/approve', approveEntry);
app.post('/api/mobile/times/:id/approve', approveEntry);
app.post('/api/mobile/timesheets/:id/approve', approveEntry);
app.post('/api/mobile/entries/:id/approve', approveEntry);

// ---------- Overtime rules ----------
app.get('/api/mobile/overtime-rules/:employeeId', (req, res) => {
  res.json({ ok: true, employeeId: req.params.employeeId, rules: getRules(req.params.employeeId) });
});

app.post('/api/mobile/overtime-rules', (req, res) => {
  const all = readJson('overtime-rules.json', {});
  const employeeId = req.body.employeeId || req.body.medarbejderId || 'default';
  all[employeeId] = { ...all[employeeId], ...req.body, updatedAt: new Date().toISOString() };
  writeJson('overtime-rules.json', all);
  res.json({ ok: true, employeeId, rules: all[employeeId] });
});

app.post('/api/mobile/overtime-rules/:employeeId', (req, res) => {
  const all = readJson('overtime-rules.json', {});
  const employeeId = req.params.employeeId;
  all[employeeId] = { ...all[employeeId], ...req.body, employeeId, updatedAt: new Date().toISOString() };
  writeJson('overtime-rules.json', all);
  res.json({ ok: true, employeeId, rules: all[employeeId] });
});

// ---------- Payslips ----------
app.post('/api/mobile/payslip', (req, res) => {
  const slips = readJson('payslips.json', []);
  const slip = { id: req.body.id || id('payslip'), ...req.body, createdAt: new Date().toISOString() };
  slips.push(slip);
  writeJson('payslips.json', slips);
  res.json({ ok: true, payslip: slip });
});

app.get('/api/mobile/payslip/:employeeId', (req, res) => {
  const slips = readJson('payslips.json', []);
  const employeeSlips = slips.filter(s => String(s.employeeId || s.medarbejderId) === String(req.params.employeeId));
  res.json({ ok: true, count: employeeSlips.length, payslips: employeeSlips, latest: employeeSlips[employeeSlips.length - 1] || null });
});

// ---------- Revisor/upload test endpoint ----------
app.post('/api/revisor/upload', upload.single('file'), (req, res) => {
  res.json({ ok: true, file: req.file || null, note: 'Upload modtaget' });
});

// ---------- Minimal compliance compatibility ----------
app.get('/api/compliance/audit/verify', (req, res) => {
  res.json({ ok: true, valid: true, note: 'Audit verify placeholder aktiv i v1.1.1 mobile fix.' });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Cannot ${req.method} ${req.path}` });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pengedag backend on ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const TIMES_FILE = path.join(DATA_DIR, 'mobile-time-entries.json');
const RULES_FILE = path.join(DATA_DIR, 'overtime-rules.json');
const PAYSLIPS_FILE = path.join(DATA_DIR, 'payslips.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const upload = multer({ dest: UPLOAD_DIR });

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function toMinutes(time) {
  if (!time || !/^\d{1,2}:\d{2}$/.test(String(time))) return 0;
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
}

function roundTo(value, step = 0.25) {
  const s = Number(step) || 0.25;
  return Math.round(value / s) * s;
}

function calculateEntry(input = {}) {
  const start = toMinutes(input.startTime);
  let end = toMinutes(input.endTime);
  if (end < start) end += 24 * 60;
  const pauseMinutes = Number(input.pauseMinutes || 0);
  const rawHours = Math.max(0, (end - start - pauseMinutes) / 60);
  const hours = Number(rawHours.toFixed(2));

  const normalRate = Number(input.normalRate || input.hourlyRate || 160);
  const overtimeRate = Number(input.overtimeRate || 220);
  const customerRate = Number(input.customerRate || 320);
  const vatRate = Number(input.vatRate ?? 25);
  const overtimeAfterHours = Number(input.overtimeAfterHours || 8);
  const roundStep = Number(input.overtimeRoundStep || 0.25);

  const overtimeHours = hours > overtimeAfterHours ? roundTo(hours - overtimeAfterHours, roundStep) : 0;
  const normalHours = Number(Math.max(0, hours - overtimeHours).toFixed(2));
  const normalPay = Number((normalHours * normalRate).toFixed(2));
  const overtimePay = Number((overtimeHours * overtimeRate).toFixed(2));
  const employeePay = Number((normalPay + overtimePay).toFixed(2));
  const customerTotalExVat = Number((hours * customerRate).toFixed(2));
  const customerVat = Number((customerTotalExVat * vatRate / 100).toFixed(2));
  const customerTotalIncVat = Number((customerTotalExVat + customerVat).toFixed(2));
  const marginExVat = Number((customerTotalExVat - employeePay).toFixed(2));

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

function getEntries() {
  return readJson(TIMES_FILE, []);
}

function saveEntries(entries) {
  writeJson(TIMES_FILE, entries);
}

function normalizeEntry(body = {}) {
  const now = new Date().toISOString();
  const entry = {
    id: body.id || `mob_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    employeeId: body.employeeId || body.medarbejderId || '',
    employeeName: body.employeeName || body.name || body.navn || '',
    email: body.email || '',
    customerId: body.customerId || '',
    customerName: body.customerName || '',
    jobId: body.jobId || '',
    date: body.date || new Date().toISOString().slice(0, 10),
    startTime: body.startTime || body.start || '',
    endTime: body.endTime || body.end || '',
    pauseMinutes: Number(body.pauseMinutes || body.pause || 0),
    note: body.note || '',
    status: body.status && body.status !== 'Lokal' ? body.status : 'Afventer',
    createdAt: body.createdAt || now,
    updatedAt: now
  };
  entry.calculation = calculateEntry({ ...body, ...entry });
  return entry;
}

app.get('/', (req, res) => {
  res.json({
    ok: true,
    app: 'Pengedag Backend',
    version: '1.1.5-backend-only',
    note: 'Railway backend only. No Electron build. Brug /health og /api/mobile/times.'
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'healthy', version: '1.1.5-backend-only' });
});

app.get('/api/mobile/routes', (req, res) => {
  res.json({
    ok: true,
    routes: [
      'GET /api/mobile/time-entries',
      'GET /api/mobile/times',
      'GET /api/mobile/timesheets',
      'GET /api/mobile/entries',
      'POST /api/mobile/time-entry',
      'POST /api/mobile/time-entries',
      'POST /api/mobile/times',
      'POST /api/mobile/timesheets',
      'POST /api/mobile/entries',
      'POST /api/mobile/time-entries/:id/approve',
      'POST /api/mobile/time-entries/:id/reject',
      'GET /api/mobile/overtime-rules/:employeeId',
      'POST /api/mobile/overtime-rules',
      'POST /api/mobile/payslip',
      'GET /api/mobile/payslip/:employeeId'
    ]
  });
});

function sendEntries(req, res) {
  const entries = getEntries();
  res.json({ ok: true, count: entries.length, entries });
}

['/api/mobile/time-entries', '/api/mobile/times', '/api/mobile/timesheets', '/api/mobile/entries'].forEach(route => {
  app.get(route, sendEntries);
});

function addEntry(req, res) {
  const entries = getEntries();
  const entry = normalizeEntry(req.body || {});
  entries.push(entry);
  saveEntries(entries);
  res.json({ ok: true, entry, count: entries.length });
}

['/api/mobile/time-entry', '/api/mobile/time-entries', '/api/mobile/times', '/api/mobile/timesheets', '/api/mobile/entries'].forEach(route => {
  app.post(route, addEntry);
});

app.post('/api/mobile/time-entries/:id/approve', (req, res) => {
  const entries = getEntries();
  const entry = entries.find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ ok: false, error: 'Time entry not found' });
  entry.status = 'Godkendt';
  entry.approvedAt = new Date().toISOString();
  entry.updatedAt = entry.approvedAt;
  entry.calculation = calculateEntry({ ...entry, ...(entry.calculation || {}) });
  saveEntries(entries);
  res.json({ ok: true, entry });
});

app.post('/api/mobile/time-entries/:id/reject', (req, res) => {
  const entries = getEntries();
  const entry = entries.find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ ok: false, error: 'Time entry not found' });
  entry.status = 'Afvist';
  entry.rejectedAt = new Date().toISOString();
  entry.rejectReason = req.body?.reason || '';
  entry.updatedAt = entry.rejectedAt;
  saveEntries(entries);
  res.json({ ok: true, entry });
});

app.delete('/api/mobile/time-entries', (req, res) => {
  saveEntries([]);
  res.json({ ok: true, deleted: true, count: 0 });
});

app.get('/api/mobile/overtime-rules/:employeeId', (req, res) => {
  const rules = readJson(RULES_FILE, {});
  const employeeRules = rules[req.params.employeeId] || rules.default || {
    enabled: true,
    overtimeAfterHours: 8,
    overtimeAfterWeekHours: 37,
    overtimeRoundStep: 0.25,
    normalRate: 160,
    overtimeRate: 220,
    customerRate: 320,
    vatRate: 25
  };
  res.json({ ok: true, employeeId: req.params.employeeId, rules: employeeRules });
});

app.post('/api/mobile/overtime-rules', (req, res) => {
  const rules = readJson(RULES_FILE, {});
  const employeeId = req.body.employeeId || 'default';
  rules[employeeId] = { ...rules[employeeId], ...req.body, updatedAt: new Date().toISOString() };
  writeJson(RULES_FILE, rules);
  res.json({ ok: true, employeeId, rules: rules[employeeId] });
});

app.post('/api/mobile/payslip', (req, res) => {
  const payslips = readJson(PAYSLIPS_FILE, []);
  const payslip = { id: req.body.id || `pay_${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
  payslips.push(payslip);
  writeJson(PAYSLIPS_FILE, payslips);
  res.json({ ok: true, payslip });
});

app.get('/api/mobile/payslip/:employeeId', (req, res) => {
  const payslips = readJson(PAYSLIPS_FILE, []);
  const employeePayslips = payslips.filter(p => p.employeeId === req.params.employeeId);
  res.json({ ok: true, employeeId: req.params.employeeId, count: employeePayslips.length, payslips: employeePayslips });
});

app.post('/api/revisor/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
  const buffer = fs.readFileSync(req.file.path);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  res.json({ ok: true, filename: req.file.originalname, storedAs: req.file.filename, size: req.file.size, sha256 });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Cannot ${req.method} ${req.path}` });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pengedag backend on ${PORT}`);
});

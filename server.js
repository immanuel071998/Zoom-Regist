const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { sendConfirmationEmail, generateIcsContent, generateEmailHtml, testSmtpConnection } = require('./emailService');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = '11223344';

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ASSETS_DIR = path.join(__dirname, 'uploads', 'assets');
const QRCODES_DIR = path.join(__dirname, 'uploads', 'qrcodes');

// Ensure directories exist
[DATA_DIR, ASSETS_DIR, QRCODES_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer Storage for User Sample Files
const assetStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ASSETS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  }
});
const uploadAsset = multer({
  storage: assetStorage,
  limits: { fileSize: 250 * 1024 * 1024 } // 250MB
});

// Multer Storage for Custom QR Code / Barcode Upload
const qrStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, QRCODES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `zoom_qr_${Date.now()}${ext}`);
  }
});
const uploadQr = multer({
  storage: qrStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Helper functions for reading & writing persistent JSON
function readJSON(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content || JSON.stringify(fallback));
  } catch (e) {
    console.error(`Error reading ${file}:`, e);
    return fallback;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`Error writing ${file}:`, e);
    return false;
  }
}

// Check admin password helper
function verifyAdminAuth(req) {
  const headerPwd = req.headers['x-admin-password'];
  const bodyPwd = req.body && req.body.adminPassword;
  return headerPwd === ADMIN_PASSWORD || bodyPwd === ADMIN_PASSWORD;
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// 1. Verify Admin Password (11223344)
app.post('/api/admin/verify-password', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, message: 'Password valid. Akses pengaturan diberikan.' });
  }
  return res.status(401).json({ success: false, message: 'Password salah! Akses ditolak.' });
});

// 2. Get Event & Zoom Settings (Public for landing page)
app.get('/api/settings', (req, res) => {
  const settings = readJSON(SETTINGS_FILE, {});
  // Hide sensitive SMTP password in public endpoint
  const publicSettings = {
    ...settings,
    smtp: {
      enabled: settings.smtp?.enabled || false,
      provider: settings.smtp?.provider || (process.env.RESEND_API_KEY ? 'resend' : 'smtp'),
      resendApiKey: settings.smtp?.resendApiKey ? '••••••••' : (process.env.RESEND_API_KEY ? '•••••••• (Railway Env)' : ''),
      hasResendApiKey: !!(settings.smtp?.resendApiKey || process.env.RESEND_API_KEY),
      host: settings.smtp?.host || '',
      port: settings.smtp?.port || 587,
      user: settings.smtp?.user || '',
      from: settings.smtp?.from || '',
      hasPass: !!(settings.smtp?.pass)
    }
  };
  res.json({ success: true, settings: publicSettings });
});

// 3. Update Event & Zoom Settings (Protected with Password: 11223344)
app.post('/api/settings', (req, res) => {
  if (!verifyAdminAuth(req)) {
    return res.status(401).json({ success: false, message: 'Password pengaturan salah atau belum dimasukkan!' });
  }

  const current = readJSON(SETTINGS_FILE, {});
  
  // If smtp pass is omitted, preserve existing password
  let updatedSmtp = { ...(current.smtp || {}), ...(req.body.smtp || {}) };
  if (req.body.smtp && req.body.smtp.pass === undefined && current.smtp?.pass) {
    updatedSmtp.pass = current.smtp.pass;
  }
  // If resendApiKey is omitted or masked, preserve existing
  if (req.body.smtp && (!req.body.smtp.resendApiKey || req.body.smtp.resendApiKey.includes('•••')) && current.smtp?.resendApiKey) {
    updatedSmtp.resendApiKey = current.smtp.resendApiKey;
  }

  const updated = {
    ...current,
    ...req.body,
    event: { 
      ...(current.event || {}), 
      ...(req.body.event || {}),
      zoom: {
        ...(current.event?.zoom || {}),
        ...(req.body.event?.zoom || {})
      }
    },
    smtp: updatedSmtp
  };

  writeJSON(SETTINGS_FILE, updated);
  res.json({ success: true, settings: updated, message: 'Pengaturan berhasil disimpan!' });
});

// 4. Upload Custom Zoom Barcode / QR Code Image (Protected with Password: 11223344)
app.post('/api/settings/qrcode', uploadQr.single('qrCodeFile'), (req, res) => {
  if (!verifyAdminAuth(req)) {
    return res.status(401).json({ success: false, message: 'Password pengaturan salah atau belum dimasukkan!' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'File gambar barcode / QR code tidak disertakan.' });
  }

  const current = readJSON(SETTINGS_FILE, {});
  if (!current.event) current.event = {};
  if (!current.event.zoom) current.event.zoom = {};

  const qrUrl = `/uploads/qrcodes/${req.file.filename}`;
  current.event.zoom.qrMode = 'custom';
  current.event.zoom.customQrUrl = qrUrl;

  writeJSON(SETTINGS_FILE, current);
  res.json({ success: true, qrUrl, message: 'Gambar barcode Zoom berhasil diupload & diterapkan!' });
});

// 5. Generate Dynamic QR Code on the Fly (Data URL)
app.get('/api/qrcode', async (req, res) => {
  try {
    const settings = readJSON(SETTINGS_FILE, {});
    const text = req.query.text || settings.event?.zoom?.meetingUrl || 'https://zoom.us';
    
    // If custom barcode is configured and requested without override
    if (!req.query.text && settings.event?.zoom?.qrMode === 'custom' && settings.event?.zoom?.customQrUrl) {
      return res.json({ 
        success: true, 
        mode: 'custom', 
        url: settings.event.zoom.customQrUrl, 
        text 
      });
    }

    const dataUrl = await QRCode.toDataURL(text, {
      width: 280,
      margin: 1,
      color: {
        dark: '#00f2fe',
        light: '#070e24'
      }
    });

    res.json({ success: true, mode: 'auto', dataUrl, text });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Test SMTP Connection & Send Test Email (Protected with Password: 11223344)
app.post('/api/test-email', async (req, res) => {
  if (!verifyAdminAuth(req)) {
    return res.status(401).json({ success: false, message: 'Password pengaturan salah!' });
  }

  const { smtpConfig, testRecipient } = req.body;
  const current = readJSON(SETTINGS_FILE, {});
  const effectiveConfig = {
    ...(current.smtp || {}),
    ...(smtpConfig || {})
  };

  try {
    const result = await testSmtpConnection(effectiveConfig, testRecipient);
    res.json({ 
      success: true, 
      message: `Koneksi SMTP berhasil! Email tes berhasil dikirim ke ${testRecipient || 'server verifikasi'}.`,
      result 
    });
  } catch (err) {
    console.error('SMTP Test Failed:', err);
    res.status(400).json({ 
      success: false, 
      message: `Gagal verifikasi SMTP: ${err.message}` 
    });
  }
});

// 7. Register Participant (with automatic Zoom Link & Email Dispatch)
app.post('/api/register', uploadAsset.single('sampleFile'), async (req, res) => {
  try {
    const { name, company, jobTitle, city, email, whatsapp, industry, bottlenecks } = req.body;

    if (!name || !company || !email) {
      return res.status(400).json({
        success: false,
        message: 'Mohon lengkapi Nama, Perusahaan, dan Email Perusahaan.'
      });
    }

    // Parse bottlenecks
    let parsedBottlenecks = [];
    if (bottlenecks) {
      if (Array.isArray(bottlenecks)) {
        parsedBottlenecks = bottlenecks;
      } else {
        try {
          parsedBottlenecks = JSON.parse(bottlenecks);
        } catch {
          parsedBottlenecks = [bottlenecks];
        }
      }
    }

    // Unique Registration ID
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const leadId = `REG-2026-${randomHex}`;

    // Handle Asset File
    let assetInfo = {
      hasAsset: false,
      assetFilename: null,
      assetOriginalName: null,
      assetSize: null
    };

    if (req.file) {
      const sizeMB = (req.file.size / (1024 * 1024)).toFixed(1) + ' MB';
      assetInfo = {
        hasAsset: true,
        assetFilename: req.file.filename,
        assetOriginalName: req.file.originalname,
        assetSize: sizeMB
      };
    }

    const newLead = {
      id: leadId,
      name: name.trim(),
      company: company.trim(),
      jobTitle: (jobTitle || '').trim(),
      city: (city || '').trim(),
      email: email.trim().toLowerCase(),
      whatsapp: (whatsapp || '').trim(),
      industry: industry || 'Technology',
      bottlenecks: parsedBottlenecks,
      status: 'Confirmed',
      ...assetInfo,
      registeredAt: new Date().toISOString(),
      emailSent: true,
      emailSentAt: new Date().toISOString()
    };

    // Save lead
    const leads = readJSON(LEADS_FILE, []);
    leads.unshift(newLead);
    writeJSON(LEADS_FILE, leads);

    // Dispatch Confirmation Email (Sent directly to corporate email)
    const settings = readJSON(SETTINGS_FILE, {});
    const emailResult = await sendConfirmationEmail(settings, newLead);

    res.json({
      success: true,
      message: 'Registrasi berhasil dikonfirmasi! Undangan Zoom telah diproses.',
      lead: newLead,
      zoom: settings.event?.zoom || {
        meetingUrl: 'https://zoom.us/j/84920389102?pwd=BeyondOrdinary2026',
        meetingId: '849 2038 9102',
        passcode: 'BEYOND2026',
        qrMode: 'auto'
      },
      event: settings.event,
      emailResult: emailResult
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Get Leads List (with search & filter)
app.get('/api/leads', (req, res) => {
  const { search, status, industry } = req.query;
  let leads = readJSON(LEADS_FILE, []);

  if (search) {
    const q = search.toLowerCase();
    leads = leads.filter(
      (l) =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.company && l.company.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.id && l.id.toLowerCase().includes(q)) ||
        (l.city && l.city.toLowerCase().includes(q))
    );
  }

  if (status && status !== 'all') {
    leads = leads.filter((l) => l.status === status);
  }

  if (industry && industry !== 'all') {
    leads = leads.filter((l) => l.industry === industry);
  }

  res.json({ success: true, count: leads.length, leads });
});

// 9. Update Lead Status
app.patch('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const leads = readJSON(LEADS_FILE, []);
  const lead = leads.find((l) => l.id === id);

  if (!lead) {
    return res.status(404).json({ success: false, message: 'Peserta tidak ditemukan' });
  }

  if (status) lead.status = status;
  writeJSON(LEADS_FILE, leads);
  res.json({ success: true, lead });
});

// 10. Delete Lead
app.delete('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  let leads = readJSON(LEADS_FILE, []);
  const initialLength = leads.length;
  leads = leads.filter((l) => l.id !== id);

  if (leads.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Peserta tidak ditemukan' });
  }

  writeJSON(LEADS_FILE, leads);
  res.json({ success: true, message: 'Peserta berhasil dihapus' });
});

// 11. Export Leads to CSV
app.get('/api/leads/export', (req, res) => {
  const leads = readJSON(LEADS_FILE, []);
  const headers = [
    'Registration ID',
    'Nama Lengkap',
    'Perusahaan',
    'Jabatan',
    'Email Kantor',
    'Nomor WhatsApp',
    'Kota/Region',
    'Sektor Industri',
    'Tantangan Hardware',
    'Ada Sample File',
    'Nama File Asli',
    'Ukuran File',
    'Status',
    'Waktu Registrasi'
  ];

  const rows = leads.map((l) => [
    `"${l.id || ''}"`,
    `"${(l.name || '').replace(/"/g, '""')}"`,
    `"${(l.company || '').replace(/"/g, '""')}"`,
    `"${(l.jobTitle || '').replace(/"/g, '""')}"`,
    `"${(l.email || '').replace(/"/g, '""')}"`,
    `"${(l.whatsapp || '').replace(/"/g, '""')}"`,
    `"${(l.city || '').replace(/"/g, '""')}"`,
    `"${(l.industry || '').replace(/"/g, '""')}"`,
    `"${(Array.isArray(l.bottlenecks) ? l.bottlenecks.join(', ') : '').replace(/"/g, '""')}"`,
    l.hasAsset ? 'Ya' : 'Tidak',
    `"${(l.assetOriginalName || '').replace(/"/g, '""')}"`,
    `"${l.assetSize || ''}"`,
    `"${l.status || 'Confirmed'}"`,
    `"${l.registeredAt || ''}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=leads_beyond_ordinary_${Date.now()}.csv`);
  res.send(csvContent);
});

// 12. Resend Confirmation Email
app.post('/api/leads/:id/resend-email', async (req, res) => {
  const { id } = req.params;
  const leads = readJSON(LEADS_FILE, []);
  const lead = leads.find((l) => l.id === id);

  if (!lead) {
    return res.status(404).json({ success: false, message: 'Peserta tidak ditemukan' });
  }

  const settings = readJSON(SETTINGS_FILE, {});
  const result = await sendConfirmationEmail(settings, lead);

  lead.emailSent = true;
  lead.emailSentAt = new Date().toISOString();
  writeJSON(LEADS_FILE, leads);

  res.json({ success: true, message: `Email konfirmasi berhasil dikirim ke ${lead.email}`, result });
});

// 13. List Asset Storage Files
app.get('/api/assets', (req, res) => {
  const leads = readJSON(LEADS_FILE, []);
  try {
    const files = fs.readdirSync(ASSETS_DIR);
    const assetList = files.map((filename) => {
      const filePath = path.join(ASSETS_DIR, filename);
      const stat = fs.statSync(filePath);
      const matchedLead = leads.find((l) => l.assetFilename === filename);
      return {
        filename,
        url: `/uploads/assets/${filename}`,
        sizeMB: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
        createdAt: stat.birthtime || stat.mtime,
        leadName: matchedLead ? matchedLead.name : 'Unknown Participant',
        leadCompany: matchedLead ? matchedLead.company : '-',
        originalName: matchedLead ? matchedLead.assetOriginalName : filename
      };
    });
    res.json({ success: true, assets: assetList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 14. Delete Asset File
app.delete('/api/assets/:filename', (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(ASSETS_DIR, safeFilename);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      const leads = readJSON(LEADS_FILE, []);
      leads.forEach((l) => {
        if (l.assetFilename === safeFilename) {
          l.hasAsset = false;
          l.assetFilename = null;
        }
      });
      writeJSON(LEADS_FILE, leads);
      return res.json({ success: true, message: 'Asset berhasil dihapus' });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }
  res.status(404).json({ success: false, message: 'File tidak ditemukan' });
});

// 15. Download ICS Calendar file for specific Lead
app.get('/api/calendar/:leadId', (req, res) => {
  const { leadId } = req.params;
  const leads = readJSON(LEADS_FILE, []);
  const settings = readJSON(SETTINGS_FILE, {});
  const lead = leads.find((l) => l.id === leadId) || {
    id: leadId,
    name: 'Peserta Masterclass',
    company: 'Company'
  };

  const ics = generateIcsContent(settings.event, lead);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=Event_Schedule_${lead.id}.ics`);
  res.send(ics);
});

// 16. Preview Rendered Email HTML
app.get('/api/email-preview/:leadId', async (req, res) => {
  const { leadId } = req.params;
  const leads = readJSON(LEADS_FILE, []);
  const settings = readJSON(SETTINGS_FILE, {});
  const lead = leads.find((l) => l.id === leadId) || leads[0] || {
    id: 'REG-SAMPLE',
    name: 'Budi Santoso',
    company: 'ArchiTech Studio',
    jobTitle: 'Lead Architect',
    city: 'Jakarta',
    email: 'budi.santoso@architech.co.id'
  };

  const html = await generateEmailHtml(settings.event, lead);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Beyond Ordinary - Registration Web App Running!`);
  console.log(`🌐 Landing Page: http://localhost:${PORT}`);
  console.log(`⚙️  Admin Portal: http://localhost:${PORT}/admin.html`);
  console.log(`🔑 Password Pengaturan: 11223344`);
  console.log(`====================================================`);
});

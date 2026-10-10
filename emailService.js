const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const QRCode = require('qrcode');

// Helper to make HTTPS requests without external dependencies
function postJson(urlStr, headers, bodyData) {
  if (typeof fetch !== 'undefined') {
    return fetch(urlStr, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData)
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Resend API Error (HTTP ${res.status}): ${JSON.stringify(data)}`);
      }
      return data;
    });
  }

  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const dataString = JSON.stringify(bodyData);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(json.message || `Resend API Error (HTTP ${res.statusCode}): ${body}`));
          }
        } catch {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`Resend API Error (HTTP ${res.statusCode}): ${body}`));
          }
        }
      });
    });
    req.on('error', reject);
    req.write(dataString);
    req.end();
  });
}

// Resend Email Dispatcher (Runs over HTTPS Port 443 - 100% Works on Railway)
async function sendResendEmail(apiKey, { from, to, subject, html, attachments }) {
  if (!apiKey) {
    throw new Error('Resend API Key tidak ditemukan. Pastikan sudah diisi di Admin atau Environment Variables.');
  }

  const payload = {
    from: from || 'Beyond Ordinary <onboarding@resend.dev>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html
  };

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments.map((att) => ({
      filename: att.filename,
      content: Buffer.isBuffer(att.content)
        ? att.content.toString('base64')
        : Buffer.from(att.content).toString('base64')
    }));
  }

  return postJson(
    'https://api.resend.com/emails',
    {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    payload
  );
}

const EMAIL_LOGS_PATH = path.join(__dirname, 'data', 'email_logs.json');

// Generate iCalendar (.ics) content string
function generateIcsContent(event, lead) {
  const startDateStr = (event.date || '2026-10-24').replace(/-/g, '');
  const startTimeStr = (event.startTime || '13:00').replace(':', '') + '00';
  const endTimeStr = (event.endTime || '16:00').replace(':', '') + '00';
  
  const dtStart = `${startDateStr}T${startTimeStr}`;
  const dtEnd = `${startDateStr}T${endTimeStr}`;
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Beyond Ordinary//Tech Summit 2026//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:beyond-ordinary-${lead.id}@beyondordinary.tech`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Asia/Jakarta:${dtStart}`,
    `DTEND;TZID=Asia/Jakarta:${dtEnd}`,
    `SUMMARY:${event.title} - Live Zoom Masterclass`,
    `DESCRIPTION:Halo ${lead.name},\\n\\nTerima kasih telah mendaftar di ${event.title}.\\n\\nAKSES ZOOM MEETING:\\nLink: ${event.zoom.meetingUrl}\\nMeeting ID: ${event.zoom.meetingId}\\nPasscode: ${event.zoom.passcode}\\n\\nNama Peserta: ${lead.name}\\nPerusahaan: ${lead.company}\\nID Registrasi: ${lead.id}\\n\\nSampai jumpa di sesi live!`,
    `LOCATION:${event.zoom.meetingUrl}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Pengingat Zoom Meeting Beyond Ordinary (15 menit lagi)',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

// Generate sleek futuristic HTML email template with Scannable Barcode/QR Code
async function generateEmailHtml(event, lead) {
  const zoomUrl = event.zoom?.meetingUrl || '#';
  const meetingId = event.zoom?.meetingId || '849 2038 9102';
  const passcode = event.zoom?.passcode || 'BEYOND2026';
  const eventDate = event.displayDate || 'Sabtu, 24 Oktober 2026';
  const eventTime = event.displayTime || '13:00 - 16:00 WIB';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Konfirmasi Registrasi - ${event.title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #040814;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 640px;
      margin: 20px auto;
      background: #090e24;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .header-banner {
      background: linear-gradient(135deg, #091236 0%, #0d2354 50%, #170d38 100%);
      padding: 40px 32px;
      text-align: center;
      border-bottom: 2px solid #00f2fe;
      position: relative;
    }
    .brand-badge {
      display: inline-block;
      padding: 6px 14px;
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      font-weight: 700;
      color: #00f2fe;
      background: rgba(0, 242, 254, 0.12);
      border: 1px solid rgba(0, 242, 254, 0.35);
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    .banner-title {
      font-size: 26px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 8px;
      letter-spacing: -0.5px;
    }
    .banner-sub {
      color: #94a3b8;
      font-size: 14px;
      margin: 0;
    }
    .content {
      padding: 32px 30px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 14px;
    }
    .text-p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 20px;
    }
    .zoom-box {
      background: linear-gradient(145deg, #0f1c3f 0%, #152554 100%);
      border: 1px solid #38bdf8;
      border-radius: 14px;
      padding: 24px;
      margin: 24px 0;
      box-shadow: 0 10px 25px rgba(0, 242, 254, 0.08);
      text-align: center;
    }
    .zoom-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #38bdf8;
      font-weight: 700;
      margin: 0 0 10px;
    }
    .btn-zoom {
      display: inline-block;
      background: linear-gradient(90deg, #00f2fe 0%, #4facfe 100%);
      color: #040918 !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 28px;
      border-radius: 10px;
      margin: 10px 0 16px;
      box-shadow: 0 4px 15px rgba(0, 242, 254, 0.4);
    }
    .zoom-creds {
      background: rgba(0, 0, 0, 0.35);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      display: inline-block;
      text-align: left;
      margin-top: 6px;
      color: #e2e8f0;
      width: 85%;
      box-sizing: border-box;
    }
    .badge-info {
      background: #111a38;
      border: 1px solid #1e2d5c;
      border-radius: 12px;
      padding: 18px;
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 13px;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #64748b;
    }
    .info-value {
      color: #f1f5f9;
      font-weight: 600;
    }
    .rundown-box {
      margin: 24px 0;
      background: #0c142c;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #1a274e;
    }
    .rundown-title {
      font-size: 14px;
      font-weight: 700;
      color: #38bdf8;
      margin: 0 0 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .rundown-item {
      padding: 8px 0;
      border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
      font-size: 13px;
    }
    .rundown-item:last-child {
      border-bottom: none;
    }
    .rundown-time {
      color: #a855f7;
      font-weight: 700;
      margin-right: 8px;
    }
    .footer {
      background: #060914;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #172033;
    }
    .vip-tag {
      background: #f59e0b;
      color: #000;
      font-size: 11px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
      display: inline-block;
      margin-left: 6px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header-banner">
      <div class="brand-badge">⚡ OFFICIAL CONFIRMATION PASS</div>
      <h1 class="banner-title">${event.title}</h1>
      <p class="banner-sub">${event.subtitle}</p>
    </div>

    <div class="content">
      <h2 class="greeting">Halo ${lead.name},</h2>
      <p class="text-p">
        Pendaftaran Anda untuk mengikuti sesi virtual eksklusif telah <strong>berhasil dikonfirmasi</strong>. Simpan email ini dan link Zoom berikut untuk bergabung ke dalam siaran langsung pada jadwal yang telah ditentukan.
      </p>

      <!-- Zoom Meeting Card with Link -->
      <div class="zoom-box">
        <div class="zoom-title">Akses Link Zoom Meeting Langsung</div>
        <div>
          <a href="${zoomUrl}" target="_blank" class="btn-zoom">
            🚀 Buka & Masuk Zoom Meeting
          </a>
        </div>
        <div class="zoom-creds">
          <div><strong>Link URL:</strong> <span style="color: #00f2fe; word-break: break-all;">${zoomUrl}</span></div>
          <div style="margin-top: 4px;"><strong>Meeting ID:</strong> ${meetingId}</div>
          <div style="margin-top: 4px;"><strong>Passcode:</strong> ${passcode}</div>
          <div style="margin-top: 4px;"><strong>Waktu:</strong> ${eventDate} (${eventTime})</div>
        </div>
      </div>

      <!-- Registration Info -->
      <div class="badge-info">
        <div class="info-row">
          <span class="info-label">ID Registrasi</span>
          <span class="info-value">${lead.id} ${lead.status === 'VIP' ? '<span class="vip-tag">VIP</span>' : ''}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Nama Peserta</span>
          <span class="info-value">${lead.name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Perusahaan / Instansi</span>
          <span class="info-value">${lead.company}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Jabatan</span>
          <span class="info-value">${lead.jobTitle || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email Terdaftar</span>
          <span class="info-value">${lead.email}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Lokasi / Region</span>
          <span class="info-value">${lead.city || '-'}</span>
        </div>
        ${lead.hasAsset ? `
        <div class="info-row">
          <span class="info-label">Sample File Terupload</span>
          <span class="info-value" style="color: #38bdf8;">✓ ${lead.assetOriginalName || 'Uploaded'} (Untuk Live Render Test)</span>
        </div>` : ''}
      </div>

      <!-- Rundown Class -->
      <div class="rundown-box">
        <div class="rundown-title">📅 Rundown Kelas & Live Workshop</div>
        <div class="rundown-item">
          <span class="rundown-time">13.00 - 13.45</span>
          <strong>Class 1: BIM & Computational Architecture</strong>
        </div>
        <div class="rundown-item">
          <span class="rundown-time">13.45 - 14.30</span>
          <strong>Class 2: VFX, Dynamic FX & CGI Pipeline</strong>
        </div>
        <div class="rundown-item">
          <span class="rundown-time">14.30 - 15.15</span>
          <strong>Class 3: Enterprise AI & Neural Rendering</strong>
        </div>
        <div class="rundown-item">
          <span class="rundown-time">15.15 - 16.00</span>
          <strong>Class 4: Unreal Engine 5 Real-Time Rendering</strong>
        </div>
      </div>

      <p class="text-p" style="font-size: 13px; color: #64748b; margin-top: 20px;">
        💡 <strong>Catatan:</strong> Undangan kalender resmi (.ics) telah dilampirkan pada email ini. Anda dapat mengkliknya untuk langsung menyinkronkan jadwal ke Apple Calendar, Google Calendar, atau Microsoft Outlook.
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px;">${event.title} • Organised by ${event.organizer?.name || 'Event Team'}</p>
      <p style="margin: 0; font-size: 11px;">Jika Anda memiliki pertanyaan teknis, hubungi panitia melalui email: ${event.organizer?.email || 'events@beyondordinary.tech'}</p>
    </div>
  </div>
</body>
</html>`;
}

// Log email dispatch to file
function logEmailDispatch(record) {
  try {
    let logs = [];
    if (fs.existsSync(EMAIL_LOGS_PATH)) {
      const data = fs.readFileSync(EMAIL_LOGS_PATH, 'utf8');
      logs = JSON.parse(data || '[]');
    }
    logs.unshift(record);
    if (logs.length > 100) logs = logs.slice(0, 100);
    fs.writeFileSync(EMAIL_LOGS_PATH, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('Error logging email:', err);
  }
}

// Main Send Email Function
async function sendConfirmationEmail(settings, lead) {
  const event = settings.event;
  const smtp = settings.smtp || {};
  const htmlContent = await generateEmailHtml(event, lead);
  const icsContent = generateIcsContent(event, lead);
  const subject = `[Konfirmasi Zoom] Undangan Resmi: ${event.title} - ${lead.name}`;

  const emailRecord = {
    id: 'EML-' + Date.now(),
    leadId: lead.id,
    to: lead.email,
    subject: subject,
    sentAt: new Date().toISOString(),
    status: 'sent',
    mode: 'mock',
    html: htmlContent,
    zoomUrl: event.zoom.meetingUrl
  };

  // 1. Check if Resend API is configured and preferred (100% works on Railway via HTTPS 443)
  const resendApiKey = (smtp.resendApiKey || process.env.RESEND_API_KEY || '').trim();
  const isResendMode = smtp.provider === 'resend' || (!smtp.host && resendApiKey) || (smtp.enabled && resendApiKey && smtp.provider !== 'smtp');

  if (smtp.enabled && isResendMode && resendApiKey) {
    try {
      const fromAddress = smtp.from && smtp.from.trim()
        ? smtp.from.trim()
        : `"${event.title}" <onboarding@resend.dev>`;

      const resendResult = await sendResendEmail(resendApiKey, {
        from: fromAddress,
        to: lead.email,
        subject: subject,
        html: htmlContent,
        attachments: [
          {
            filename: 'Event_Schedule.ics',
            content: icsContent
          }
        ]
      });

      emailRecord.mode = 'resend-api';
      emailRecord.messageId = resendResult.id;
      emailRecord.status = 'sent';
      logEmailDispatch(emailRecord);
      return { success: true, mode: 'resend-api', record: emailRecord, id: resendResult.id };
    } catch (err) {
      console.warn('Resend API send failed, falling back to logged dispatch:', err.message);
      emailRecord.mode = 'resend-fallback';
      emailRecord.error = err.message;
      logEmailDispatch(emailRecord);
      return { success: false, mode: 'resend-fallback', error: err.message, record: emailRecord };
    }
  }

  // 2. Check if real SMTP is configured and enabled
  if (smtp.enabled && smtp.host && smtp.user) {
    try {
      const portNum = parseInt(smtp.port, 10) || 587;
      const isSecure = smtp.secure === true || portNum === 465;
      const cleanPass = (smtp.pass || '').replace(/\s+/g, '');

      const transporter = nodemailer.createTransport({
        host: smtp.host.trim(),
        port: portNum,
        secure: isSecure,
        auth: {
          user: smtp.user.trim(),
          pass: cleanPass
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000
      });

      const mailOptions = {
        from: smtp.from ? smtp.from.trim() : `"${event.title}" <${smtp.user.trim()}>`,
        to: lead.email,
        subject: subject,
        html: htmlContent,
        attachments: [
          {
            filename: 'Event_Schedule.ics',
            content: icsContent,
            contentType: 'text/calendar; charset=utf-8; method=REQUEST'
          }
        ]
      };

      const info = await transporter.sendMail(mailOptions);
      emailRecord.mode = 'live-smtp';
      emailRecord.messageId = info.messageId;
      emailRecord.status = 'sent';
      logEmailDispatch(emailRecord);
      return { success: true, mode: 'live-smtp', record: emailRecord };
    } catch (err) {
      console.warn('Real SMTP send failed, falling back to logged dispatch:', err.message);
      emailRecord.mode = 'smtp-fallback';
      emailRecord.error = err.message;
      logEmailDispatch(emailRecord);
      return { success: false, mode: 'smtp-fallback', error: err.message, record: emailRecord };
    }
  }

  // Mock / Simulation mode (instant, robust, previewable)
  logEmailDispatch(emailRecord);
  return { success: true, mode: 'mock', record: emailRecord };
}

// Function to test SMTP or Resend connection and send a test email
async function testSmtpConnection(smtpConfig, testToEmail) {
  const resendApiKey = (smtpConfig.resendApiKey || process.env.RESEND_API_KEY || '').trim();
  const isResendMode = smtpConfig.provider === 'resend' || (!smtpConfig.host && resendApiKey);

  // --- BRANCH A: RESEND API (HTTPS PORT 443) ---
  if (isResendMode || (resendApiKey && smtpConfig.provider !== 'smtp')) {
    if (!resendApiKey) {
      throw new Error('Resend API Key wajib diisi. Masukkan API Key di form pengaturan atau di Railway Variables (RESEND_API_KEY).');
    }

    const fromAddress = smtpConfig.from && smtpConfig.from.trim()
      ? smtpConfig.from.trim()
      : '"Beyond Ordinary Test" <onboarding@resend.dev>';

    const targetEmail = testToEmail && testToEmail.trim()
      ? testToEmail.trim()
      : 'delivered@resend.dev';

    const testHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #050a1a; color: #fff; padding: 30px; border-radius: 12px; border: 1px solid #00f2fe; max-width: 580px; margin: 0 auto;">
        <div style="display: inline-block; background: rgba(0, 242, 254, 0.15); color: #00f2fe; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; letter-spacing: 1px; margin-bottom: 12px;">
          VERIFIKASI RESEND API BERHASIL (PORT 443 HTTPS)
        </div>
        <h2 style="color: #ffffff; margin: 0 0 10px;">🎉 Resend API Terhubung Normal di Railway!</h2>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
          Selamat! Server email via <strong>Resend API</strong> berhasil mengirim email verifikasi ini.
        </p>
        <div style="background: rgba(0, 242, 254, 0.08); border-left: 3px solid #00f2fe; padding: 12px 16px; margin: 20px 0; font-size: 13px;">
          Pengiriman menggunakan koneksi HTTPS (Port 443), sehingga <strong>100% aman dan tidak terblokir oleh firewall Railway</strong>.
        </div>
        <hr style="border: 0; border-top: 1px solid #1e293b; margin: 20px 0;">
        <small style="color: #64748b;">Waktu Verifikasi: ${new Date().toLocaleString('id-ID')}</small>
      </div>
    `;

    try {
      const resendRes = await sendResendEmail(resendApiKey, {
        from: fromAddress,
        to: targetEmail,
        subject: '✅ [Tes Berhasil via Resend API] Verifikasi Pengiriman Email Beyond Ordinary di Railway',
        html: testHtml
      });
      return { success: true, mode: 'resend', messageId: resendRes.id };
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('only send testing emails to your own email address')) {
        throw new Error('Resend membatasi uji coba hanya ke email akun Resend Anda sendiri (karena belum menambahkan domain kustom). Masukkan email yang Anda gunakan saat mendaftar akun Resend, atau verifikasi domain di resend.com/domains.');
      }
      throw new Error(`Gagal mengirim via Resend: ${msg}`);
    }
  }

  // --- BRANCH B: TRADITIONAL SMTP ---
  if (!smtpConfig.host || !smtpConfig.user) {
    throw new Error('Host dan Username SMTP wajib diisi.');
  }

  const portNum = parseInt(smtpConfig.port, 10) || 587;
  const isSecure = smtpConfig.secure === true || portNum === 465;
  const cleanPass = (smtpConfig.pass || '').replace(/\s+/g, '');

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host.trim(),
    port: portNum,
    secure: isSecure,
    auth: {
      user: smtpConfig.user.trim(),
      pass: cleanPass
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 18000
  });

  try {
    // 1. Verify SMTP connection
    await transporter.verify();

    // 2. If test recipient is provided, send a real test email
    if (testToEmail) {
      const fromAddress = smtpConfig.from && smtpConfig.from.trim() 
        ? smtpConfig.from.trim() 
        : `"Beyond Ordinary Test" <${smtpConfig.user.trim()}>`;

      const info = await transporter.sendMail({
        from: fromAddress,
        to: testToEmail.trim(),
        subject: '✅ [Tes Berhasil] Verifikasi Koneksi Email SMTP Beyond Ordinary',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #050a1a; color: #fff; padding: 30px; border-radius: 12px; border: 1px solid #00f2fe; max-width: 580px; margin: 0 auto;">
            <div style="display: inline-block; background: rgba(0, 242, 254, 0.15); color: #00f2fe; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; letter-spacing: 1px; margin-bottom: 12px;">
              VERIFIKASI SISTEM BERHASIL
            </div>
            <h2 style="color: #ffffff; margin: 0 0 10px;">🎉 Koneksi SMTP Anda Berfungsi Normal!</h2>
            <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
              Selamat! Server email SMTP Anda telah berhasil terhubung ke aplikasi registrasi online Beyond Ordinary.
            </p>
            <div style="background: rgba(0, 242, 254, 0.08); border-left: 3px solid #00f2fe; padding: 12px 16px; margin: 20px 0; font-size: 13px;">
              Setiap kali ada peserta baru yang mendaftar, mereka akan <strong>otomatis langsung menerima link Zoom Meeting</strong> dan undangan kalender (.ics) ke inbox mereka.
            </div>
            <hr style="border: 0; border-top: 1px solid #1e293b; margin: 20px 0;">
            <small style="color: #64748b;">Waktu Verifikasi: ${new Date().toLocaleString('id-ID')}</small>
          </div>
        `
      });
      return { success: true, messageId: info.messageId };
    }

    return { success: true };
  } catch (err) {
    const rawMsg = err.message || '';
    if (rawMsg.includes('535') || rawMsg.includes('Username and Password not accepted') || rawMsg.includes('BadCredentials')) {
      throw new Error('Google / Server email menolak login (Kode 535): Pastikan Verifikasi 2 Langkah sudah aktif di akun Google Anda, dan gunakan 16 karakter App Password dari myaccount.google.com/apppasswords (bukan password login biasa akun Google).');
    }
    if (rawMsg.includes('ETIMEDOUT') || rawMsg.includes('ECONNREFUSED') || rawMsg.includes('Connection timeout')) {
      throw new Error(`Koneksi ke host ${smtpConfig.host}:${portNum} gagal atau timeout. Jika Anda menggunakan Railway, port SMTP diblokir di paket gratis/Hobby. Disarankan beralih ke Resend API (HTTPS Port 443) yang tidak terblokir.`);
    }
    if (rawMsg.includes('ENOTFOUND')) {
      throw new Error(`Host server "${smtpConfig.host}" tidak ditemukan. Periksa kembali penulisan nama host.`);
    }
    throw new Error(rawMsg);
  }
}

module.exports = {
  sendConfirmationEmail,
  generateEmailHtml,
  generateIcsContent,
  testSmtpConnection
};

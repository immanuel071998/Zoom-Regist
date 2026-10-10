/**
 * Calendar Integration & Digital Pass Generator
 * Supports .ics download, Google Calendar sync, and VIP Pass Image Export with Real Scannable Barcode/QR Code
 */

const CalendarService = {
  // 1. Generate & Download .ICS file
  downloadIcs(event, lead) {
    const startDateStr = (event.date || '2026-10-24').replace(/-/g, '');
    const startTimeStr = (event.startTime || '13:00').replace(':', '') + '00';
    const endTimeStr = (event.endTime || '16:00').replace(':', '') + '00';

    const dtStart = `${startDateStr}T${startTimeStr}`;
    const dtEnd = `${startDateStr}T${endTimeStr}`;
    const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Beyond Ordinary//Tech Summit 2026//ID',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:beyond-${lead.id || 'reg'}@beyondordinary.tech`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;TZID=Asia/Jakarta:${dtStart}`,
      `DTEND;TZID=Asia/Jakarta:${dtEnd}`,
      `SUMMARY:${event.title} - Live Zoom Masterclass`,
      `DESCRIPTION:Halo ${lead.name || 'Peserta'},\\n\\nTerima kasih telah mendaftar di ${event.title}.\\n\\nAKSES ZOOM MEETING:\\nLink: ${event.zoom?.meetingUrl}\\nMeeting ID: ${event.zoom?.meetingId}\\nPasscode: ${event.zoom?.passcode}\\n\\nNama: ${lead.name}\\nPerusahaan: ${lead.company}\\nID Registrasi: ${lead.id}\\n\\nSampai jumpa di sesi live!`,
      `LOCATION:${event.zoom?.meetingUrl || 'Zoom Meeting'}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Pengingat Zoom Meeting (15 Menit Lagi)',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ];

    const icsContent = icsLines.join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Event_Schedule_${lead.id || 'Pass'}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },

  // 2. Open Google Calendar with prefilled event
  openGoogleCalendar(event, lead) {
    const startDateStr = (event.date || '2026-10-24').replace(/-/g, '');
    const startTimeStr = (event.startTime || '13:00').replace(':', '') + '00';
    const endTimeStr = (event.endTime || '16:00').replace(':', '') + '00';

    const dates = `${startDateStr}T${startTimeStr}Z/${startDateStr}T${endTimeStr}Z`;
    const title = encodeURIComponent(`${event.title} - Live Zoom Broadcast`);
    const details = encodeURIComponent(
      `Halo ${lead.name},\n\nTerima kasih telah mendaftar di ${event.title}.\n\nAKSES ZOOM MEETING:\nLink: ${event.zoom?.meetingUrl}\nMeeting ID: ${event.zoom?.meetingId}\nPasscode: ${event.zoom?.passcode}\n\nID Registrasi: ${lead.id}\nPerusahaan: ${lead.company}`
    );
    const location = encodeURIComponent(event.zoom?.meetingUrl || 'Zoom Online');

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
    window.open(gcalUrl, '_blank');
  },

  // 3. Generate & Download Futuristic VIP Digital Pass Ticket (PNG) with Real Scannable Barcode/QR
  async downloadDigitalPass(event, lead, qrImageUrl) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');

    // Background Gradient (Dark Tech Obsidian & Deep Blue)
    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    bgGrad.addColorStop(0, '#040814');
    bgGrad.addColorStop(0.5, '#0b1636');
    bgGrad.addColorStop(1, '#060a1c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 630);

    // Glowing Cyan Top & Bottom Accent Borders
    ctx.fillStyle = '#00f2fe';
    ctx.fillRect(0, 0, 1200, 8);
    ctx.fillStyle = '#b829ff';
    ctx.fillRect(0, 622, 1200, 8);

    // Neon Tech Arc Lines
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(600, 315, 450, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(184, 41, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(600, 315, 320, 0, Math.PI * 2);
    ctx.stroke();

    // Ticket Divider Dashed Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(850, 40);
    ctx.lineTo(850, 590);
    ctx.stroke();
    ctx.setLineDash([]);

    // Header Badge
    ctx.fillStyle = 'rgba(0, 242, 254, 0.12)';
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(80, 50, 320, 38, 19);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('⚡ OFFICIAL ATTENDEE PASS', 110, 74);

    // Event Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px -apple-system, sans-serif';
    ctx.fillText(event.title || 'Beyond Ordinary 2026', 80, 140);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px -apple-system, sans-serif';
    ctx.fillText(event.subtitle || 'Innovation. Performance. Real Impact.', 80, 175);

    // Attendee Card Container (Left side)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(80, 215, 720, 360, 16);
    ctx.fill();
    ctx.stroke();

    // Attendee Details
    ctx.fillStyle = '#64748b';
    ctx.font = '13px monospace';
    ctx.fillText('NAMA PESERTA / ATTENDEE', 110, 260);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px -apple-system, sans-serif';
    ctx.fillText(lead.name || 'Participant Name', 110, 295);

    ctx.fillStyle = '#64748b';
    ctx.font = '13px monospace';
    ctx.fillText('PERUSAHAAN / COMPANY', 110, 345);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.fillText(lead.company || '-', 110, 375);

    ctx.fillStyle = '#64748b';
    ctx.font = '13px monospace';
    ctx.fillText('JABATAN & KOTA', 450, 345);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 18px -apple-system, sans-serif';
    ctx.fillText(`${lead.jobTitle || '-'} • ${lead.city || '-'}`, 450, 375);

    // Bottom row in attendee card (Zoom credentials)
    ctx.fillStyle = 'rgba(0, 242, 254, 0.08)';
    ctx.fillRect(100, 420, 680, 130);
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
    ctx.strokeRect(100, 420, 680, 130);

    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('ZOOM MEETING ACCESS CREDENTIALS', 125, 450);

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px monospace';
    ctx.fillText(`Meeting ID: ${event.zoom?.meetingId || '849 2038 9102'}`, 125, 485);
    ctx.fillText(`Passcode  : ${event.zoom?.passcode || 'BEYOND2026'}`, 125, 515);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 15px -apple-system, sans-serif';
    ctx.fillText(`${event.displayDate || '24 Okt 2026'} (${event.displayTime || '13:00 WIB'})`, 460, 500);

    // Right Side Stub (Ticket Verification)
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('REGISTRATION ID', 880, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(lead.id || 'REG-2026-0000', 880, 135);

    // Draw Barcode / QR Code in Right Stub
    const qrX = 890;
    const qrY = 180;
    const qrSize = 220;

    const renderDownload = () => {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px monospace';
      ctx.fillText('SCAN FOR LIVE ZOOM ACCESS', 900, 435);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 14px -apple-system, sans-serif';
      ctx.fillText('✓ VERIFIED TICKET', 935, 470);

      // Trigger Download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `VIP_Pass_${lead.id || 'Beyond2026'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (qrImageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.fillStyle = '#070e24';
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
        ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
        renderDownload();
      };
      img.onerror = () => {
        // Fallback placeholder box
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
        renderDownload();
      };
      img.src = qrImageUrl;
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      renderDownload();
    }
  }
};

window.CalendarService = CalendarService;

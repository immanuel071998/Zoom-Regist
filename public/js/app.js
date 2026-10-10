/**
 * Beyond Ordinary 2026 - Registration App Controller
 * Manages Multi-step registration, file upload, Zoom credentials, QR Code preview, and Email Preview.
 */

// Global Toast function
window.showToast = function (message, duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

const RegistrationApp = {
  currentStep: 1,
  totalSteps: 3,
  selectedFile: null,
  submittedLead: null,
  eventSettings: null,
  currentQrDataUrl: '',

  init() {
    this.bindElements();
    this.bindEvents();
    this.loadEventData();
  },

  bindElements() {
    this.form = document.getElementById('registration-form');
    this.step1El = document.getElementById('step-1-container');
    this.step2El = document.getElementById('step-2-container');
    this.step3El = document.getElementById('step-3-container');

    this.btnToStep2 = document.getElementById('btn-to-step-2');
    this.btnBackToStep1 = document.getElementById('btn-back-to-step-1');
    this.btnSubmit = document.getElementById('btn-submit-registration');

    // Step indicators
    this.stepNodes = document.querySelectorAll('.reg-step-node');
    this.stepLineFill = document.querySelector('.step-line-fill');

    // Dropzone
    this.dropzone = document.getElementById('sample-dropzone');
    this.fileInput = document.getElementById('sample-file-input');
    this.filePreview = document.getElementById('sample-file-preview');
    this.fileNameEl = document.getElementById('sample-file-name');
    this.fileSizeEl = document.getElementById('sample-file-size');
    this.btnRemoveFile = document.getElementById('btn-remove-sample');

    // Step 3 elements
    this.zoomUrlText = document.getElementById('zoom-url-text');
    this.btnCopyZoom = document.getElementById('btn-copy-zoom');
    this.btnJoinZoom = document.getElementById('btn-join-zoom');
    this.zoomMeetingId = document.getElementById('zoom-meeting-id');
    this.zoomPasscode = document.getElementById('zoom-passcode');
    this.confAttendeeName = document.getElementById('conf-attendee-name');
    this.confAttendeeCompany = document.getElementById('conf-attendee-company');
    this.confAttendeeId = document.getElementById('conf-attendee-id');
    this.confAttendeeEmail = document.getElementById('conf-attendee-email');
    this.confQrImage = document.getElementById('conf-qr-image');

    // Calendar & Pass buttons
    this.btnDownloadIcs = document.getElementById('btn-download-ics');
    this.btnGoogleCal = document.getElementById('btn-google-cal');
    this.btnDownloadPass = document.getElementById('btn-download-pass');
    this.btnPreviewEmail = document.getElementById('btn-preview-email');
    this.btnResendEmail = document.getElementById('btn-resend-email');

    // Email Modal
    this.emailModal = document.getElementById('email-preview-modal');
    this.emailIframe = document.getElementById('email-preview-iframe');
    this.closeEmailModalBtn = document.getElementById('close-email-modal-btn');
  },

  bindEvents() {
    // Navigation between steps
    if (this.btnToStep2) {
      this.btnToStep2.addEventListener('click', () => {
        if (this.validateStep1()) {
          this.goToStep(2);
        }
      });
    }

    if (this.btnBackToStep1) {
      this.btnBackToStep1.addEventListener('click', () => {
        this.goToStep(1);
      });
    }

    // Submit form
    if (this.btnSubmit) {
      this.btnSubmit.addEventListener('click', (e) => {
        e.preventDefault();
        this.submitRegistration();
      });
    }

    // File Dropzone Handling
    if (this.dropzone && this.fileInput) {
      this.dropzone.addEventListener('click', () => this.fileInput.click());

      this.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.dropzone.classList.add('dragover');
      });

      this.dropzone.addEventListener('dragleave', () => {
        this.dropzone.classList.remove('dragover');
      });

      this.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.setUploadedFile(e.dataTransfer.files[0]);
        }
      });

      this.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.setUploadedFile(e.target.files[0]);
        }
      });
    }

    if (this.btnRemoveFile) {
      this.btnRemoveFile.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearUploadedFile();
      });
    }

    // Zoom link copy
    if (this.btnCopyZoom) {
      this.btnCopyZoom.addEventListener('click', () => {
        if (this.eventSettings?.zoom?.meetingUrl) {
          navigator.clipboard.writeText(this.eventSettings.zoom.meetingUrl);
          window.showToast('✓ Link Zoom berhasil disalin ke clipboard!');
        }
      });
    }

    // Calendar & Pass Downloads
    if (this.btnDownloadIcs) {
      this.btnDownloadIcs.addEventListener('click', () => {
        if (this.submittedLead && this.eventSettings) {
          CalendarService.downloadIcs(this.eventSettings, this.submittedLead);
          window.showToast('Mengunduh file kalender .ics...');
        }
      });
    }

    if (this.btnGoogleCal) {
      this.btnGoogleCal.addEventListener('click', () => {
        if (this.submittedLead && this.eventSettings) {
          CalendarService.openGoogleCalendar(this.eventSettings, this.submittedLead);
        }
      });
    }

    if (this.btnDownloadPass) {
      this.btnDownloadPass.addEventListener('click', () => {
        if (this.submittedLead && this.eventSettings) {
          CalendarService.downloadDigitalPass(this.eventSettings, this.submittedLead, this.currentQrDataUrl);
          window.showToast('Membuat & mengunduh Kartu Digital VIP Pass...');
        }
      });
    }

    // Email Preview Modal
    if (this.btnPreviewEmail) {
      this.btnPreviewEmail.addEventListener('click', () => {
        if (this.submittedLead) {
          this.openEmailModal(this.submittedLead.id);
        }
      });
    }

    if (this.closeEmailModalBtn) {
      this.closeEmailModalBtn.addEventListener('click', () => {
        this.closeEmailModal();
      });
    }

    // Resend Email
    if (this.btnResendEmail) {
      this.btnResendEmail.addEventListener('click', async () => {
        if (!this.submittedLead) return;
        this.btnResendEmail.disabled = true;
        this.btnResendEmail.textContent = 'Mengirim...';
        try {
          const res = await fetch(`/api/leads/${this.submittedLead.id}/resend-email`, { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            window.showToast('✓ Email konfirmasi berhasil dikirimkan ulang!');
          }
        } catch (e) {
          window.showToast('Gagal kirim ulang email: ' + e.message);
        } finally {
          this.btnResendEmail.disabled = false;
          this.btnResendEmail.textContent = 'Kirim Ulang Email';
        }
      });
    }
  },

  async loadEventData() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        this.eventSettings = data.settings.event;
        this.renderEventDetails(data.settings);
      }
    } catch (e) {
      console.warn('Error loading event settings:', e);
    }
  },

  renderEventDetails(settings) {
    const event = settings.event || {};
    const titleEl = document.getElementById('hero-event-title');
    const dateEl = document.getElementById('hero-event-date');
    const timeEl = document.getElementById('hero-event-time');

    if (titleEl && event.title) titleEl.textContent = event.title;
    if (dateEl && event.displayDate) dateEl.textContent = event.displayDate;
    if (timeEl && event.displayTime) timeEl.textContent = event.displayTime;

    // Render Rundown
    const rundownContainer = document.getElementById('rundown-list-container');
    if (rundownContainer && settings.rundown) {
      rundownContainer.innerHTML = settings.rundown.map((item) => `
        <div class="glass-card rundown-card glow-hover">
          <div class="rundown-time-badge">${item.time}</div>
          <h4 class="rundown-class-title">${item.title}</h4>
          <div class="rundown-speaker">${item.speaker || ''}</div>
          <p class="rundown-desc">${item.desc}</p>
        </div>
      `).join('');
    }
  },

  validateStep1() {
    const name = document.getElementById('reg-name').value.trim();
    const company = document.getElementById('reg-company').value.trim();
    const jobTitle = document.getElementById('reg-job-title').value.trim();
    const city = document.getElementById('reg-city').value.trim();
    const email = document.getElementById('reg-email').value.trim();

    if (!name) {
      window.showToast('⚠️ Mohon isi Nama Lengkap Anda.');
      document.getElementById('reg-name').focus();
      return false;
    }
    if (!company) {
      window.showToast('⚠️ Mohon isi Nama Perusahaan / Instansi.');
      document.getElementById('reg-company').focus();
      return false;
    }
    if (!jobTitle) {
      window.showToast('⚠️ Mohon isi Jabatan / Job Title Anda.');
      document.getElementById('reg-job-title').focus();
      return false;
    }
    if (!city) {
      window.showToast('⚠️ Mohon isi Kota / Region.');
      document.getElementById('reg-city').focus();
      return false;
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      window.showToast('⚠️ Mohon isi Email Perusahaan yang valid.');
      document.getElementById('reg-email').focus();
      return false;
    }
    return true;
  },

  goToStep(stepNumber) {
    this.currentStep = stepNumber;

    if (this.step1El) this.step1El.style.display = stepNumber === 1 ? 'block' : 'none';
    if (this.step2El) this.step2El.style.display = stepNumber === 2 ? 'block' : 'none';
    if (this.step3El) this.step3El.style.display = stepNumber === 3 ? 'block' : 'none';

    this.stepNodes.forEach((node, idx) => {
      const nodeStep = idx + 1;
      node.classList.remove('active', 'completed');
      if (nodeStep < stepNumber) {
        node.classList.add('completed');
      } else if (nodeStep === stepNumber) {
        node.classList.add('active');
      }
    });

    if (this.stepLineFill) {
      const fillPercentage = stepNumber === 1 ? '0%' : stepNumber === 2 ? '50%' : '100%';
      this.stepLineFill.style.width = fillPercentage;
    }
  },

  setUploadedFile(file) {
    this.selectedFile = file;
    if (this.dropzone && this.filePreview) {
      this.dropzone.style.display = 'none';
      this.filePreview.style.display = 'flex';
      this.fileNameEl.textContent = file.name;
      this.fileSizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    }
  },

  clearUploadedFile() {
    this.selectedFile = null;
    if (this.fileInput) this.fileInput.value = '';
    if (this.dropzone && this.filePreview) {
      this.dropzone.style.display = 'block';
      this.filePreview.style.display = 'none';
    }
  },

  async submitRegistration() {
    const name = document.getElementById('reg-name').value.trim();
    const company = document.getElementById('reg-company').value.trim();
    const jobTitle = document.getElementById('reg-job-title').value.trim();
    const city = document.getElementById('reg-city').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const whatsapp = document.getElementById('reg-whatsapp').value.trim();
    const industry = document.getElementById('reg-industry').value;

    const bottlenecks = [];
    document.querySelectorAll('input[name="bottleneck"]:checked').forEach((cb) => {
      bottlenecks.push(cb.value);
    });

    const formData = new FormData();
    formData.append('name', name);
    formData.append('company', company);
    formData.append('jobTitle', jobTitle);
    formData.append('city', city);
    formData.append('email', email);
    formData.append('whatsapp', whatsapp);
    formData.append('industry', industry);
    formData.append('bottlenecks', JSON.stringify(bottlenecks));

    if (this.selectedFile) {
      formData.append('sampleFile', this.selectedFile);
    }

    this.btnSubmit.disabled = true;
    this.btnSubmit.innerHTML = `
      <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
      </svg>
      Memproses Data & Mengirim Undangan...
    `;

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (data.success) {
        this.submittedLead = data.lead;
        this.eventSettings = data.event;

        await this.populateConfirmation(data);
        this.goToStep(3);
        window.showToast('🎉 Registrasi Berhasil! Undangan Zoom telah diproses.');
      } else {
        window.showToast('Gagal: ' + (data.message || 'Terjadi kesalahan'));
        this.btnSubmit.disabled = false;
        this.btnSubmit.textContent = 'Konfirmasi & Dapatkan Link Zoom';
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      window.showToast('Terjadi kesalahan jaringan: ' + err.message);
      this.btnSubmit.disabled = false;
      this.btnSubmit.textContent = 'Konfirmasi & Dapatkan Link Zoom';
    }
  },

  async populateConfirmation(data) {
    const lead = data.lead;
    const zoom = data.zoom;

    if (this.confAttendeeName) this.confAttendeeName.textContent = lead.name;
    if (this.confAttendeeCompany) this.confAttendeeCompany.textContent = lead.company;
    if (this.confAttendeeId) this.confAttendeeId.textContent = lead.id;
    if (this.confAttendeeEmail) this.confAttendeeEmail.textContent = lead.email;

    if (this.zoomUrlText) this.zoomUrlText.textContent = zoom.meetingUrl;
    if (this.btnJoinZoom) this.btnJoinZoom.href = zoom.meetingUrl;
    if (this.zoomMeetingId) this.zoomMeetingId.textContent = zoom.meetingId;
    if (this.zoomPasscode) this.zoomPasscode.textContent = zoom.passcode;

    // Load Real Scannable Barcode / QR Code
    try {
      const qrRes = await fetch(`/api/qrcode`);
      const qrData = await qrRes.json();
      if (qrData.success) {
        this.currentQrDataUrl = qrData.dataUrl || qrData.url;
        if (this.confQrImage) {
          this.confQrImage.src = this.currentQrDataUrl;
        }
      }
    } catch (e) {
      console.warn('Gagal memuat QR code:', e);
    }
  },

  openEmailModal(leadId) {
    if (this.emailModal && this.emailIframe) {
      this.emailIframe.src = `/api/email-preview/${leadId}`;
      this.emailModal.classList.add('open');
    }
  },

  closeEmailModal() {
    if (this.emailModal) {
      this.emailModal.classList.remove('open');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  RegistrationApp.init();

  // Admin portal modal handler from Landing Page
  const btnPortalAdmin = document.getElementById('btn-portal-admin');
  const indexAdminModal = document.getElementById('index-admin-modal');
  const indexAdminForm = document.getElementById('index-admin-form');
  const indexAdminPwd = document.getElementById('index-admin-pwd');
  const indexAdminError = document.getElementById('index-admin-error');
  const btnCancelIndexAdmin = document.getElementById('btn-cancel-index-admin');

  if (btnPortalAdmin) {
    btnPortalAdmin.addEventListener('click', () => {
      if (sessionStorage.getItem('admin_portal_unlocked') === 'true') {
        window.location.href = '/admin.html';
      } else {
        if (indexAdminError) indexAdminError.style.display = 'none';
        if (indexAdminPwd) indexAdminPwd.value = '';
        if (indexAdminModal) indexAdminModal.classList.add('open');
        setTimeout(() => indexAdminPwd?.focus(), 100);
      }
    });
  }

  if (btnCancelIndexAdmin && indexAdminModal) {
    btnCancelIndexAdmin.addEventListener('click', () => {
      indexAdminModal.classList.remove('open');
    });
  }

  if (indexAdminForm) {
    indexAdminForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pwd = (indexAdminPwd?.value || '').trim();
      if (pwd === '11223344') {
        sessionStorage.setItem('admin_portal_unlocked', 'true');
        window.location.href = '/admin.html';
      } else {
        if (indexAdminError) indexAdminError.style.display = 'block';
        if (indexAdminPwd) {
          indexAdminPwd.classList.add('shake');
          setTimeout(() => indexAdminPwd.classList.remove('shake'), 400);
          indexAdminPwd.focus();
        }
      }
    });
  }
});

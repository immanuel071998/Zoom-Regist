/**
 * Beyond Ordinary 2026 - Admin Portal Controller
 * Manages Leads Database, Asset Storage, Zoom Settings, Barcode/QR Management, and SMTP Tester with Full Portal Lock (11223344).
 */

// Global Toast function for Admin Portal
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

const AdminPortal = {
  currentTab: 'leads',
  allLeads: [],
  allAssets: [],
  settings: {},
  lastLeadCount: -1,

  init() {
    this.checkPortalAuth();
    this.bindPortalLock();
    this.bindTabs();
    this.bindSearchAndFilters();
    this.loadStatsAndLeads();
    this.loadAssets();
    this.loadSettings();
    this.bindSettingsForm();
    this.bindSmtpForm();
    this.bindQrUpload();
    this.bindTestEmail();
    this.startRealtimePolling();
  },

  checkPortalAuth() {
    const lockScreen = document.getElementById('admin-lock-screen');
    const mainContent = document.getElementById('admin-main-content');
    const isUnlocked = sessionStorage.getItem('admin_portal_unlocked') === 'true';

    if (isUnlocked) {
      if (lockScreen) lockScreen.style.display = 'none';
      if (mainContent) mainContent.style.display = 'block';
    } else {
      if (lockScreen) lockScreen.style.display = 'flex';
      if (mainContent) mainContent.style.display = 'none';
      setTimeout(() => {
        document.getElementById('admin-lock-password')?.focus();
      }, 100);
    }
  },

  bindPortalLock() {
    const form = document.getElementById('admin-lock-form');
    const input = document.getElementById('admin-lock-password');
    const errorEl = document.getElementById('admin-lock-error');
    const lockScreen = document.getElementById('admin-lock-screen');
    const mainContent = document.getElementById('admin-main-content');
    const logoutBtn = document.getElementById('btn-lock-logout');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const pwd = (input?.value || '').trim();

        if (pwd === '11223344') {
          sessionStorage.setItem('admin_portal_unlocked', 'true');
          if (errorEl) errorEl.style.display = 'none';
          if (lockScreen) lockScreen.style.display = 'none';
          if (mainContent) mainContent.style.display = 'block';
          window.showToast('✓ Akses Portal Admin Berhasil!');
          this.loadStatsAndLeads();
          this.loadSettings();
        } else {
          if (errorEl) errorEl.style.display = 'block';
          if (input) {
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 400);
            input.value = '';
            input.focus();
          }
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('admin_portal_unlocked');
        window.location.href = '/';
      });
    }
  },

  bindTabs() {
    document.querySelectorAll('.admin-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.admin-tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content-pane').forEach((pane) => {
      pane.style.display = pane.id === `tab-pane-${tab}` ? 'block' : 'none';
    });

    if (tab === 'assets') this.loadAssets();
    if (tab === 'leads') this.loadStatsAndLeads();
    if (tab === 'zoom-settings') this.updateQrPreview();
  },

  bindSearchAndFilters() {
    const searchInput = document.getElementById('leads-search-input');
    const statusFilter = document.getElementById('leads-status-filter');
    const industryFilter = document.getElementById('leads-industry-filter');
    const exportBtn = document.getElementById('btn-export-csv');

    if (searchInput) searchInput.addEventListener('input', () => this.filterLeads());
    if (statusFilter) statusFilter.addEventListener('change', () => this.filterLeads());
    if (industryFilter) industryFilter.addEventListener('change', () => this.filterLeads());
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        window.location.href = '/api/leads/export';
      });
    }
  },

  startRealtimePolling() {
    setInterval(() => {
      const isUnlocked = sessionStorage.getItem('admin_portal_unlocked') === 'true';
      if (!isUnlocked) return;

      if (this.currentTab === 'leads') {
        this.loadStatsAndLeads(true);
      } else if (this.currentTab === 'assets') {
        this.loadAssets();
      }
    }, 5000);
  },

  async loadStatsAndLeads(silent = false) {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      if (data.success) {
        const isNew = this.lastLeadCount !== -1 && data.leads.length > this.lastLeadCount;
        this.lastLeadCount = data.leads.length;
        this.allLeads = data.leads;
        this.renderStats();

        const searchInput = document.getElementById('leads-search-input');
        const isTyping = searchInput && searchInput === document.activeElement && searchInput.value.trim() !== '';

        if (!isTyping) {
          const statusVal = document.getElementById('leads-status-filter')?.value || 'all';
          const industryVal = document.getElementById('leads-industry-filter')?.value || 'all';
          const hasFilter = (searchInput && searchInput.value.trim() !== '') || statusVal !== 'all' || industryVal !== 'all';

          if (hasFilter) {
            this.filterLeads();
          } else {
            this.renderLeadsTable(this.allLeads);
          }
        }

        if (isNew && silent) {
          const newest = data.leads[0];
          if (newest) {
            window.showToast(`🔔 Pendaftar Baru: ${newest.name} (${newest.company})`);
          }
        }
      }
    } catch (e) {
      if (!silent) console.error('Error fetching leads:', e);
    }
  },

  renderStats() {
    const totalCount = this.allLeads.length;
    const vipCount = this.allLeads.filter((l) => l.status === 'VIP').length;
    const confirmedCount = this.allLeads.filter((l) => l.status === 'Confirmed').length;
    const assetCount = this.allLeads.filter((l) => l.hasAsset).length;

    const statTotalEl = document.getElementById('stat-total-leads');
    const statVipEl = document.getElementById('stat-vip-leads');
    const statConfirmedEl = document.getElementById('stat-confirmed-leads');
    const statAssetEl = document.getElementById('stat-assets-count');

    if (statTotalEl) statTotalEl.textContent = totalCount;
    if (statVipEl) statVipEl.textContent = vipCount;
    if (statConfirmedEl) statConfirmedEl.textContent = confirmedCount;
    if (statAssetEl) statAssetEl.textContent = assetCount;
  },

  filterLeads() {
    const search = (document.getElementById('leads-search-input')?.value || '').toLowerCase();
    const status = document.getElementById('leads-status-filter')?.value || 'all';
    const industry = document.getElementById('leads-industry-filter')?.value || 'all';

    let filtered = this.allLeads.filter((lead) => {
      const matchesSearch =
        !search ||
        (lead.name && lead.name.toLowerCase().includes(search)) ||
        (lead.company && lead.company.toLowerCase().includes(search)) ||
        (lead.email && lead.email.toLowerCase().includes(search)) ||
        (lead.id && lead.id.toLowerCase().includes(search));

      const matchesStatus = status === 'all' || lead.status === status;
      const matchesIndustry = industry === 'all' || lead.industry === industry;

      return matchesSearch && matchesStatus && matchesIndustry;
    });

    this.renderLeadsTable(filtered);
  },

  renderLeadsTable(leads) {
    const tbody = document.getElementById('leads-table-body');
    if (!tbody) return;

    if (leads.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 32px; color: #64748b;">
            Tidak ada data peserta yang cocok dengan kriteria pencarian.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = leads.map((lead) => {
      const statusClass =
        lead.status === 'VIP' ? 'status-vip' : lead.status === 'Confirmed' ? 'status-confirmed' : 'status-registered';

      const fileBadge = lead.hasAsset
        ? `<a href="/uploads/assets/${lead.assetFilename}" target="_blank" class="file-badge-link" title="${lead.assetOriginalName || 'Download file'}">
             📁 ${lead.assetSize || 'File'}
           </a>`
        : `<span style="color: #475569;">—</span>`;

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: #ffffff;">${lead.name}</div>
            <div style="font-size: 11px; color: #64748b; font-family: monospace;">${lead.id}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: #38bdf8;">${lead.company}</div>
            <div style="font-size: 12px; color: #94a3b8;">${lead.jobTitle || '-'}</div>
          </td>
          <td>
            <div style="font-size: 13px; color: #e2e8f0;">${lead.email}</div>
            <div style="font-size: 11px; color: #64748b;">${lead.whatsapp || '-'}</div>
          </td>
          <td>
            <span class="badge-tag">${lead.industry || 'Technology'}</span>
          </td>
          <td>${fileBadge}</td>
          <td>
            <span class="status-pill ${statusClass}">${lead.status || 'Confirmed'}</span>
          </td>
          <td>
            <div class="action-btn-group">
              <button class="btn-sm btn-outline" onclick="AdminPortal.previewEmail('${lead.id}')" title="Preview Email">
                ✉️ Email
              </button>
              <button class="btn-sm btn-outline" onclick="AdminPortal.toggleVip('${lead.id}', '${lead.status}')" title="Ubah Status VIP">
                ⭐ ${lead.status === 'VIP' ? 'Unmark VIP' : 'Set VIP'}
              </button>
              <button class="btn-sm btn-danger" onclick="AdminPortal.deleteLead('${lead.id}')" title="Hapus Data">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async toggleVip(id, currentStatus) {
    const newStatus = currentStatus === 'VIP' ? 'Confirmed' : 'VIP';
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        window.showToast(`Status peserta diubah ke ${newStatus}`);
        this.loadStatsAndLeads();
      }
    } catch (e) {
      window.showToast('Gagal update status: ' + e.message);
    }
  },

  async deleteLead(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus data pendaftar ini?')) return;
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        window.showToast('Data pendaftar berhasil dihapus');
        this.loadStatsAndLeads();
      }
    } catch (e) {
      window.showToast('Gagal menghapus: ' + e.message);
    }
  },

  previewEmail(leadId) {
    window.open(`/api/email-preview/${leadId}`, '_blank');
  },

  // Asset Storage Tab
  async loadAssets() {
    try {
      const res = await fetch('/api/assets');
      const data = await res.json();
      if (data.success) {
        this.allAssets = data.assets;
        this.renderAssetsGrid(this.allAssets);
      }
    } catch (e) {
      console.error('Error loading assets:', e);
    }
  },

  renderAssetsGrid(assets) {
    const container = document.getElementById('assets-list-container');
    if (!container) return;

    if (assets.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #64748b;">
          Belum ada file sample yang diunggah oleh peserta.
        </div>
      `;
      return;
    }

    container.innerHTML = assets.map((asset) => `
      <div class="glass-card asset-card">
        <div class="asset-icon-wrap">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <div class="asset-info-wrap">
          <div class="asset-name" title="${asset.originalName}">${asset.originalName}</div>
          <div class="asset-meta">
            <span>Ukuran: ${asset.sizeMB}</span> • 
            <span>Oleh: <strong>${asset.leadName}</strong> (${asset.leadCompany})</span>
          </div>
        </div>
        <div class="asset-actions">
          <a href="${asset.url}" download class="btn-sm btn-primary" title="Download Asset">
            Unduh
          </a>
          <button class="btn-sm btn-danger" onclick="AdminPortal.deleteAsset('${asset.filename}')" title="Hapus Asset">
            Hapus
          </button>
        </div>
      </div>
    `).join('');
  },

  async deleteAsset(filename) {
    if (!confirm('Hapus file sample ini dari penyimpanan server?')) return;
    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        window.showToast('File asset berhasil dihapus');
        this.loadAssets();
        this.loadStatsAndLeads();
      }
    } catch (e) {
      window.showToast('Gagal hapus file: ' + e.message);
    }
  },

  // Event & Zoom Settings Tab
  async loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        this.settings = data.settings;
        this.populateSettingsForm(data.settings);
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  },

  populateSettingsForm(settings) {
    const ev = settings.event || {};
    const zoom = ev.zoom || {};
    const smtp = settings.smtp || {};

    if (document.getElementById('set-event-title')) document.getElementById('set-event-title').value = ev.title || '';
    if (document.getElementById('set-event-subtitle')) document.getElementById('set-event-subtitle').value = ev.subtitle || '';
    if (document.getElementById('set-event-date')) document.getElementById('set-event-date').value = ev.date || '';
    if (document.getElementById('set-display-date')) document.getElementById('set-display-date').value = ev.displayDate || '';
    if (document.getElementById('set-display-time')) document.getElementById('set-display-time').value = ev.displayTime || '';

    if (document.getElementById('set-zoom-url')) document.getElementById('set-zoom-url').value = zoom.meetingUrl || '';
    if (document.getElementById('set-zoom-id')) document.getElementById('set-zoom-id').value = zoom.meetingId || '';
    if (document.getElementById('set-zoom-pass')) document.getElementById('set-zoom-pass').value = zoom.passcode || '';

    if (zoom.qrMode === 'custom') {
      const customRadio = document.getElementById('qr-mode-custom');
      if (customRadio) customRadio.checked = true;
    } else {
      const autoRadio = document.getElementById('qr-mode-auto');
      if (autoRadio) autoRadio.checked = true;
    }

    this.updateQrPreview();

    // SMTP Form
    if (document.getElementById('smtp-enabled')) document.getElementById('smtp-enabled').checked = !!smtp.enabled;
    if (document.getElementById('smtp-host')) document.getElementById('smtp-host').value = smtp.host || '';
    if (document.getElementById('smtp-port')) document.getElementById('smtp-port').value = smtp.port || 465;
    if (document.getElementById('smtp-user')) document.getElementById('smtp-user').value = smtp.user || '';
    if (document.getElementById('smtp-from')) document.getElementById('smtp-from').value = smtp.from || '';
  },

  async updateQrPreview() {
    const previewImg = document.getElementById('admin-qr-preview-img');
    if (!previewImg) return;

    const zoomUrl = document.getElementById('set-zoom-url')?.value || this.settings.event?.zoom?.meetingUrl || 'https://zoom.us';
    const isCustom = document.getElementById('qr-mode-custom')?.checked;

    if (isCustom && this.settings.event?.zoom?.customQrUrl) {
      previewImg.src = this.settings.event.zoom.customQrUrl;
    } else {
      try {
        const res = await fetch(`/api/qrcode?text=${encodeURIComponent(zoomUrl)}`);
        const data = await res.json();
        if (data.success && data.dataUrl) {
          previewImg.src = data.dataUrl;
        }
      } catch (e) {
        console.warn('Gagal memuat preview QR:', e);
      }
    }
  },

  bindSettingsForm() {
    const form = document.getElementById('event-zoom-settings-form');
    if (!form) return;

    const zoomUrlInput = document.getElementById('set-zoom-url');
    if (zoomUrlInput) {
      zoomUrlInput.addEventListener('input', () => {
        if (document.getElementById('qr-mode-auto')?.checked) {
          this.updateQrPreview();
        }
      });
    }

    document.querySelectorAll('input[name="qrMode"]').forEach((radio) => {
      radio.addEventListener('change', () => this.updateQrPreview());
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const qrMode = document.querySelector('input[name="qrMode"]:checked')?.value || 'auto';

      const updatedEvent = {
        title: document.getElementById('set-event-title').value,
        subtitle: document.getElementById('set-event-subtitle').value,
        date: document.getElementById('set-event-date').value,
        displayDate: document.getElementById('set-display-date').value,
        displayTime: document.getElementById('set-display-time').value,
        zoom: {
          meetingUrl: document.getElementById('set-zoom-url').value,
          meetingId: document.getElementById('set-zoom-id').value,
          passcode: document.getElementById('set-zoom-pass').value,
          qrMode: qrMode,
          customQrUrl: this.settings.event?.zoom?.customQrUrl || ''
        }
      };

      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': '11223344'
          },
          body: JSON.stringify({ event: updatedEvent })
        });
        const data = await res.json();
        if (data.success) {
          this.settings.event = updatedEvent;
          this.updateQrPreview();
          window.showToast('✓ Pengaturan Zoom & Barcode berhasil disimpan!');
        } else {
          window.showToast('Gagal: ' + data.message);
        }
      } catch (err) {
        window.showToast('Gagal menyimpan: ' + err.message);
      }
    });
  },

  bindQrUpload() {
    const fileInput = document.getElementById('custom-qr-file-input');
    const statusEl = document.getElementById('qr-upload-status');
    const customRadio = document.getElementById('qr-mode-custom');

    if (!fileInput) return;

    fileInput.addEventListener('change', async (e) => {
      if (!e.target.files || !e.target.files[0]) return;
      const file = e.target.files[0];

      const formData = new FormData();
      formData.append('qrCodeFile', file);

      if (statusEl) statusEl.textContent = 'Mengupload gambar barcode...';

      try {
        const res = await fetch('/api/settings/qrcode', {
          method: 'POST',
          headers: {
            'x-admin-password': '11223344'
          },
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          if (!this.settings.event) this.settings.event = {};
          if (!this.settings.event.zoom) this.settings.event.zoom = {};
          this.settings.event.zoom.customQrUrl = data.qrUrl;
          this.settings.event.zoom.qrMode = 'custom';

          if (customRadio) customRadio.checked = true;
          this.updateQrPreview();

          if (statusEl) statusEl.innerHTML = '<span style="color:#10b981;">✓ Gambar barcode berhasil disimpan & aktif!</span>';
          window.showToast('✓ Barcode custom berhasil diterapkan!');
        } else {
          if (statusEl) statusEl.textContent = 'Gagal: ' + data.message;
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = 'Error: ' + err.message;
      }
    });
  },

  applySmtpPreset(type) {
    if (type === 'gmail') {
      document.getElementById('smtp-host').value = 'smtp.gmail.com';
      document.getElementById('smtp-port').value = 465;
      window.showToast('Template Gmail diterapkan (Port 465 SSL). Masukkan 16 karakter App Password.');
    } else if (type === 'office365') {
      document.getElementById('smtp-host').value = 'smtp.office365.com';
      document.getElementById('smtp-port').value = 587;
      window.showToast('Template Office 365 diterapkan.');
    } else if (type === 'yahoo') {
      document.getElementById('smtp-host').value = 'smtp.mail.yahoo.com';
      document.getElementById('smtp-port').value = 465;
      window.showToast('Template Yahoo Mail diterapkan.');
    } else if (type === 'custom') {
      document.getElementById('smtp-host').value = 'mail.domainanda.com';
      document.getElementById('smtp-port').value = 465;
      window.showToast('Template Custom cPanel diterapkan.');
    }
  },

  bindSmtpForm() {
    const form = document.getElementById('smtp-settings-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const passVal = document.getElementById('smtp-pass').value;

      const updatedSmtp = {
        enabled: document.getElementById('smtp-enabled').checked,
        host: document.getElementById('smtp-host').value.trim(),
        port: parseInt(document.getElementById('smtp-port').value, 10) || 465,
        user: document.getElementById('smtp-user').value.trim(),
        from: document.getElementById('smtp-from').value.trim(),
        mockMode: !document.getElementById('smtp-enabled').checked
      };

      if (passVal) {
        updatedSmtp.pass = passVal;
      }

      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': '11223344'
          },
          body: JSON.stringify({ smtp: updatedSmtp })
        });
        const data = await res.json();
        if (data.success) {
          window.showToast('✓ Konfigurasi SMTP berhasil disimpan!');
        } else {
          window.showToast('Gagal: ' + data.message);
        }
      } catch (err) {
        window.showToast('Gagal menyimpan SMTP: ' + err.message);
      }
    });
  },

  bindTestEmail() {
    const btn = document.getElementById('btn-send-test-email');
    const recipientInput = document.getElementById('test-email-recipient');
    const statusBox = document.getElementById('test-email-status-box');

    if (!btn) return;

    btn.addEventListener('click', async () => {
      const recipient = (recipientInput?.value || '').trim();
      if (!recipient || !recipient.includes('@')) {
        window.showToast('⚠️ Masukkan alamat email penerima tes yang valid.');
        recipientInput?.focus();
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Menghubungi SMTP...';
      if (statusBox) {
        statusBox.style.display = 'block';
        statusBox.style.background = 'rgba(0, 242, 254, 0.1)';
        statusBox.style.border = '1px solid #00f2fe';
        statusBox.style.color = '#e2e8f0';
        statusBox.textContent = `Menghubungkan ke server SMTP dan mengirim email verifikasi ke ${recipient}...`;
      }

      const smtpConfig = {
        host: document.getElementById('smtp-host').value.trim(),
        port: parseInt(document.getElementById('smtp-port').value, 10) || 465,
        user: document.getElementById('smtp-user').value.trim(),
        pass: document.getElementById('smtp-pass').value,
        from: document.getElementById('smtp-from').value.trim()
      };

      try {
        const res = await fetch('/api/test-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': '11223344'
          },
          body: JSON.stringify({
            smtpConfig,
            testRecipient: recipient
          })
        });

        const data = await res.json();
        if (data.success) {
          if (statusBox) {
            statusBox.style.background = 'rgba(16, 185, 129, 0.15)';
            statusBox.style.border = '1px solid #10b981';
            statusBox.style.color = '#10b981';
            statusBox.innerHTML = `<strong>✓ BERHASIL!</strong> Email tes berhasil dikirim ke <strong>${recipient}</strong>. Periksa inbox/spam Anda!`;
          }
          window.showToast('🎉 Email tes berhasil dikirim!');
        } else {
          if (statusBox) {
            statusBox.style.background = 'rgba(244, 63, 94, 0.15)';
            statusBox.style.border = '1px solid #f43f5e';
            statusBox.style.color = '#f43f5e';
            statusBox.innerHTML = `<strong>❌ GAGAL:</strong> ${data.message}`;
          }
          window.showToast('Gagal kirim email: ' + data.message);
        }
      } catch (err) {
        if (statusBox) {
          statusBox.style.background = 'rgba(244, 63, 94, 0.15)';
          statusBox.style.border = '1px solid #f43f5e';
          statusBox.style.color = '#f43f5e';
          statusBox.innerHTML = `<strong>❌ Error Jaringan / Server:</strong> ${err.message}`;
        }
      } finally {
        btn.disabled = false;
        btn.textContent = '🚀 Kirim Email Tes';
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminPortal.init();
});

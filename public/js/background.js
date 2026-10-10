/**
 * Custom Background Engine (1920x1080 Flexible Background System)
 * Allows real-time switching of curated presets, custom file uploads, and URL inputs.
 */

const BackgroundEngine = {
  presets: [
    {
      id: 'cyber-stage',
      name: 'Cyber Stage 2026 (Default)',
      url: '/assets/backgrounds/cyber-stage.svg',
      desc: 'Panggung arena futuristik dengan layar lengkung neon'
    },
    {
      id: 'quantum-grid',
      name: 'Quantum Horizon Grid',
      url: '/assets/backgrounds/quantum-grid.svg',
      desc: 'Grid perspektif 3D cybernetic matrix'
    },
    {
      id: 'cyberpunk-city',
      name: 'Cyberpunk Skyline Neon',
      url: '/assets/backgrounds/cyberpunk-city.svg',
      desc: 'Pemandangan gedung pencakar langit malam neon'
    },
    {
      id: 'minimal-glass',
      name: 'Obsidian Minimalist Mesh',
      url: '/assets/backgrounds/minimal-glass.svg',
      desc: 'Gradasi dark glass elegan dan ring sirkular halus'
    }
  ],

  currentSettings: {
    type: 'preset',
    activeId: 'cyber-stage',
    url: '/assets/backgrounds/cyber-stage.svg',
    overlayOpacity: 0.60,
    blur: 0,
    animated: true
  },

  init() {
    this.bgLayer = document.getElementById('custom-bg-layer');
    this.bgOverlay = document.getElementById('custom-bg-overlay');
    this.modal = document.getElementById('bg-customizer-modal');

    // 1. Load initial settings from server
    this.loadSettings();

    // 2. Setup event listeners
    this.bindEvents();
    this.renderPresets();
  },

  async loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings?.background) {
        this.currentSettings = { ...this.currentSettings, ...data.settings.background };
      }
    } catch (e) {
      console.warn('Falling back to local background settings:', e);
    }
    this.applyBackground(this.currentSettings);
    this.updateControlsUI();
  },

  applyBackground(settings) {
    if (!this.bgLayer || !this.bgOverlay) return;

    const bgUrl = settings.url || '/assets/backgrounds/cyber-stage.svg';
    this.bgLayer.style.backgroundImage = `url('${bgUrl}')`;
    
    // Apply blur
    const blurPx = settings.blur !== undefined ? settings.blur : 0;
    this.bgLayer.style.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';

    // Apply overlay opacity
    const opacity = settings.overlayOpacity !== undefined ? settings.overlayOpacity : 0.60;
    this.bgOverlay.style.backgroundColor = `rgba(4, 8, 20, ${opacity})`;

    // Ambient floating glow
    if (settings.animated) {
      document.body.classList.add('ambient-glow-active');
    } else {
      document.body.classList.remove('ambient-glow-active');
    }
  },

  updateControlsUI() {
    const opacitySlider = document.getElementById('bg-opacity-slider');
    const opacityVal = document.getElementById('bg-opacity-val');
    const blurSlider = document.getElementById('bg-blur-slider');
    const blurVal = document.getElementById('bg-blur-val');
    const animToggle = document.getElementById('bg-anim-toggle');

    if (opacitySlider && opacityVal) {
      opacitySlider.value = Math.round((this.currentSettings.overlayOpacity || 0.6) * 100);
      opacityVal.textContent = opacitySlider.value + '%';
    }
    if (blurSlider && blurVal) {
      blurSlider.value = this.currentSettings.blur || 0;
      blurVal.textContent = blurSlider.value + 'px';
    }
    if (animToggle) {
      animToggle.checked = !!this.currentSettings.animated;
    }

    // Highlight active preset card
    document.querySelectorAll('.preset-card').forEach(card => {
      if (card.dataset.id === this.currentSettings.activeId) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  },

  renderPresets() {
    const container = document.getElementById('preset-bg-container');
    if (!container) return;

    container.innerHTML = this.presets.map(preset => `
      <div class="preset-card ${preset.id === this.currentSettings.activeId ? 'active' : ''}" 
           data-id="${preset.id}" 
           data-url="${preset.url}"
           style="background-image: url('${preset.url}');">
        <div class="preset-badge">${preset.name}</div>
      </div>
    `).join('');

    container.querySelectorAll('.preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const url = card.dataset.url;
        this.selectPreset(id, url);
      });
    });
  },

  selectPreset(id, url) {
    this.currentSettings.type = 'preset';
    this.currentSettings.activeId = id;
    this.currentSettings.url = url;
    this.applyBackground(this.currentSettings);
    this.updateControlsUI();
  },

  async handleFileUpload(file) {
    if (!file) return;

    // Validate image file
    if (!file.type.startsWith('image/')) {
      alert('Format file harus berupa gambar (JPG, PNG, WebP).');
      return;
    }

    const formData = new FormData();
    formData.append('backgroundFile', file);
    formData.append('overlayOpacity', this.currentSettings.overlayOpacity);
    formData.append('blur', this.currentSettings.blur);
    formData.append('animated', this.currentSettings.animated);

    const statusEl = document.getElementById('bg-upload-status');
    if (statusEl) statusEl.textContent = 'Mengupload gambar 1920x1080...';

    try {
      const res = await fetch('/api/settings/background', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        this.currentSettings.type = 'uploaded';
        this.currentSettings.activeId = data.background.activeId;
        this.currentSettings.url = data.background.url;
        this.applyBackground(this.currentSettings);
        this.updateControlsUI();
        if (statusEl) statusEl.innerHTML = '<span style="color:#10b981;">✓ Background berhasil dipasang & disimpan!</span>';
      } else {
        if (statusEl) statusEl.textContent = 'Gagal: ' + data.message;
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Error koneksi upload: ' + e.message;
    }
  },

  async applyCustomUrl(url) {
    if (!url || !url.trim()) return;

    this.currentSettings.type = 'url';
    this.currentSettings.activeId = 'custom-url';
    this.currentSettings.url = url.trim();
    this.applyBackground(this.currentSettings);
    this.updateControlsUI();

    // Persist to server
    try {
      await fetch('/api/settings/background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          type: 'url',
          overlayOpacity: this.currentSettings.overlayOpacity,
          blur: this.currentSettings.blur,
          animated: this.currentSettings.animated
        })
      });
    } catch (e) {
      console.warn('Gagal menyimpan URL ke backend:', e);
    }
  },

  async saveCurrentSettings() {
    try {
      const res = await fetch('/api/settings/background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.currentSettings)
      });
      const data = await res.json();
      if (data.success) {
        this.closeModal();
        if (window.showToast) window.showToast('Background tersimpan permanen untuk semua pengunjung!');
      }
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  },

  bindEvents() {
    // Open/Close Modal
    const openBtn = document.getElementById('open-bg-customizer-btn');
    const closeBtn = document.getElementById('close-bg-modal-btn');
    const saveBtn = document.getElementById('save-bg-settings-btn');
    const resetBtn = document.getElementById('reset-bg-default-btn');

    if (openBtn) openBtn.addEventListener('click', () => this.openModal());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveCurrentSettings());

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.selectPreset('cyber-stage', '/assets/backgrounds/cyber-stage.svg');
        this.currentSettings.overlayOpacity = 0.60;
        this.currentSettings.blur = 0;
        this.currentSettings.animated = true;
        this.applyBackground(this.currentSettings);
        this.updateControlsUI();
      });
    }

    // Sliders
    const opacitySlider = document.getElementById('bg-opacity-slider');
    const blurSlider = document.getElementById('bg-blur-slider');
    const animToggle = document.getElementById('bg-anim-toggle');

    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.currentSettings.overlayOpacity = val / 100;
        document.getElementById('bg-opacity-val').textContent = val + '%';
        this.applyBackground(this.currentSettings);
      });
    }

    if (blurSlider) {
      blurSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.currentSettings.blur = val;
        document.getElementById('bg-blur-val').textContent = val + 'px';
        this.applyBackground(this.currentSettings);
      });
    }

    if (animToggle) {
      animToggle.addEventListener('change', (e) => {
        this.currentSettings.animated = e.target.checked;
        this.applyBackground(this.currentSettings);
      });
    }

    // File Input
    const fileInput = document.getElementById('bg-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFileUpload(e.target.files[0]);
        }
      });
    }

    // URL Apply Button
    const urlInput = document.getElementById('bg-url-input');
    const applyUrlBtn = document.getElementById('bg-url-apply-btn');
    if (applyUrlBtn && urlInput) {
      applyUrlBtn.addEventListener('click', () => {
        this.applyCustomUrl(urlInput.value);
      });
    }
  },

  openModal() {
    if (this.modal) {
      this.modal.classList.add('open');
      this.updateControlsUI();
    }
  },

  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('open');
    }
  }
};

window.BackgroundEngine = BackgroundEngine;

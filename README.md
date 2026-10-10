# Beyond Ordinary 2026 — Web Browser Zoom Registration App

Aplikasi web browser modern, futuristik, dan minimalis untuk registrasi peserta online seminar/masterclass dengan alur lengkap (Landing Page, Input Data Peserta, Upload Sample File Proyek, Akses Link Zoom Otomatis, Pengiriman Email Undangan & Kalender, serta Leads Database & Asset Storage).

Dibangun berdasarkan referensi alur dan desain visual yang diberikan:
- **Landing Page & Registration Flow**: Form registrasi interaktif multi-step dengan efek glassmorphism dan tema dark-cyberpunk.
- **Instant Zoom Meeting Credentials**: Menampilkan link Zoom, Meeting ID, dan Passcode secara instan setelah submit.
- **Email Konfirmasi & Kalender Otomatis**: Integrasi pengiriman email resmi dengan file `.ics` (iCalendar) dan direct link ke Google Calendar.
- **Custom Background 1920x1080**: Panel fleksibel untuk mengganti latar belakang kapan saja (upload gambar, preset futuristik, atur overlay opacity & blur).
- **Leads Database & Asset Storage (Admin Portal)**: Manajemen data pendaftar, status VIP untuk live rendering, preview email, dan export ke CSV/Excel.

---

## 🚀 Fitur Utama

1. **Desain Futuristik & Minimalis**:
   - Dark tech cyberpunk dengan aksen neon cyan (`#00f2fe`), electric blue, dan purple.
   - Glassmorphism UI (`backdrop-filter: blur(20px)`), glowing borders, dan smooth micro-animations.
   - Tampilan responsif optimal untuk layar 1920x1080 (desktop), laptop, tablet, dan smartphone.

2. **Alur Registrasi Interaktif**:
   - **Step 1 (Input Data)**:
     - Nama Lengkap (Full Name)
     - Nama Perusahaan (Company Name)
     - Jabatan (Job Title)
     - Kota / Region
     - Email Perusahaan (Corporate Email Address)
     - Nomor WhatsApp
     - Sektor Industri
     - Hardware Bottleneck (Render lambat, Biaya cloud tinggi, Remote work lag, PC crash)
   - **Step 2 (Upload Sample File - Opsional)**:
     - Drag & drop area untuk mengunggah file sample berat (.zip, .rvt, .blend, .mov, dll.) hingga 250MB.
     - Jaminan keamanan hak cipta aset (digunakan eksklusif untuk live render test saat siaran).
   - **Step 3 (Konfirmasi & Akses Zoom)**:
     - Tombol langsung untuk membuka Zoom Meeting.
     - Tombol 1-klik salin URL Zoom.
     - Meeting ID & Passcode.
     - Unduh undangan kalender resmi (`.ics`) untuk disinkronkan ke Apple Calendar, Outlook, atau Google Calendar.
     - Tombol 1-klik simpan ke Google Calendar online.
     - Unduh Kartu Akses VIP / Digital Pass (PNG) beresolusi tinggi dengan QR code unik.
     - Modal interaktif preview email resmi seperti tampilan Mac Mail.

3. **Fitur Custom Background (1920x1080)**:
   - Tombol mengambang di pojok kanan bawah (**🎨 Custom Background**).
   - **Pilihan Preset Futuristik 1920x1080**:
     1. *Cyber Stage 2026* (panggung arena futuristik dengan layar lengkung neon seperti gambar referensi).
     2. *Quantum Horizon Grid* (perspektif 3D cybernetic space grid).
     3. *Cyberpunk Skyline Neon* (pemandangan gedung pencakar langit malam neon).
     4. *Obsidian Minimalist Mesh* (desain dark glass elegan & clean).
   - **Upload File Sendiri**: Unggah gambar resolusi 1920x1080 dari perangkat Anda (tersimpan permanen di server).
   - **Input URL**: Tempel tautan gambar eksternal apa saja.
   - **Kontrol Visual Live**:
     - Slider *Dark Overlay* (10% - 90%) untuk memastikan teks formulir selalu terbaca jelas.
     - Slider *Blur Intensity* (0px - 20px).
     - Toggle *Ambient Dynamic Glow* (animasi efek bernafas aurora).
     - Simpan permanen untuk dinikmati semua pengunjung situs.

4. **Leads Database & Asset Storage (Admin Portal)**:
   - Akses via `/admin.html` atau tombol navigasi *Leads Portal*.
   - **Tab Leads Database**: Pencarian berdasarkan nama/perusahaan/email, filter industri dan status, tombol set VIP, dan preview email terkirim.
   - **Export CSV/Excel**: 1-klik unduh semua data pendaftar dalam format CSV lengkap dengan UTF-8 BOM.
   - **Tab Asset Storage**: Daftar file sample yang diunggah peserta lengkap dengan ukuran dan tombol download.
   - **Pengaturan Zoom & Acara**: Ubah link Zoom, ID, Passcode, dan jadwal siaran kapan pun.
   - **Pengaturan SMTP**: Konfigurasi server email asli (Google Workspace, Office 365, SendGrid, Amazon SES) untuk mengirimkan email nyata.

---

## 🛠️ Cara Menjalankan Aplikasi

Pastikan Node.js (v18+) telah terpasang di komputer Anda.

1. Buka Terminal di folder proyek ini:
   ```bash
   cd "/Users/mac/Downloads/zoom regist"
   ```

2. Jalankan aplikasi:
   ```bash
   npm start
   ```

3. Buka browser Anda:
   - **Landing Page Peserta**: [http://localhost:3000](http://localhost:3000)
   - **Admin Portal & Leads**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## 📁 Struktur Folder

```
zoom-regist/
├── package.json               # Konfigurasi & dependensi Node.js
├── server.js                  # Express backend & API endpoints
├── emailService.js            # Dispatcher email HTML, template, & generator kalender .ICS
├── data/
│   ├── leads.json             # Database penyimpanan pendaftar
│   ├── settings.json          # Pengaturan acara, Zoom, SMTP, dan custom background
│   └── email_logs.json        # Log pengiriman & preview email
├── uploads/
│   ├── assets/                # Direktori penyimpanan file sample peserta
│   └── backgrounds/           # Direktori penyimpanan file background custom yang diupload
├── public/
│   ├── index.html             # Halaman registrasi peserta (Landing Page)
│   ├── admin.html             # Halaman Admin Portal (Leads & Asset Storage)
│   ├── css/
│   │   └── style.css          # Desain sistem futuristik minimalis & glassmorphism
│   ├── js/
│   │   ├── app.js             # Logika wizard registrasi, validasi, & dropzone
│   │   ├── admin.js           # Logika tabel leads, filter, asset viewer, & settings
│   │   ├── calendar.js        # Generator .ics, Google Calendar, & kartu digital VIP pass
│   │   └── background.js      # Mesin custom background 1920x1080 & presets
│   └── assets/
│       ├── flow-landing.jpg   # Referensi alur landing page
│       ├── flow-access.jpg    # Referensi alur audience journey
│       └── backgrounds/       # Koleksi SVG background 1920x1080 resolusi tinggi
└── README.md                  # Dokumentasi lengkap
```

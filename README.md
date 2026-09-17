# Aura Protocol Daily Bot

Automasi harian untuk claim reward login dan menjawab quiz harian di **Aura Protocol / Aura Launch** menggunakan **Pure Node.js (Native `fetch`)** tanpa dependensi eksternal (`0 external dependencies`).

> [!WARNING]
> **DISCLAIMER:**
> Proyek ini dibuat semata-mata untuk **tujuan edukasi dan pembelajaran** mengenai interaksi HTTP API, otomasi berbasis Node.js, dan manipulasi data sesi web. Segala risiko atau konsekuensi dari penggunaan script ini menjadi tanggung jawab pengguna masing-masing.

---

## Fitur Utama

- **Zero Dependencies**: Murni menggunakan `fetch` dan modul bawaan Node.js (v18+ / v20+ / v24+), tanpa perlu `npm install` library tambahan.
- **Multi-Akun Otomatis**: Mendukung banyak akun sekaligus melalui file `tokens.txt`.
- **Auto Daily Claim**: Otomatis mengecek dan mengklaim poin reward harian jika sudah *claimable*.
- **Auto Quiz Solver**: Otomatis menganalisis pertanyaan kuis harian seputar topik Web3/Blockchain dan memilih jawaban yang tepat.
- **Tampilan Terminal Presisi**: Dilengkapi card box tiap akun, badge status warna ANSI, dan tabel ringkasan eksekusi yang rapi dan presisi.
- **Aman**: File `tokens.txt` otomatis diabaikan oleh git melalui `.gitignore`.

---

## Cara Mendapatkan `aura_token` dari Browser

Koreksi dari *"application ocokie aura_tokan"*:
Cookie yang dicari bernama **`aura_token`** dan berada di tab **Application** -> **Cookies** pada Developer Tools browser.

Langkah-langkah detailnya:

1. Buka browser (Google Chrome, Brave, Edge, dll) dan kunjungi [https://beta.auralaunch.org/incentives](https://beta.auralaunch.org/incentives).
2. Login dan hubungkan wallet Anda ke situs tersebut.
3. Buka **Developer Tools** dengan cara:
   - Tekan tombol **`F12`**, atau
   - Tekan kombinasi **`Ctrl + Shift + I`** (Windows) / **`Cmd + Option + I`** (Mac), atau
   - Klik kanan di sembarang tempat pada halaman web -> klik **Inspect**.
4. Masuk ke tab **`Application`** (jika tidak terlihat, klik tanda panah `>>` di sebelah kanan tab Console / Network).
5. Pada panel menu sebelah kiri:
   - Buka menu dropdown **`Storage`** -> **`Cookies`**.
   - Klik domain **`https://beta.auralaunch.org`**.
6. Pada tabel cookies di sebelah kanan:
   - Cari baris dengan **Name**: `aura_token`.
   - Klik ganda (double click) pada kolom **Value**-nya, lalu **Copy** nilainya (dimulai dengan `0x...%3A0x...`).
7. Paste token tersebut ke dalam file `tokens.txt`.

---

## Panduan Instalasi & Penggunaan

### 1. Prasyarat
- Pastikan Anda sudah menginstal **Node.js** (rekomendasi versi 18 ke atas, cek dengan perintah `node -v`).

### 2. Konfigurasi Token & AI Solver (Opsional)
- **Token Akun**: Buka file `tokens.txt`, lalu masukkan token yang sudah Anda dapatkan. Masukkan **satu token per baris** jika memiliki banyak akun:
  ```text
  # tokens.txt
  0x681615681b0c66d6...%3A0x728F58C4f8dB2D6f3646048624f5C3a86F29De7F
  0xd04cdbe194c39e16...%3A0x86A4BbDC82752Cd3A947Ff2ff64c989eBA875ce4
  ```

- **(Opsional) Integrasi Google Gemini AI**:
  Agar bot selalu 100% akurat menjawab segala topik kuis baru yang muncul besok, Anda dapat menambahkan API Key Google Gemini gratis:
  1. Buat API key gratis di [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
  2. Buat file `.env` di direktori proyek (atau copy dari `.env.example`).
  3. Masukkan API key Anda:
     ```env
     GEMINI_API_KEY=AIzaSy...
     ```
  *(Catatan: Jika `.env` tidak diisi, bot akan tetap berjalan menggunakan mesin kata kunci bawaan `Web3 Rule Engine`)*.

> **Tips:** Script otomatis membersihkan prefix `aura_token=`, spasi, atau tanda kutip jika tidak sengaja tersalin.

### 3. Menjalankan Bot
Jalankan perintah berikut di terminal:

```bash
npm start
```

Bot akan otomatis membersihkan layar terminal, memproses setiap akun satu per satu dengan jeda aman 2 detik, dan menampilkan tabel rekapitulasi poin di akhir proses.

---

## Struktur File Proyek

```text
aura-protocol-daily/
├── index.js          # Script utama (fetch API, solver kuis, UI terminal)
├── tokens.txt        # Daftar aura_token pengguna (1 baris per akun)
├── package.json      # Konfigurasi proyek Node.js (ES Module)
├── .gitignore        # Mencegah tokens.txt & file sensitif ter-commit
└── README.md         # Dokumentasi proyek
```

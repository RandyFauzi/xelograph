# Xelograph — Persistent Alumni World

Sebuah game reuni layar penuh di browser dan HP, dengan menu awal, HUD, joystick analog, kamera mengikuti pemain, dan dunia sekolah yang dapat dijelajahi. Tidak ada sidebar atau halaman dashboard dalam pengalaman alumni.

Sebuah reuni kecil sebelum reuni sebenarnya. Alumni membuat karakter, menjelajahi taman sekolah, dan menjawab tujuh checkpoint. Setelah selesai dan memberikan izin tampil, avatar tetap berada di dunia meskipun pemiliknya menutup browser.

**Mode 1**: gerakan pemain lokal, avatar alumni tersimpan sebagai penghuni dunia. Tidak menggunakan live multiplayer atau status online.

## Jalankan

Memerlukan Node.js 24. Aplikasi dan aset berjalan lokal; tidak memerlukan Supabase, layanan OTP, CDN, font eksternal, atau koneksi Blender aktif.

```powershell
npm install
npm run build
npm start
```

Buka `http://127.0.0.1:3001`. Untuk pengembangan, `npm run dev` memakai alamat yang sama. Next.js App Router melayani frontend dan meneruskan `/api` ke Express internal di loopback port 3002.

File `.env` lokal sudah disiapkan dengan token admin acak. Jangan commit atau bagikan file tersebut. Untuk instalasi baru, salin `.env.example` ke `.env` dan isi `ADMIN_TOKEN` dengan secret acak yang panjang.

- Uji lokal: kode **XEL-DEMO** dengan nomor WhatsApp yang belum terdaftar. Tidak ada pesan WhatsApp yang dikirim.
- Ruang panitia terpisah di `http://127.0.0.1:3001/admin`: gunakan nilai `ADMIN_TOKEN` dari `.env`. Token hanya berada di memori halaman selama dashboard dibuka.
- Data disimpan di `data/xelograph.sqlite`, bukan localStorage. Refresh atau restart server tetap mempertahankan jawaban.
- Mode demo harus dimatikan sebelum dibuka kepada alumni sungguhan: `DEMO_MODE=false`.
- Cookie sesi bertahan 30 hari. Kode demo hanya dapat melanjutkan melalui sesi browser yang sama, sedangkan kode pribadi dapat digunakan lintas perangkat.

## Kode pribadi alumni

```powershell
npm run db:invite -- "Nama Alumni"
```

Perintah menghasilkan satu kode acak berentropi tinggi. Bagikan secara pribadi kepada alumni tersebut. Database hanya menyimpan hash kode. Pendaftaran pertama mengikat kode ke satu profil. Masuk kembali dengan kode yang sama mengembalikan profil tersebut. Nama label undangan adalah catatan panitia, bukan pemeriksaan identitas otomatis.

Kode ini adalah kredensial pembawa: siapa pun yang memilikinya dapat mengakses profil terkait. Jangan menaruh kode di URL, tangkapan layar publik, atau direktori. Kode yang hilang perlu ditangani panitia; belum tersedia pengiriman kode atau OTP otomatis. Nomor WhatsApp dinormalisasi dan unik, tetapi belum diverifikasi kepemilikannya.

## Pengalaman yang tersedia

- Dunia 51 × 57 unit, gerakan WASD / panah relatif kamera, Shift / tombol Lari, Space / tombol Loncat, klik tanah untuk menuju titik, joystick analog, kamera mengikuti pemain, minimap, tampilan keseluruhan O, interaksi E, fullscreen.
- Sekolah putih beratap slate, plaza air mancur, lapangan biru, jalan lingkar dengan zebra cross, kafe, taman, pergola, danau, dan Reunion Commons besar dengan panggung serta tempat duduk untuk kumpul 50+ alumni.
- BGM original lembut dan efek langkah, loncat, mendarat, tombol, serta misi selesai. Audio mulai setelah interaksi pertama, berhenti saat tab disembunyikan, dan memiliki mute serta volume musik/efek terpisah.
- Pilih **Jelajahi dulu** untuk langsung berjalan tanpa registrasi. Buat karakter saat ingin menyimpan jawaban.
- Area misi terbuka berurutan. Pertanyaan muncul otomatis saat pemain mencapai area aktif. Setelah menyimpan, pemain kembali ke dunia dan area selanjutnya terbuka. Jurnal tidak membuka semua pertanyaan sekaligus.
- Tombol **Tunjukkan jalan** menjalankan pencarian jalur menghindari bangunan, air, dan area misi yang terkunci. Input joystick atau keyboard membatalkan perjalanan otomatis.
- Character creator: tiga rambut / topi, tiga warna kulit, empat pakaian, preview karakter GLB.
- Ketujuh checkpoint, validasi server, pilihan majemuk, bidang panitia bersyarat, usulan venue, pesan opsional.
- Jawaban disimpan setelah menekan **Simpan & lanjut**; indikator tersimpan hanya muncul setelah server berhasil menyimpan. Jawaban yang sedang diketik belum menjadi draf server.
- Progres dapat dilanjutkan, jawaban dapat diperbarui, satu respons per alumni.
- Avatar publik hanya muncul setelah semua checkpoint selesai dan ada persetujuan. Izin dapat ditarik melalui pass.
- Area utama ditentukan dari kehadiran dan kepanitiaan; badge Crew / Production / Supporter tetap independen.
- Direktori, pencarian, filter area, temukan avatar, pass SVG yang dapat diunduh.
- Mode ringan tanpa navigasi 3D menyediakan misi satu per satu untuk aksesibilitas. Fallback jika render gagal; navigasi dialog dengan keyboard.
- Dashboard: respons/draf, minat acara, kehadiran, panitia, venue, kontribusi, pesan, ekspor CSV, penghapusan data.

Direktori dan Reunion Commons menampilkan semua alumni yang mengizinkan tampil. Avatar publik menggunakan instanced meshes per material dan gaya rambut; tidak ada batas 16/32 karakter. Label nama dibatasi ke 14 karakter dekat pemain agar layar tetap terbaca. Empat karakter dekoratif saat demo kosong bukan data alumni; label demo menjelaskan hal ini. Kapasitas 50 pengisian bersamaan dan tata letak 100 avatar telah diuji; FPS pada HP tetap bergantung pada perangkat.

## Struktur

```text
src/app/              Next.js App Router, lazy client game, route admin terpisah
src/                  Layar game, alur survei, scene Three.js
src/game/             Joystick, kamera, collision, jalur, loncat, crowd dan audio
server/               Express, akses data, validasi, autentikasi
database/schema.sql   Skema SQLite dan constraint
scripts/              Runtime Next/API, optimasi GLB & generator undangan
tests/                Pengujian integrasi dan integritas aset
assets/blender/       Sumber .blend + generator aset yang reproducible
assets/previews/      Render PNG dunia dan karakter
public/models/        world.glb dan avatar.glb untuk runtime
docs/                 Arsitektur, desain data, arah visual, operasional
data/                 Database runtime (diabaikan Git)
```

## Aset Blender

Keduanya model asli yang dibuat secara prosedural untuk proyek ini, tanpa unduhan aset pihak ketiga. Arah eksplorasi dan warna terinspirasi [Zesiger](https://zesiger.net/): rumput hijau cerah, air biru, gedung putih, atap gelap, dan penanda biru. Materi serta urutan tujuh pertanyaan dipertahankan. Generator dipisah menjadi modul geometri, kampus, dan karakter. GLB memakai kompresi Meshopt dengan decoder lokal; world sekitar 1,17 MB dan avatar 204 KB.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python assets/blender/build_campus.py
npm run models:optimize
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python assets/blender/render_preview.py
```

Sumber bisa dibuka di Blender lalu diedit. Rambut dan material karakter bernama agar mudah dipilih/tint di aplikasi. Tangan dan kaki memakai pivot terpisah untuk animasi langkah runtime; loncat memakai gravitasi sederhana tanpa double jump. Pohon/bangunan yang menghalangi pandangan memudar lalu kembali normal. Belum berupa rig skeletal atau klip animasi GLB. Pass unduhan menggunakan monogram; preview pass dalam aplikasi memakai avatar 3D. `build_world.py` adalah generator versi lama yang disimpan sebagai referensi.

## Validasi

```powershell
npm test
npm run build
```

Pengujian juga mensimulasikan gerakan frame demi frame menuju semua misi, arah input relatif kamera, collision, dan penguncian area. Pengujian mencakup alur dari undangan sampai dunia publik, resume, logout, constraint nomor unik, validasi payload, larangan penyelesaian prematur, penarikan persetujuan, data privat, kontrol admin, penghapusan, serta struktur GLB. Browser sengaja tidak dibuka sesuai permintaan; kontrol, responsivitas, dan performa perangkat nyata masih perlu diperiksa langsung oleh pemilik.

## Sebelum peluncuran publik

Gunakan HTTPS, `NODE_ENV=production`, `DEMO_MODE=false`, reverse proxy ke port lokal, dan token admin yang kuat. `NODE_ENV=production` mengaktifkan cookie Secure; akses HTTP biasa tidak dapat mempertahankan sesi pada konfigurasi ini. Tentukan pengelola data, kontak panitia, dan jadwal retensi yang sebenarnya di pemberitahuan privasi.

SQLite cocok untuk satu instance server dengan disk persisten dan beban reuni kecil. Jangan taruh database dalam direktori statis, folder sinkronisasi, atau deployment ephemeral. Backup database dengan SQLite backup API atau saat server berhenti; jangan menyalin hanya file `.sqlite` saat WAL masih aktif. Baca [operasional](docs/OPERATIONS.md) sebelum hosting. Belum ada hosting, pembayaran, OTP, email, maupun integrasi layanan eksternal yang diaktifkan.

## Pemeriksaan versi game

Muat ulang dengan Ctrl+F5 setelah build baru. Pilih Jelajahi dulu, gunakan WASD atau joystick, lalu pilih Tunjukkan jalan. Pertanyaan baru muncul ketika mencapai area misi. Materi pertanyaan tetap sama; yang berubah adalah penyajiannya. Untuk HP pada jaringan lokal, jalankan server dengan HOST=0.0.0.0 dan akses alamat IP komputer dari HP; batasi firewall sesuai jaringan yang dipercaya. Deployment publik belum dilakukan.

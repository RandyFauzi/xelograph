# Xylograph — Persistent Alumni World

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

Buka `http://127.0.0.1:3001`. Untuk pengembangan, `npm run dev` memakai alamat yang sama. Next.js App Router melayani frontend dan API langsung dalam satu server; tidak memerlukan port API atau proses Express tambahan.

File `.env` lokal sudah disiapkan dengan token admin acak. Jangan commit atau bagikan file tersebut. Untuk instalasi baru, salin `.env.example` ke `.env` dan isi `ADMIN_TOKEN` dengan secret acak yang panjang.

- Pendaftaran langsung tanpa kode: isi nama, WhatsApp, pilih karakter, dan beri persetujuan. PUBLIC_REGISTRATION=true (default) membuka pendaftaran alumni. Tidak ada pesan WhatsApp yang dikirim.
- Ruang panitia terpisah di `http://127.0.0.1:3001/admin`: gunakan nilai `ADMIN_TOKEN` dari `.env`. Token hanya berada di memori halaman selama dashboard dibuka.
- Data disimpan di `data/xelograph.sqlite`, bukan localStorage. Refresh atau restart server tetap mempertahankan jawaban.
- Mode demo harus dimatikan sebelum dibuka kepada alumni sungguhan: `DEMO_MODE=false`.
- Cookie sesi bertahan 30 hari. Gunakan browser yang sama untuk melanjutkan; kembali ke menu mempertahankan sesi. Jika sesi hilang atau ingin pindah perangkat, hubungi panitia. Nomor WhatsApp saja tidak bisa dipakai mengambil alih profil.

## Pendaftaran dan sesi

Alumni tidak perlu kode undangan. Konfigurasi avatar, jawaban, dan progres disimpan dalam database; cookie HttpOnly mengenali profil di browser yang sama. Nama dan nomor tidak menjadi bukti identitas atau kredensial masuk. Profil dengan nomor yang sudah terdaftar ditolak tanpa membuka data orang tersebut.

Mekanisme undangan lama tetap didukung backend untuk kompatibilitas, tetapi kolom kode tidak muncul dalam pengalaman pengguna. PUBLIC_REGISTRATION=false dapat menutup pendaftaran langsung bila diperlukan panitia. Belum ada pemulihan lintas perangkat atau OTP otomatis.

## Pengalaman yang tersedia

- Dunia 51 × 57 unit, gerakan WASD / panah relatif kamera, Shift / tombol Lari, Space / tombol Loncat, klik tanah untuk menuju titik, joystick analog, kamera mengikuti pemain, minimap, tampilan keseluruhan O, interaksi E, fullscreen.
- Sekolah putih beratap slate, plaza air mancur, lapangan biru, jalan lingkar dengan zebra cross, kafe, taman, pergola, danau, dan Reunion Commons besar dengan panggung serta tempat duduk untuk kumpul 50+ alumni.
- BGM original lembut dan efek langkah, loncat, mendarat, tombol, serta misi selesai. Audio mulai setelah interaksi pertama, berhenti saat tab disembunyikan, dan memiliki mute serta volume musik/efek terpisah.
- Satu easter egg kreator 3D kecil di taman barat daya: papan kayu, batu, mahkota dan kristal dari geometri Blender, tinggi 1,16 unit (lebih pendek dari avatar). Cahaya dan enam partikel halus hanya dianimasikan dari dekat; reduced-motion menghentikan efek. Mendekat dalam radius 1,6 unit membuka kredit sekali; klik/E membuka kembali. Portofolio terbuka di tab baru hanya setelah tombol dipilih.
- Pilih **Jelajahi dulu** untuk langsung berjalan tanpa registrasi. Buat karakter saat ingin menyimpan jawaban.
- Area misi terbuka berurutan. Pertanyaan muncul otomatis saat pemain mencapai area aktif. Setelah menyimpan, pemain kembali ke dunia dan area selanjutnya terbuka. Jurnal tidak membuka semua pertanyaan sekaligus.
- Tombol **Tunjukkan jalan** menjalankan pencarian jalur menghindari bangunan, air, dan area misi yang terkunci. Input joystick atau keyboard membatalkan perjalanan otomatis.
- Character creator: pilihan laki-laki/perempuan dengan tiga model 3D masing-masing (perempuan: Kasual, Sporty, Hijab; pria: Kasual, Jaket, Topi), tiga warna kulit, empat warna pakaian, dan preview karakter GLB. Pilihan yang sama tampil pada pemain serta avatar alumni; profil lama tetap kompatibel.
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

Model dibuat secara prosedural untuk proyek ini. Logo asli dari pemilik dipasang di gerbang dan Reunion Commons, dengan tekstur tertanam dalam GLB. Sumber logo tersedia di public/branding/xylograph-logo.jpg. Arah eksplorasi dan warna terinspirasi [Zesiger](https://zesiger.net/): rumput hijau cerah, air biru, gedung putih, atap gelap, dan penanda biru. Materi serta urutan tujuh pertanyaan dipertahankan. Generator dipisah menjadi modul geometri, kampus, dan karakter. GLB memakai kompresi Meshopt dengan decoder lokal; world sekitar 1,24 MB dan avatar sekitar 147 KB untuk enam model serta kompatibilitas model lama.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python assets/blender/build_campus.py
npm run models:optimize
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python assets/blender/render_preview.py
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python assets/blender/build_avatar_variants.py
npm run models:optimize -- public/models/avatar.glb
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python assets/blender/build_creator_relic.py
npm run models:optimize -- public/models/creator-relic.glb
```

Sumber bisa dibuka di Blender lalu diedit. Rambut dan material karakter bernama agar mudah dipilih/tint di aplikasi. Tangan dan kaki memakai pivot terpisah untuk animasi langkah runtime; loncat memakai gravitasi sederhana tanpa double jump. Pohon/bangunan yang menghalangi pandangan memudar lalu kembali normal. Belum berupa rig skeletal atau klip animasi GLB. Pass unduhan menggunakan monogram; preview pass dalam aplikasi memakai avatar 3D. `build_world.py` adalah generator versi lama yang disimpan sebagai referensi.

## Validasi

```powershell
npm test
npm run build
```

Pengujian juga mensimulasikan gerakan frame demi frame menuju semua misi, arah input relatif kamera, collision, dan penguncian area. Pengujian mencakup pendaftaran tanpa kode sampai dunia publik, resume, logout, constraint nomor unik, validasi payload, larangan penyelesaian prematur, penarikan persetujuan, data privat, kontrol admin, penghapusan, serta struktur GLB. Browser sengaja tidak dibuka sesuai permintaan; kontrol, responsivitas, dan performa perangkat nyata masih perlu diperiksa langsung oleh pemilik.

## Sebelum peluncuran publik

Gunakan HTTPS, `NODE_ENV=production`, `DEMO_MODE=false`, reverse proxy ke port lokal, dan token admin yang kuat. `NODE_ENV=production` mengaktifkan cookie Secure; akses HTTP biasa tidak dapat mempertahankan sesi pada konfigurasi ini. Tentukan pengelola data, kontak panitia, dan jadwal retensi yang sebenarnya di pemberitahuan privasi.

SQLite cocok untuk satu instance server dengan disk persisten dan beban reuni kecil. Pada Hostinger, gunakan DATABASE_PATH absolut di luar public_html/hbuilds dan PERSISTENT_DATABASE_REQUIRED=true. Lihat [konfigurasi Hostinger, pemeriksaan integritas, dan backup](docs/HOSTINGER.md). Backup memakai SQLite backup API; jangan menyalin hanya file .sqlite saat WAL aktif. Tidak ada pembayaran, OTP, atau email yang diaktifkan.

## Pemeriksaan versi game

Muat ulang dengan Ctrl+F5 setelah build baru. Pilih Jelajahi dulu, gunakan WASD atau joystick, lalu pilih Tunjukkan jalan. Pertanyaan baru muncul ketika mencapai area misi. Materi pertanyaan tetap sama; yang berubah adalah penyajiannya. Untuk HP pada jaringan lokal, jalankan server dengan HOST=0.0.0.0 dan akses alamat IP komputer dari HP; batasi firewall sesuai jaringan yang dipercaya. Deployment publik belum dilakukan.

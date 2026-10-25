# Operasional lokal dan hosting

## Lokal

`npm start` memuat .env dan menjalankan satu server Next.js pada PORT (default 3001), termasuk API di /api. npm run dev memakai Next dev pada port yang sama. HOST default 127.0.0.1. Preset Next.js Hostinger menjalankan standalone server yang juga mencakup route API. Tidak perlu port 3002.

Jangan menjalankan dua runtime pada port yang sama. Sebelum restart lokal, jalankan `npm run build` agar `.next` memuat versi terbaru. Tutup runtime dengan Ctrl+C. Untuk akses HP di LAN, set HOST=0.0.0.0 dan PUBLIC_ORIGIN=http://IP-KOMPUTER:3001 sesuai alamat yang dipakai HP.

## Konfigurasi produksi

1. Isi `ADMIN_TOKEN` dengan secret acak; batasi akses endpoint admin di reverse proxy bila memungkinkan.
2. Set `DEMO_MODE=false` dan `NODE_ENV=production`.
3. Letakkan reverse proxy HTTPS di depan Next.js port 3001. Set PUBLIC_ORIGIN=https://domain-reuni-anda (tanpa trailing slash); situs dan API memakai origin yang sama.
4. Gunakan satu instance server dan volume disk persisten untuk `DATABASE_PATH`. Perubahan ke multi-instance memerlukan migrasi ke database server seperti PostgreSQL dan limiter bersama.
5. Tambahkan rate limit login pada proxy. Banyak alumni di satu jaringan berbagi IP; jangan menetapkan batas seluruh situs terlalu rendah.
6. Set PUBLIC_REGISTRATION=true untuk pendaftaran langsung tanpa kode. Gunakan browser yang sama untuk melanjutkan; pemulihan lintas perangkat perlu bantuan panitia.
7. Isi nama pengelola, kontak panitia, dan retensi data pada pemberitahuan privasi sebelum membuka undangan.
8. Periksa UI dan gerak di perangkat nyata; belum ada pengujian browser otomatis pada pengerjaan ini.

## Backup

Hentikan API sebelum menyalin `data/` untuk backup sederhana yang konsisten, lalu jalankan kembali. Untuk backup tanpa downtime gunakan SQLite backup API atau VACUUM INTO melalui proses terotorisasi. Database WAL dapat memiliki perubahan yang belum masuk file utama; menyalin hanya `.sqlite` saat server aktif dapat kehilangan data.

Simpan backup dan `.env` terpisah dengan akses terbatas. Periksa kemampuan restore secara berkala. Database baru harus disimpan di luar folder `public/` dan `dist/`.

## Retensi dan permintaan alumni

Penarikan persetujuan tampil dilakukan alumni melalui pass. Penghapusan keseluruhan tersedia pada dashboard admin dengan konfirmasi karena tidak dapat dibatalkan. Penghapusan mencakup respons, progres, sesi, dan ikatan undangan. Backup historis perlu mengikuti kebijakan retensi panitia. Kode yang kehilangan ikatan karena penghapusan dihapus dari tabel undangan dan tidak dapat dipakai kembali.

## Migrasi PostgreSQL / Supabase

Pertahankan UUID, unique normalized WhatsApp, FK progres dan respons, serta status selesai. Ganti SQLite JSON text menjadi JSONB, timestamp text menjadi timestamptz, parameter SQL `?` menjadi `$n`, dan repository sinkron menjadi async. Terapkan autentikasi serta aturan akses yang setara sebelum memindahkan operasi dari server ke client. Jangan mengekspos tabel alumni lengkap sebagai endpoint publik; pertahankan proyeksi world yang sempit.

Konfigurasi Hostinger dan prosedur backup/restore: [HOSTINGER.md](HOSTINGER.md). Database wajib berada di path absolut di luar public_html/hbuilds; aktifkan PERSISTENT_DATABASE_REQUIRED=true.

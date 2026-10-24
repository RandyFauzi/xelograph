# Hostinger: deployment dan database persisten

Gunakan preset Next.js, Node 24, branch main, build script build, output .next. API sekarang memakai route Node.js bawaan Next.js di /api/[...path], sehingga ikut berjalan pada standalone server Hostinger tanpa proses Express tambahan atau API_PORT.

Hostinger membuat folder build baru setiap deployment dan menimpa public_html serta hbuilds. Database **tidak boleh** disimpan relatif terhadap aplikasi atau di kedua folder tersebut. Referensi: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

Konfigurasi deployment situs ini (token hanya berada di environment, bukan Git):

```dotenv
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
PUBLIC_ORIGIN=https://xelograph.appku.site
DATABASE_PATH=/home/u361393239/xelograph-data/xelograph.sqlite
PERSISTENT_DATABASE_REQUIRED=true
DEMO_MODE=true
ADMIN_TOKEN=ISI_DENGAN_SECRET_ASLI
```

PERSISTENT_DATABASE_REQUIRED menolak lokasi relatif, symlink ke folder deploy, lokasi dalam aplikasi, public, public_html, hbuilds, dist dan .next. Kegagalan membuka lokasi permanen menghasilkan HTTP 503 JSON; tidak ada fallback otomatis ke database kosong di folder build. Tabel dibuat dengan CREATE TABLE IF NOT EXISTS, tanpa drop/reset saat startup. SQLite memakai WAL, busy timeout 5 detik dan synchronous FULL; direktori baru 0700 dan file database 0600 pada Linux.

## Verifikasi dan backup

GET /api/admin/storage dengan Authorization Bearer admin mengembalikan lokasi aktual, status persisten, jumlah profil dan hasil PRAGMA quick_check. Endpoint ini tidak publik.

POST /api/admin/backup dengan autentikasi admin membuat snapshot konsisten menggunakan node:sqlite backup, termasuk data WAL, ke folder backups di sebelah database permanen. Respons mengembalikan nama file backup. Tidak menyalin file .sqlite mentah saat aktif. Simpan juga salinan backup di luar akun hosting secara berkala; penyimpanan permanen melindungi dari redeploy, bukan kehilangan akun/disk.

Untuk restore: hentikan aplikasi, simpan database aktif beserta WAL/SHM sebagai salinan pemulihan, lalu tempatkan snapshot di DATABASE_PATH. Jangan menggabungkan WAL lama dengan snapshot yang berbeda. Jalankan aplikasi kembali dan verifikasi quick_check serta jumlah profil. Jangan menghapus folder xelograph-data saat membersihkan build lama.

Uji redeploy: buat profil sintetis privat, simpan satu jawaban, deploy ulang commit yang sama, lalu pastikan ID, cookie sesi, jawaban dan progres tetap sama. Hapus hanya profil pengujian setelah berhasil. Uji ini tidak memerlukan reset database atau perubahan data alumni lain.

# Survei lama dan akses admin

`/admin` menyediakan Tabel Responden, pencarian, filter sumber, detail jawaban asli, dan ekspor CSV. Login menggunakan kode akses privat, bukan token API. Sesi disimpan sebagai hash di SQLite, cookie HttpOnly/Secure berlaku delapan jam, dan logout mencabut sesi. Lima percobaan gagal dibatasi selama 15 menit. Kode default diperoleh melalui `deriveAdminAccessCode(ADMIN_TOKEN)` di server; mengganti ADMIN_TOKEN mencabut akses kode dan sesi lama. Jangan memasukkan kode atau token ke Git/client bundle.

Impor lama dilakukan lewat endpoint admin terlindungi dan transaksi SQLite. Payload/data pribadi berada di `data/imports/` yang diabaikan Git. File yang sama dan baris yang sama tidak dibuat ulang saat impor diulang.

```powershell
python scripts/extract-legacy-survey.py 'survei.xlsx' data/imports/legacy-survey.json
node --env-file=path-ke-env-privat scripts/import-legacy-survey.mjs data/imports/legacy-survey.json --publish
node --env-file=path-ke-env-privat scripts/import-legacy-survey.mjs data/imports/legacy-survey.json --publish --apply
```

Perintah pertama impor API hanya simulasi. Buat backup database sebelum `--apply`. Environment privat memerlukan PUBLIC_ORIGIN dan ADMIN_TOKEN. Jangan mengunggah workbook mentah ke folder public.

Nama, kontak, dan semua jawaban asli dipertahankan dalam tabel `legacy_responses`, terpisah dari akun login. Nomor yang kosong/disamarkan tetap null. Pemetaan hanya untuk opsi yang jelas setara; persetujuan bukber/reuni dan konsep bebas bukan jawaban pilihan konsep game. Kolom game yang belum dijawab tetap kosong. Timestamp Excel disimpan tanpa mengarang zona waktu.

Dengan `--publish`, setiap respons mendapat model, warna pakaian, dan kulit acak yang disimpan sekali. Dunia hanya menerima nama panggilan, konfigurasi avatar, area, serta badge; kontak dan jawaban mentah hanya tersedia bagi admin. Ini merupakan publikasi oleh admin berdasarkan instruksi pemilik, terpisah dari persetujuan yang diberikan langsung melalui game.

Jika nomor cocok dengan akun yang sudah ada, jawaban game dan avatar pilihan pengguna dipertahankan, serta pilihan privasinya dihormati. Survei sebelumnya menyelesaikan kewajiban perjalanan baru tanpa mengarang jawaban pertanyaan tambahan. Tidak dibuat avatar ganda. Pendaftaran dengan nomor survei lama diarahkan untuk menjelajah tanpa mengisi ulang, bukan memberikan akses ke jawaban pribadi hanya berdasarkan nomor telepon.

Database tetap memakai DATABASE_PATH persisten di luar direktori deployment. Migrasi skema bersifat aditif; impor dapat diperiksa melalui backup, jumlah respons, integritas SQLite, dan kesamaan jawaban asli.

# Arah desain

**Tempat lama. Cerita baru.** Game reuni layar penuh dengan kampus cerah dan mudah dijelajahi. Referensi suasana eksplorasi: https://zesiger.net/. Seluruh model Blender dibuat khusus untuk Xelograph; aset referensi tidak disalin. Materi kuesioner dan konsep alumni persisten dipertahankan.

## Dunia dan warna

Rumput hijau, bangunan putih dengan atap slate gelap, air biru, paving krem, dan penunjuk biru. Sekolah, kafe, gedung modern dengan panel surya, lapangan basket, jalan lingkar, danau, taman dan bunga menjadi landmark. HUD putih transparan memakai sans-serif sistem dan tombol biru.

Island 51 × 57 unit. Tujuh area misi mengelilingi plaza; gerbang menghubungkan kampus ke Reunion Commons 29 × 13 unit dengan panggung, kursi perimeter, lampu dan bunting. Semua avatar alumni yang selesai dan setuju tampil ditempatkan di Commons dalam tiga kelompok. Tata letak adaptif diuji untuk 100 avatar, dan API diuji dengan 50 pengisi bersamaan.

## Perjalanan

Menu judul berada di atas dunia 3D. Pemain dapat menjelajah tanpa registrasi, lalu membuat karakter untuk menyimpan jawaban. Satu area terbuka setelah misi sebelumnya disimpan. Dialog muncul saat sampai di area aktif, dan menutup setelah penyimpanan berhasil. Server juga memeriksa urutannya.

WASD/panah dan joystick relatif kamera, Shift/tombol Lari, Space/tombol Loncat, E untuk interaksi, O untuk overview, M untuk jurnal, dan klik tanah untuk berjalan. Tunjukkan jalan mencari jalur menghindari bangunan, air dan area terkunci; input manual membatalkannya. Loncat memakai gravitasi sederhana tanpa double jump. Dekorasi kecil belum memakai collision individual.

Mode ringan menyediakan misi satu per satu tanpa navigasi 3D. Dialog menangkap fokus, Escape menutup, tombol ikon berlabel, dan reduced-motion mengurangi animasi dekoratif. Dunia memenuhi layar tanpa sidebar atau halaman bergulir; ruang panitia terpisah di /admin.

## Kamera dan karakter

Kamera mengikuti tubuh karakter; overview memperlihatkan kampus dan Commons. Raycast ke kepala dan tubuh mendeteksi pohon/bangunan penghalang, lalu memudarkan seluruh kelompok material ke opacity 0,16. Objek kembali normal setelah pandangan terbuka. Metadata camera_occluder di GLB menjaga dekorasi lain tetap dibatch.

Avatar chibi dengan tiga gaya rambut, empat pilihan pakaian, dan tiga warna kulit independen. Wajah menghadap +Z; tangan/kaki memiliki pivot lokal untuk langkah. Pemain memiliki animasi langkah dan loncat; avatar alumni persisten memakai geometri bersama dan instancing. Label tampil untuk maksimal 14 alumni dekat pemain. Tidak ada klaim status online atau live multiplayer.

## Audio dan data

BGM lembut original dan efek langkah, loncat, mendarat, tombol dan misi selesai dihasilkan Web Audio. Mulai setelah interaksi pertama; berhenti saat tab tersembunyi. Mute serta volume BGM/efek tersedia di pengaturan dan tersimpan di perangkat.

Jawaban dianggap tersimpan setelah server mengonfirmasi. Avatar publik memerlukan semua misi selesai dan persetujuan opt-in yang dapat ditarik. Nomor WhatsApp, nama lengkap dan pesan tidak tampil melalui endpoint dunia. Karakter dekoratif demo diberi label agar tidak disalahartikan sebagai peserta.

Build, API, navigasi, struktur GLB, kapasitas, collision dan loncat diperiksa otomatis. Render Blender tersedia di assets/previews. Browser lokal tidak dibuka sesuai permintaan pemilik; kontrol sentuh, suara dan FPS perlu diperiksa pada perangkat nyata.

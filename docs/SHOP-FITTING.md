# Kamar pas dan pemasangan item

`ShopModal` menyimpan pilihan coba di state lokal terpisah dari avatar tersimpan. Tombol Coba dulu tidak memanggil endpoint pembelian/pemasangan, tidak mengubah profil induk, dan tidak menulis inventori. Pilihan dapat dikombinasikan per slot, dibatalkan, atau direset. Menutup toko membuang pilihan lokal tersebut. Preview dapat diputar dengan OrbitControls; preview lain tetap memakai kamera sebelumnya.

Pemasangan memperbarui kamar pas secara lokal, lalu profil dunia diperbarui setelah `/store/equip` mengonfirmasi avatar tersimpan. Memicu refresh profil sebelum pemasangan selesai dapat mengembalikan tampilan lama; karena itu preview optimistis tidak lagi dikirim ke profil induk. Pembelian dan pemasangan merupakan dua operasi server: jika pembelian sudah berhasil tetapi pemasangan gagal, saldo dan inventori tetap mencerminkan pembelian yang sudah tercatat. Tidak ada pengembalian koin palsu di UI.

`avatarAppearance.mjs` menjadi jalur perakitan model untuk preview, pemain lokal, online peers, dan NPC. Baju GLB toko dipasang dengan anchor torso yang terukur (lebar 0,5; tinggi 0,51; kedalaman 0,31; pusat y=0,87). Baju bawaan bagian atas disembunyikan, sedangkan identitas, rambut/hijab, celana, rok bawah, dan tangan dipertahankan. Lengan baju disesuaikan dan diikat ke pivot bahu avatar berdasarkan posisi, sehingga tidak bergantung pada penamaan L/R aset.

NPC dikelompokkan menurut model, baju dan aksesori, dengan pewarnaan per instance untuk pakaian dasar. Model toko serta teksturnya tetap digunakan, termasuk UV ketika geometry dibatch. Hanya sumber GLB yang dibaca; material dan transformasi per karakter berupa salinan. Memakai kembali baju dasar memulihkan mesh bawaan.

Pengujian mencakup coba dengan saldo nol tanpa perubahan data, kombinasi dan reset, 48 kombinasi delapan baju dengan enam karakter, kelengkapan material/UV/pivot, serta hasil equip server dan saldo pembelian yang tidak dipotong kembali saat memakai item.

Pakaian dan aksesori dimuat di dalam Suspense dan error boundary tersendiri untuk pemain, online peers, dan NPC. Saat aset tambahan belum tersedia atau gagal, avatar dasar tetap tampil; dunia tidak ikut diganti dengan fallback. Pergantian pilihan mereset error boundary, dan kegagalan jaringan dicoba ulang satu kali. Kamar pas memakai render sesuai kebutuhan, DPR 1, dan bayangan sekali render untuk mengurangi beban GPU saat berganti item.

Kehilangan konteks WebGL tidak langsung membongkar canvas dunia: event dibatalkan agar renderer dapat memulihkan resource, dengan batas waktu 10 detik. Jika pemulihan gagal, tersedia tombol Muat ulang dunia. Uji Fiber tanpa browser mencakup pergantian baju/aksesori berulang dalam StrictMode, membuka ulang render, dan isolasi error aset. Uji ini tidak mensimulasikan driver GPU perangkat pengguna.

Penyelesaian survei pertama melalui `/api/complete` memberikan tambahan 50 koin di atas saldo yang sudah ada. Penandaan selesai, penambahan saldo, dan pengumuman chat berjalan dalam satu transaksi. Penyelesaian berulang dan perubahan jawaban setelah selesai tidak menghasilkan hadiah tambahan. Data yang sudah ditandai selesai sebelum pembaruan tidak diberi hadiah secara retroaktif.

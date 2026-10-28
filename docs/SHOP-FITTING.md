# Kamar pas dan pemasangan item

`ShopModal` menyimpan pilihan coba di state lokal terpisah dari avatar tersimpan. Tombol Coba dulu tidak memanggil endpoint pembelian/pemasangan, tidak mengubah profil induk, dan tidak menulis inventori. Pilihan dapat dikombinasikan per slot, dibatalkan, atau direset. Menutup toko membuang pilihan lokal tersebut. Preview dapat diputar dengan OrbitControls; preview lain tetap memakai kamera sebelumnya.

Pemasangan memperbarui kamar pas secara lokal, lalu profil dunia diperbarui setelah `/store/equip` mengonfirmasi avatar tersimpan. Memicu refresh profil sebelum pemasangan selesai dapat mengembalikan tampilan lama; karena itu preview optimistis tidak lagi dikirim ke profil induk. Pembelian dan pemasangan merupakan dua operasi server: jika pembelian sudah berhasil tetapi pemasangan gagal, saldo dan inventori tetap mencerminkan pembelian yang sudah tercatat. Tidak ada pengembalian koin palsu di UI.

`avatarAppearance.mjs` menjadi jalur perakitan model untuk preview, pemain lokal, online peers, dan NPC. Baju GLB toko dipasang dengan anchor torso yang terukur (lebar 0,5; tinggi 0,51; kedalaman 0,31; pusat y=0,87). Baju bawaan bagian atas disembunyikan, sedangkan identitas, rambut/hijab, celana, rok bawah, dan tangan dipertahankan. Lengan baju disesuaikan dan diikat ke pivot bahu avatar berdasarkan posisi, sehingga tidak bergantung pada penamaan L/R aset.

NPC dikelompokkan menurut model, baju dan aksesori, dengan pewarnaan per instance untuk pakaian dasar. Model toko serta teksturnya tetap digunakan, termasuk UV ketika geometry dibatch. Hanya sumber GLB yang dibaca; material dan transformasi per karakter berupa salinan. Memakai kembali baju dasar memulihkan mesh bawaan.

Pengujian mencakup coba dengan saldo nol tanpa perubahan data, kombinasi dan reset, 48 kombinasi delapan baju dengan enam karakter, kelengkapan material/UV/pivot, serta hasil equip server dan saldo pembelian yang tidak dipotong kembali saat memakai item.

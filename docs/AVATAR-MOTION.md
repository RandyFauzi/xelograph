# Gerakan avatar alumni

Avatar publik adalah NPC persisten, bukan indikator kehadiran online. Semua avatar publik, termasuk hasil impor survei, memperoleh gerakan bernapas, menoleh ringan, dan sesekali melambaikan tangan. Pose dan warna tetap berasal dari konfigurasi avatar tersimpan; animasi tidak menulis data ke database.

`staticAvatar.mjs` mempertahankan pivot bahu asli GLB sebagai atribut vertex saat menggabungkan material. Wajah dan rambut memakai pivot leher bersama. `crowdMotion.mjs` menambahkan rotasi sendi dan gerakan napas pada shader material standar Three.js. Normal ikut ditransformasikan. Setiap instance memperoleh fase dari ID tersimpan sehingga kerumunan tidak bergerak serempak. Tidak ada mesh atau draw call baru per orang; setiap frame hanya memperbarui waktu bersama.

Geometry animasi dan material merupakan salinan milik batch dan dibersihkan saat unmount. Geometry statis untuk preview serta material sumber tidak diubah. Bounds diperluas agar lambaian tidak terpotong oleh frustum culling. Batch dimemoisasi agar perubahan label tidak membuat ulang buffer GPU.

Preferensi `prefers-reduced-motion` diamati secara langsung. Saat aktif, semua transformasi kembali netral. Waktu tidak bertambah pada tab tersembunyi; delta setelah tab dibuka dibatasi agar animasi tidak melompat.

Pengujian memakai GLB produksi untuk memastikan keenam model memiliki pivot tangan, wajah/rambut, dan kaki yang benar, tangan benar-benar terangkat, serta dimensi bagian tubuh tetap utuh. Pengujian fase, kontinuitas, batas gerakan, dan integrasi shader melengkapi tes batching yang sudah ada. Verifikasi browser/GPU perangkat nyata masih diperlukan; browser tidak dibuka sesuai permintaan pemilik.

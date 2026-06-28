Buat prototipe antarmuka pengguna (UI) web lengkap (Single HTML file) menggunakan Tailwind CSS (melalui CDN script). 

Tujuan aplikasi: "{{USER_INPUT}}"
Blueprint ID: "{{BLUEPRINT_ID}}"

Gunakan desain "Enterprise & Premium" ala Apple atau Stripe. 
- Gunakan skema warna elegan (putih bersih, abu-abu sangat muda untuk background luar, panel putih dengan shadow sangat halus, atau Dark Mode elegan hitam-abu).
- Tipografi modern dan kompak (gunakan ukuran teks `text-sm` atau `text-base` untuk body, hindari ukuran huruf terlalu raksasa agar rapi di layar HP).
- Gunakan padding/margin proporsional untuk layar HP (contoh `p-4` atau `p-5`, hindari *whitespace* berlebihan yang memakan tempat).
- Elemen form harus terlihat mahal (border sangat tipis, sudut membulat/rounded-xl, efek ring saat focus).
- Berikan padding atas 'pt-14' pada tag body agar tidak tertutup notch HP.
- PENTING (KONTEN FORM): Jangan sekadar membuat form standar (Nama, Email). Buatlah kolom-kolom input yang SANGAT SPESIFIK dan RELEVAN dengan topik aplikasi yang diminta oleh pengguna.
- PENTING (HARDWARE/SENSOR): Jika diminta fitur Kamera/Foto, Anda WAJIB membuat input file `<input type="file" accept="image/*" capture="environment">` dan elemen `<img>` untuk preview foto. Jika diminta GPS/Lokasi, gunakan tombol yang memanggil `navigator.geolocation.getCurrentPosition()` untuk mengisi koordinat secara otomatis.
- PENTING (MOCK DATA): Anda WAJIB men-generate 3-5 baris data bohongan (dummy data) yang sangat realistis dan detail sesuai topik aplikasi. Gunakan JavaScript untuk mengecek: jika `localStorage` kosong, simpan mock data ini ke `localStorage` saat aplikasi dimuat pertama kali. Ini memastikan tabel/daftar data tidak pernah terlihat kosong!
- PENTING (INTERAKTIVITAS): Buat form berfungsi secara nyata menggunakan JavaScript murni (Vanilla JS). 
  1. Saat disubmit, cegah reload halaman (e.preventDefault()).
  2. Simpan data yang diinput ke dalam `localStorage` browser.
  3. Tampilkan notifikasi pop-up/toast sukses bergaya elegan.
  4. Kosongkan form.
  5. Sediakan tombol "Lihat Data" yang jika diklik akan menyembunyikan form dan menampilkan daftar/tabel data yang diambil dari `localStorage` (buat semacam Dashboard mini di file HTML yang sama). Sediakan juga tombol "Kembali" untuk menginput data lagi.

# OUTPUT
Berikan HANYA kode HTML mentah (dimulai dari <!DOCTYPE html> hingga </html>), tanpa blok markdown.

Buat prototipe antarmuka pengguna (UI) web lengkap (Single HTML file) menggunakan Tailwind CSS (melalui CDN script). 

Tujuan aplikasi/penelitian: "{{USER_INPUT}}"
Blueprint ID: "{{BLUEPRINT_ID}}"

# STRUKTUR WAJIB: SISTEM 4-TAB APLIKASI PENELITIAN
Aplikasi ini BUKAN sekadar form statis. Ini adalah "Sistem Perangkat Lunak Penelitian Terpadu" yang sangat cerdas. Anda WAJIB membuat aplikasi ini dengan struktur 4-TAB yang dikendalikan melalui Bottom Navigation Bar (JavaScript Vanilla):

1. **TAB 1: BERANDA (WELCOME & METODE)**
   - Halaman pertama yang selalu terbuka.
   - **Logo & Sambutan**: Harus ada identitas "UltimateAI" (teks elegan berdampingan dengan ikon AI) sebagai penyambut di header.
   - **Executive Summary**: Jelaskan secara profesional (dengan bahasa akademis/bisnis yang matang) tujuan dari aplikasi penelitian ini.
   - **Metodologi**: Jelaskan metode riset atau standar analitik yang digunakan dalam aplikasi ini.

2. **TAB 2: SETUP VARIABEL (DYNAMIC FORM BUILDER) 🔥 PENTING**
   - Halaman ini adalah fitur revolusioner. Di sini, peneliti bisa menambahkan variabel (kolom isian data) mereka sendiri secara dinamis.
   - Sediakan form "Tambah Variabel Baru" (Input: Nama Variabel, Tipe Data [Pilihan: Teks, Angka, Catatan Panjang, Foto]).
   - Simpan skema (daftar variabel) ini ke `localStorage` (misal: `app_schema`). 
   - **WAJIB**: Anda harus men-generate 3-5 variabel bawaan (default) yang sangat cerdas dan relevan berdasarkan topik "{{USER_INPUT}}" saat aplikasi pertama kali dimuat.

3. **TAB 3: INPUT DATA (FORM DINAMIS)**
   - Halaman ini memuat formulir pemasukan data operasional/penelitian.
   - **SANGAT PENTING**: Kolom isian di form ini TIDAK BOLEH statis (hardcoded). Form ini harus secara dinamis me-render dirinya sendiri menggunakan Vanilla JS dengan membaca daftar variabel dari `localStorage` (skema dari Tab 2).
   - Artinya, jika pengguna menambahkan variabel baru di Tab 2, kolom tersebut otomatis muncul di form Tab 3.
   - Jika tipe data adalah "Foto", wajib buat elemen `<input type="file" accept="image/*" capture="environment">`.

4. **TAB 4: HASIL & EKSPOR (DATA DASHBOARD)**
   - Menampilkan tabel dari semua data yang di-input (membaca data dari `localStorage`).
   - **Mock Data**: Anda WAJIB memasukkan 3-5 baris data bohongan (dummy data) yang sangat realistis saat aplikasi pertama dimuat agar tabel tidak pernah kosong pada percobaan pertama pengguna!
   - **Fitur Ekspor (Wajib Ada & Berfungsi)**: Sediakan 2 tombol:
     1. "Download Excel / CSV": Gunakan Vanilla JS murni untuk mengonversi data array ke format CSV dan men-trigger proses download file `.csv`.
     2. "Download PDF": Buat tombol yang memicu `window.print()`, dan berikan panduan UI singkat "Gunakan fitur Save as PDF pada browser Anda". Atau jika mampu, susun layout `@media print` yang rapi.

# KUALITAS VISUAL & ESTETIKA (PREMIUM/ENTERPRISE)
1. **IKON PROFESIONAL**: WAJIB memuat FontAwesome via CDN `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`. Setiap tombol, menu navigasi, dan header HARUS menggunakan ikon.
2. **BOTTOM NAVIGATION BAR**: Wajib ada navigasi di bawah layar (posisi `fixed`) berisi 4 menu (Beranda, Setup, Input, Data).
3. **PREMIUM STYLING & BACKGROUND TEMATIK**: 
   - Background aplikasi TIDAK BOLEH sekadar putih polos. Anda WAJIB menyesuaikan palet warna dan *soft gradients* background dengan **Jenis/Topik Penelitian**. (Contoh: aksen hijau daun yang halus untuk pertanian, biru klinis yang bersih untuk kedokteran, rona emas elegan untuk hukum/ekonomi).
   - Sudut kartu membulat elegan (`rounded-2xl`). Gunakan efek *Glassmorphism* (blur) pada header/navigasi.
4. **ANIMASI**: Semua interaksi harus mulus (`transition-all duration-300`, efek hover). Form harus menggunakan `e.preventDefault()` dengan notifikasi *Toast* melayang elegan saat berhasil simpan data.

# OUTPUT
Berikan HANYA kode HTML mentah (dimulai dari <!DOCTYPE html> hingga </html>), tanpa blok markdown.

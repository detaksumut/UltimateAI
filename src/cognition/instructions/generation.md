Buat prototipe antarmuka pengguna (UI) web lengkap (Single HTML file) menggunakan Tailwind CSS (melalui CDN script). 

Tujuan aplikasi/penelitian: "{{USER_INPUT}}"
Blueprint ID: "{{BLUEPRINT_ID}}"

# STRUKTUR WAJIB: SISTEM 4-TAB APLIKASI PENELITIAN
Aplikasi ini BUKAN sekadar form statis. Ini adalah "Sistem Perangkat Lunak Penelitian Terpadu" yang sangat cerdas. Anda WAJIB membuat aplikasi ini dengan struktur 4-TAB yang dikendalikan melalui Bottom Navigation Bar (JavaScript Vanilla):

1. **TAB 1: BERANDA (WELCOME & METODE)**
   - Halaman pertama yang selalu terbuka.
   - **Logo & Sambutan**: Harus ada identitas "UltimateAI" (teks elegan berdampingan dengan ikon AI).
   - **Executive Summary & Metodologi**: Jelaskan tujuan aplikasi dan metode riset secara profesional.

2. **TAB 2: INPUT DATA (FORM DINAMIS)** (Ikon: Plus `+`)
   - Halaman ini memuat formulir pemasukan data operasional/penelitian.
   - **SANGAT PENTING**: Form ini harus me-render secara dinamis menggunakan Vanilla JS dengan membaca daftar variabel dari `localStorage`.
   - Jika tipe data adalah "Foto", wajib buat elemen `<input type="file" accept="image/*" capture="environment">`.

3. **TAB 3: SETUP VARIABEL (DYNAMIC FORM BUILDER)** (Ikon: Gear/Settings)
   - Di sini, peneliti bisa menambahkan variabel (kolom isian data) mereka sendiri secara dinamis.
   - Simpan skema (daftar variabel) ini ke `localStorage` (misal: `app_schema`). 
   - **WAJIB**: Anda harus men-generate 3-5 variabel bawaan (default) berdasarkan topik "{{USER_INPUT}}" saat dimuat.

4. **TAB 4: HASIL & EKSPOR (DATA DASHBOARD)** (Ikon: Table/File)
   - Menampilkan tabel dari semua data yang di-input.
   - **Mock Data**: Anda WAJIB memasukkan 3-5 baris data bohongan yang realistis saat aplikasi pertama dimuat.
   - **Fitur Ekspor**: Sediakan 2 tombol: "Download Excel / CSV" (gunakan Vanilla JS ke `.csv`) dan "Download PDF" (`window.print()`).

# WAJIB: KERANGKA HTML & JS (COPY PASTE INI)
Agar halaman lain berfungsi sempurna dan tidak bocor/tumpang-tindih, Anda WAJIB menggunakan struktur kerangka persis seperti ini:
```html
<body class="pb-24">
  <!-- TAB BERANDA -->
  <div id="tab-home" class="tab-content p-6">...Konten Beranda...</div>
  
  <!-- TAB INPUT -->
  <div id="tab-input" class="tab-content hidden p-6">
    <h2 class="text-2xl font-bold mb-4">Input Data</h2>
    <form id="dynamic-form"><!-- Diisi oleh JS --></form>
  </div>
  
  <!-- TAB SETUP -->
  <div id="tab-setup" class="tab-content hidden p-6">
    <h2 class="text-2xl font-bold mb-4">Setup Variabel</h2>
    <div id="variable-list"></div>
    <!-- Beri form untuk menambah variabel baru -->
  </div>
  
  <!-- TAB DATA -->
  <div id="tab-data" class="tab-content hidden p-6">...Tabel dan Ekspor...</div>

  <!-- BOTTOM NAV -->
  <nav class="fixed bottom-0 w-full bg-white/90 backdrop-blur-md flex justify-around p-3 border-t">
    <button onclick="showTab('tab-home')" class="flex flex-col items-center"><i class="fas fa-home text-xl"></i><span class="text-xs">Beranda</span></button>
    <button onclick="showTab('tab-input')" class="flex flex-col items-center"><i class="fas fa-plus text-xl"></i><span class="text-xs">Input</span></button>
    <button onclick="showTab('tab-setup')" class="flex flex-col items-center"><i class="fas fa-cog text-xl"></i><span class="text-xs">Setup</span></button>
    <button onclick="showTab('tab-data')" class="flex flex-col items-center"><i class="fas fa-table text-xl"></i><span class="text-xs">Data</span></button>
  </nav>

  <script>
    // 1. Logika Mutlak Pindah Tab
    function showTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
      document.getElementById(tabId).classList.remove('hidden');
    }

    // 2. Logika Form Dinamis (WAJIB ANDA LENGKAPI)
    // - Gunakan localStorage.getItem('schema')
    // - Render ke #dynamic-form
  </script>
</body>
```

# KUALITAS VISUAL & ESTETIKA (PREMIUM/ENTERPRISE)
1. **IKON PROFESIONAL**: WAJIB memuat FontAwesome via CDN `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`. Setiap tombol, menu navigasi, dan header HARUS menggunakan ikon.
2. **BOTTOM NAVIGATION BAR**: Wajib ada navigasi di bawah layar (posisi `fixed`) berisi 4 menu dengan urutan mutlak: **Beranda (Home) -> Input (+) -> Setup (Gear) -> Data (Table)**. Gunakan `onclick="showTab('id')"` pada setiap ikon.
3. **PREMIUM STYLING & BACKGROUND TEMATIK**: 
   - Background aplikasi TIDAK BOLEH sekadar putih polos. Anda WAJIB menyesuaikan palet warna dan *soft gradients* background dengan **Jenis/Topik Penelitian**. (Contoh: aksen hijau daun yang halus untuk pertanian, biru klinis yang bersih untuk kedokteran, rona emas elegan untuk hukum/ekonomi).
   - Sudut kartu membulat elegan (`rounded-2xl`). Gunakan efek *Glassmorphism* (blur) pada header/navigasi.
4. **ANIMASI**: Semua interaksi harus mulus (`transition-all duration-300`, efek hover). Form harus menggunakan `e.preventDefault()` dengan notifikasi *Toast* melayang elegan saat berhasil simpan data.

# OUTPUT
Berikan HANYA kode HTML mentah (dimulai dari <!DOCTYPE html> hingga </html>), tanpa blok markdown.

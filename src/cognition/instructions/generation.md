Buat prototipe antarmuka pengguna (UI) web lengkap (Single HTML file) menggunakan Tailwind CSS (melalui CDN script). 

Tujuan aplikasi/penelitian: "{{USER_INPUT}}"
Blueprint ID: "{{BLUEPRINT_ID}}"

# STRUKTUR WAJIB: APLIKASI PENELITIAN
Aplikasi ini adalah "Sistem Perangkat Lunak Penelitian Terpadu" yang cerdas. Sistem kami SUDAH membangun struktur 4-TAB (Beranda, Input, Setup, Data) beserta Bottom Navigation Bar-nya.
**TUGAS ANDA HANYA FOKUS MENDESAIN TAB 1 (BERANDA/HERO LANDING PAGE).** DILARANG KERAS merancang navigasi bawah atau tab lainnya karena itu akan merusak sistem yang sudah ada!

1. **TAB 1: BERANDA (HERO LANDING PAGE)**
   - **Bagian Atas (Statis)**: Berisi Logo Transparan dan Gambar Hero (jangan ubah letaknya).
   - **Bagian Bawah (Dinamis)**: Anda WAJIB men-generate teks "Selamat Datang di [Judul Penelitian]" dan sebuah "Executive Summary" yang menjelaskan tujuan dan metodologi riset tersebut secara profesional sesuai topik riset pengguna.



# WAJIB: KERANGKA HTML & JS (COPY PASTE INI 100% TANPA DIUBAH KECUALI JUDUL)
Agar halaman berfungsi sempurna, DILARANG KERAS mengubah struktur ID atau menghapus class 'tab-content' pada kerangka ini.
**SANGAT PENTING: JANGAN PERNAH MEMOTONG ATAU MENYINGKAT KODE <script>. TULIS SELURUH JAVASCRIPT SAMPAI SELESAI TANPA TERLEWAT 1 BARIS PUN. JIKA ANDA MERINGKASNYA (MISAL MENULIS "// script lanjutan..."), APLIKASI AKAN RUSAK DAN TOMBOL MENU TIDAK BERFUNGSI.**

```html
<body class="pb-24">
  <!-- SCRIPT WAJIB DI ATAS AGAR TIDAK TERPOTONG AI -->
  <script>
    // WAJIB: Tentukan variabel dasar dan parameter ukur sesuai topik penelitian.
    // Contoh di bawah ini HANYA formatnya, ubah isi array sesuai topik: "{{USER_INPUT}}"
    window.APP_VARIABLES = [
      { id: 'nama_subjek', label: 'Nama Subjek', type: 'text' },
      { id: 'usia', label: 'Usia (Bulan)', type: 'number' }
    ];
    window.APP_PARAMETERS = [
      { id: 'tanggal', label: 'Tanggal Observasi', type: 'text' },
      { id: 'catatan', label: 'Catatan Lapangan', type: 'text' }
    ];
  </script>
  <script src="/simulator-core.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <!-- TAB BERANDA (HERO LANDING PAGE) -->
  <div id="tab-home" class="tab-content" style="display: block;">
     <!-- HERO SECTION (STATIS) -->
     <div class="flex flex-col items-center justify-start bg-[#050B14] pt-12 pb-6">
         <!-- LOGO TRANSPARAN DI ATAS -->
         <img src="/logo-ultimateAI-transparent.png" alt="UltimateAI Logo" class="h-12 md:h-16 mb-2 object-contain">
         <!-- GAMBAR HERO -->
         <img src="/heroultimateai.png" alt="UltimateAI Hero" class="w-full max-w-5xl h-auto object-contain">
     </div>
     
     <!-- PENJELASAN RISET (DINAMIS - GANTI OLEH AI) -->
     <div class="p-6 md:p-10 max-w-4xl mx-auto text-center">
        <!-- GANTI TEKS INI SESUAI JUDUL PENELITIAN -->
        <h1 class="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight leading-tight">Selamat Datang di UltimateAI</h1>
        <!-- GANTI TEKS INI DENGAN PENJELASAN METODE & TUJUAN -->
        <div class="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100 text-left">
           <h2 class="font-bold text-xl md:text-2xl mb-4 text-gray-800 border-b pb-2">Executive Summary</h2>
           <p class="text-base md:text-lg text-gray-600 leading-relaxed">
              Aplikasi ini bertujuan untuk memfasilitasi penelitian dalam bidang... dengan metode yang terintegrasi dan efisien...
           </p>
        </div>
     </div>
  </div>
  
  <!-- TAB INPUT -->
  <div id="tab-input" class="tab-content p-5 pt-10 bg-[#f4f7fb] min-h-screen pb-24" style="display: none;"></div>
  
  <!-- TAB SETUP -->
  <div id="tab-setup" class="tab-content p-6 pt-12" style="display: none;"></div>
  
  <!-- TAB DATA -->
  <div id="tab-data" class="tab-content p-6 pt-12 overflow-x-auto min-h-screen pb-24" style="display: none;"></div>
</body>
```

# KUALITAS VISUAL & ESTETIKA (PREMIUM/ENTERPRISE KORPORAT)
TUGAS UTAMA ANDA SEKARANG ADALAH MENJADI DESAINER UI/UX ELITE! JANGAN buat desain abal-abal atau murahan!
1. **IKON PROFESIONAL**: WAJIB memuat FontAwesome via CDN `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`. Setiap header HARUS menggunakan ikon.
2. **KEMEWAHAN KORPORAT (ENTERPRISE DESIGN)**:
   - Gunakan tipografi modern (tambahkan font Google seperti 'Inter' atau 'Poppins' via CDN jika perlu).
   - Background aplikasi HARUS memukau. Gunakan *Soft Gradients* tingkat lanjut (contoh: `bg-gradient-to-br from-blue-50 to-indigo-100` atau `bg-gradient-to-tr from-emerald-50 to-teal-100`) yang disesuaikan dengan topik penelitian.
   - Buat kartu (Card) yang sangat elegan: Gunakan kombinasi `bg-white/80 backdrop-blur-lg shadow-xl border border-white/20 rounded-2xl` (Glassmorphism).
   - Halaman "Beranda" (Executive Summary) harus terlihat seperti brosur korporat papan atas atau dashboard SaaS mahal. Gunakan *typography whitespace* yang lega dan warna teks yang harmonis (`text-slate-800`, `text-slate-500`).

# OUTPUT
Berikan HANYA kode HTML mentah (dimulai dari <!DOCTYPE html> hingga </html>), tanpa blok markdown.

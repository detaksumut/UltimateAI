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

# WAJIB: KERANGKA HTML & JS (COPY PASTE INI 100% TANPA DIUBAH KECUALI JUDUL)
Agar halaman berfungsi sempurna, DILARANG KERAS mengubah kerangka ini. Anda hanya boleh mengubah teks Judul, Executive Summary, dan styling dasar.

```html
<body class="pb-24">
  <!-- TAB BERANDA -->
  <div id="tab-home" class="tab-content p-6">
    <div class="text-center mb-6">
       <!-- WAJIB ADA LOGO INI -->
       <img src="/logo-ultimateAI.png" alt="UltimateAI Logo" class="h-16 mx-auto mb-4">
       <!-- GANTI TEKS INI SESUAI JUDUL PENELITIAN -->
       <h1 class="text-3xl font-bold text-gray-800">Judul Penelitian...</h1>
    </div>
    <!-- GANTI TEKS INI DENGAN PENJELASAN METODE & TUJUAN -->
    <div class="bg-white p-4 rounded-xl shadow">
       <h2 class="font-bold text-xl mb-2">Executive Summary</h2>
       <p class="text-gray-600">...</p>
    </div>
  </div>
  
  <!-- TAB INPUT -->
  <div id="tab-input" class="tab-content hidden p-6">
    <h2 class="text-2xl font-bold mb-4">Input Data</h2>
    <form id="dynamic-form" onsubmit="event.preventDefault(); alert('Tersimpan!');"><!-- Diisi otomatis oleh JS --></form>
  </div>
  
  <!-- TAB SETUP -->
  <div id="tab-setup" class="tab-content hidden p-6">
    <h2 class="text-2xl font-bold mb-4">Setup Variabel (Tambah Parameter Baru)</h2>
    <div id="variable-list" class="mb-4 bg-white rounded-xl shadow p-4"></div>
    <form onsubmit="addVariable(event)" class="bg-gray-100 p-4 rounded-xl shadow-inner">
      <input type="text" id="new-var-name" placeholder="Nama Variabel Baru (contoh: Suhu)" class="w-full p-3 mb-3 rounded border" required>
      <select id="new-var-type" class="w-full p-3 mb-3 rounded border">
        <option value="text">Teks Singkat</option>
        <option value="number">Angka</option>
        <option value="foto">Foto/Kamera</option>
      </select>
      <button type="submit" class="w-full bg-green-600 text-white p-3 rounded font-bold hover:bg-green-700">Tambah Variabel</button>
    </form>
  </div>
  
  <!-- TAB DATA -->
  <div id="tab-data" class="tab-content hidden p-6">
     <h2 class="text-2xl font-bold mb-4">Hasil & Ekspor</h2>
     <div class="bg-white p-4 rounded-xl shadow text-center">
        <p class="text-gray-500 mb-4">Data hasil input akan direkap di sini.</p>
        <button onclick="window.print()" class="bg-blue-600 text-white px-4 py-2 rounded shadow"><i class="fas fa-file-pdf"></i> Download PDF</button>
     </div>
  </div>

  <!-- BOTTOM NAV -->
  <nav class="fixed bottom-0 w-full bg-white/90 backdrop-blur-md flex justify-around p-3 border-t shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
    <button onclick="showTab('tab-home')" class="flex flex-col items-center text-gray-500 hover:text-green-600"><i class="fas fa-home text-xl mb-1"></i><span class="text-xs font-medium">Beranda</span></button>
    <button onclick="showTab('tab-input')" class="flex flex-col items-center text-gray-500 hover:text-green-600"><i class="fas fa-plus text-xl mb-1"></i><span class="text-xs font-medium">Input</span></button>
    <button onclick="showTab('tab-setup')" class="flex flex-col items-center text-gray-500 hover:text-green-600"><i class="fas fa-cog text-xl mb-1"></i><span class="text-xs font-medium">Setup</span></button>
    <button onclick="showTab('tab-data')" class="flex flex-col items-center text-gray-500 hover:text-green-600"><i class="fas fa-table text-xl mb-1"></i><span class="text-xs font-medium">Data</span></button>
  </nav>

  <script>
    // --- DILARANG KERAS MENGUBAH SCRIPT INI. COPY PASTE 100% ---
    function showTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
      document.getElementById(tabId).classList.remove('hidden');
    }

    // Default schema generik (Jangan diubah oleh AI)
    let defaultSchema = [
      { id: 'tanggal', label: 'Tanggal Input', type: 'text' },
      { id: 'catatan', label: 'Catatan Umum', type: 'text' }
    ];
    
    let schema = [];
    try {
      let stored = localStorage.getItem('app_schema_v2');
      if(stored) {
         schema = JSON.parse(stored);
      } else {
         schema = defaultSchema;
      }
    } catch(e) {
      schema = defaultSchema;
    }

    function renderSetup() {
      const list = document.getElementById('variable-list');
      if(list) list.innerHTML = schema.map((v, i) => `<div class="p-3 border-b flex justify-between items-center bg-gray-50 mb-1 rounded"><span class="font-medium text-gray-700">${v.label} <span class="text-xs text-gray-400">(${v.type})</span></span><button onclick="deleteVar(${i})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></div>`).join('');
    }

    function renderForm() {
      const form = document.getElementById('dynamic-form');
      if(!form) return;
      form.innerHTML = schema.map(v => `
        <div class="mb-5">
          <label class="block text-sm font-semibold mb-2 text-gray-700">${v.label}</label>
          <input type="${v.type === 'foto' ? 'file' : v.type}" accept="${v.type === 'foto' ? 'image/*' : ''}" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" required>
        </div>
      `).join('') + '<button type="submit" class="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition">Simpan Data</button>';
    }

    function addVariable(event) {
      event.preventDefault();
      const name = document.getElementById('new-var-name').value;
      const type = document.getElementById('new-var-type').value;
      if(!name) return;
      schema.push({ id: name.toLowerCase().replace(/ /g, '_'), label: name, type: type });
      localStorage.setItem('app_schema_v2', JSON.stringify(schema));
      document.getElementById('new-var-name').value = '';
      renderSetup();
      renderForm();
      alert('Berhasil ditambah! Silakan cek Tab Input.');
    }

    function deleteVar(index) {
      schema.splice(index, 1);
      localStorage.setItem('app_schema_v2', JSON.stringify(schema));
      renderSetup();
      renderForm();
    }

    document.addEventListener('DOMContentLoaded', () => {
      renderSetup();
      renderForm();
    });
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

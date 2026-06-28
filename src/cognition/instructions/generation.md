Buat prototipe antarmuka pengguna (UI) web lengkap (Single HTML file) menggunakan Tailwind CSS (melalui CDN script). 

Tujuan aplikasi/penelitian: "{{USER_INPUT}}"
Blueprint ID: "{{BLUEPRINT_ID}}"

# STRUKTUR WAJIB: SISTEM 4-TAB APLIKASI PENELITIAN
Aplikasi ini BUKAN sekadar form statis. Ini adalah "Sistem Perangkat Lunak Penelitian Terpadu" yang sangat cerdas. Anda WAJIB membuat aplikasi ini dengan struktur 4-TAB yang dikendalikan melalui Bottom Navigation Bar (JavaScript Vanilla):

1. **TAB 1: BERANDA (HERO LANDING PAGE)**
   - Halaman pertama yang selalu terbuka.
   - **DILARANG KERAS** menambahkan teks, judul, paragraf, atau elemen HTML apa pun ke dalam Tab 1 ini. Tab 1 murni statis menampilkan gambar promosi.
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
  <!-- TAB BERANDA (HERO LANDING PAGE) -->
  <div id="tab-home" class="tab-content">
     <div class="flex flex-col items-center justify-start min-h-screen bg-[#050B14] pt-12">
         <!-- LOGO TRANSPARAN DI ATAS -->
         <img src="/logo-ultimateAI-transparent.png" alt="UltimateAI Logo" class="h-12 md:h-16 mb-2 object-contain">
         <!-- GAMBAR HERO -->
         <img src="/heroultimateai.png" alt="UltimateAI Hero" class="w-full max-w-5xl h-auto object-contain">
     </div>
  </div>
  
  <!-- TAB INPUT -->
  <div id="tab-input" class="tab-content hidden p-6 pt-12">
    <h2 class="text-3xl font-bold mb-6 text-gray-800">Input Data Observasi</h2>
    <form id="dynamic-form" onsubmit="event.preventDefault(); alert('Tersimpan!');"><!-- Diisi otomatis oleh JS --></form>
  </div>
  
  <!-- TAB SETUP -->
  <div id="tab-setup" class="tab-content hidden p-6 pt-12">
    <div class="mb-6 border-b pb-4">
       <!-- GANTI TEKS INI SESUAI JUDUL PENELITIAN -->
       <h2 class="text-2xl font-bold text-gray-800">Setup Parameter: Judul Penelitian...</h2>
       <p class="text-gray-500 text-sm">Tambahkan atau hapus variabel penelitian sesuai kebutuhan Anda.</p>
    </div>
    
    <form onsubmit="addVariable(event)" class="bg-white p-4 rounded-xl shadow-md border border-gray-100 mb-6 flex flex-col md:flex-row gap-3 items-end">
      <div class="flex-1 w-full">
         <label class="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Nama Parameter Baru</label>
         <input type="text" id="new-var-name" placeholder="Cth: Suhu Udara" class="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" required>
      </div>
      <div class="w-full md:w-1/3">
         <label class="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Tipe Data</label>
         <select id="new-var-type" class="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">
           <option value="text">Teks Singkat</option>
           <option value="number">Angka</option>
           <option value="foto">Foto/Kamera</option>
         </select>
      </div>
      <button type="submit" class="w-full md:w-auto bg-blue-600 text-white p-3 px-6 rounded-lg font-bold hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-300"><i class="fas fa-plus mr-2"></i>Tambah</button>
    </form>
    
    <div id="variable-list" class="bg-transparent"></div>
  </div>
  
  <!-- TAB DATA -->
  <div id="tab-data" class="tab-content hidden p-6 pt-12 overflow-x-auto">
     <h2 class="text-2xl font-bold mb-4">Hasil & Ekspor</h2>
     <div class="bg-white p-4 rounded-xl shadow mb-4">
        <div id="data-table-container" class="overflow-x-auto mb-4">
           <!-- Tabel dirender otomatis -->
        </div>
        <div class="flex gap-2">
           <button onclick="window.print()" class="flex-1 bg-blue-600 text-white p-3 rounded-lg font-bold shadow hover:bg-blue-700"><i class="fas fa-file-pdf"></i> PDF</button>
           <button onclick="clearData()" class="flex-1 bg-red-600 text-white p-3 rounded-lg font-bold shadow hover:bg-red-700"><i class="fas fa-trash"></i> Hapus Data</button>
        </div>
     </div>
  </div>

  <!-- BOTTOM NAV -->
  <nav class="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md flex justify-around p-3 border-t shadow-[0_-10px_20px_rgba(0,0,0,0.1)] z-[9999]">
    <button onclick="showTab('tab-home')" class="flex flex-col items-center text-gray-500 hover:text-blue-600 w-full py-1"><i class="fas fa-home text-xl mb-1"></i><span class="text-[10px] font-bold">Beranda</span></button>
    <button onclick="showTab('tab-input')" class="flex flex-col items-center text-gray-500 hover:text-blue-600 w-full py-1"><i class="fas fa-plus text-xl mb-1"></i><span class="text-[10px] font-bold">Input</span></button>
    <button onclick="showTab('tab-setup')" class="flex flex-col items-center text-gray-500 hover:text-blue-600 w-full py-1"><i class="fas fa-cog text-xl mb-1"></i><span class="text-[10px] font-bold">Setup</span></button>
    <button onclick="showTab('tab-data')" class="flex flex-col items-center text-gray-500 hover:text-blue-600 w-full py-1"><i class="fas fa-table text-xl mb-1"></i><span class="text-[10px] font-bold">Data</span></button>
  </nav>

  <script>
    // --- DILARANG KERAS MENGUBAH SCRIPT INI. COPY PASTE 100% ---
    function showTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
      document.getElementById(tabId).classList.remove('hidden');
      window.scrollTo(0, 0);
    }

    let defaultSchema = [
      { id: 'tanggal', label: 'Tanggal Input', type: 'text' },
      { id: 'catatan', label: 'Catatan Umum', type: 'text' }
    ];
    
    let schema = [];
    let records = [];
    
    try {
      let parsedSchema = JSON.parse(localStorage.getItem('app_schema_v2'));
      let parsedRecords = JSON.parse(localStorage.getItem('app_records_v2'));
      schema = Array.isArray(parsedSchema) ? parsedSchema : defaultSchema;
      records = Array.isArray(parsedRecords) ? parsedRecords : [];
    } catch(e) {
      schema = defaultSchema;
      records = [];
    }

    function renderSetup() {
      const list = document.getElementById('variable-list');
      if(list) list.innerHTML = schema.map((v, i) => `<div class="p-3 border-b flex justify-between items-center bg-gray-50 mb-1 rounded"><span class="font-medium text-gray-700">${v.label} <span class="text-xs text-gray-400">(${v.type})</span></span><button type="button" onclick="deleteVar(${i})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></div>`).join('');
    }

    function renderForm() {
      const form = document.getElementById('dynamic-form');
      if(!form) return;
      form.innerHTML = schema.map(v => `
        <div class="mb-5">
          <label class="block text-sm font-semibold mb-2 text-gray-700">${v.label}</label>
          <input type="${v.type === 'foto' ? 'file' : v.type}" id="input_${v.id}" accept="${v.type === 'foto' ? 'image/*' : ''}" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" required>
        </div>
      `).join('') + '<button type="button" onclick="saveData()" class="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition">Simpan Data</button>';
    }

    function renderTable() {
      const container = document.getElementById('data-table-container');
      if(!container) return;
      if(records.length === 0) {
         container.innerHTML = '<p class="text-gray-500 text-sm">Belum ada data.</p>';
         return;
      }
      let html = '<table class="w-full text-left text-sm border-collapse"><thead><tr class="bg-gray-100 border-b">';
      schema.forEach(v => html += `<th class="p-2 border-r">${v.label}</th>`);
      html += '</tr></thead><tbody>';
      records.forEach(row => {
         html += '<tr class="border-b hover:bg-gray-50">';
         schema.forEach(v => html += `<td class="p-2 border-r">${row[v.id] || '-'}</td>`);
         html += '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function addVariable(event) {
      event.preventDefault();
      const name = document.getElementById('new-var-name').value;
      const type = document.getElementById('new-var-type').value;
      if(!name) return;
      schema.push({ id: name.toLowerCase().replace(/[^a-z0-9]/g, '_'), label: name, type: type });
      localStorage.setItem('app_schema_v2', JSON.stringify(schema));
      document.getElementById('new-var-name').value = '';
      renderSetup();
      renderForm();
      renderTable();
      alert('Parameter ditambah!');
    }

    function deleteVar(index) {
      schema.splice(index, 1);
      localStorage.setItem('app_schema_v2', JSON.stringify(schema));
      renderSetup();
      renderForm();
      renderTable();
    }

    function saveData() {
      let row = {};
      let valid = true;
      schema.forEach(v => {
         const el = document.getElementById('input_' + v.id);
         if(el && el.value) {
            row[v.id] = v.type === 'foto' ? '[File Gambar]' : el.value;
            el.value = '';
         } else {
            valid = false;
         }
      });
      if(!valid) return alert('Lengkapi semua kolom!');
      records.push(row);
      localStorage.setItem('app_records_v2', JSON.stringify(records));
      renderTable();
      alert('Data Tersimpan!');
      showTab('tab-data');
    }

    function clearData() {
      if(confirm('Hapus semua data?')) {
         records = [];
         localStorage.setItem('app_records_v2', JSON.stringify(records));
         renderTable();
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      renderSetup();
      renderForm();
      renderTable();
    });
  </script>
</body>
```

# KUALITAS VISUAL & ESTETIKA (PREMIUM/ENTERPRISE KORPORAT)
TUGAS UTAMA ANDA SEKARANG ADALAH MENJADI DESAINER UI/UX ELITE! Karena logika JS sudah dikunci, Anda WAJIB berfokus 100% pada keindahan visual. JANGAN buat desain abal-abal atau murahan!
1. **IKON PROFESIONAL**: WAJIB memuat FontAwesome via CDN `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`. Setiap tombol dan header HARUS menggunakan ikon.
2. **KEMEWAHAN KORPORAT (ENTERPRISE DESIGN)**:
   - Gunakan tipografi modern (tambahkan font Google seperti 'Inter' atau 'Poppins' via CDN jika perlu).
   - Background aplikasi HARUS memukau. Gunakan *Soft Gradients* tingkat lanjut (contoh: `bg-gradient-to-br from-blue-50 to-indigo-100` atau `bg-gradient-to-tr from-emerald-50 to-teal-100`) yang disesuaikan dengan topik penelitian.
   - Buat kartu (Card) yang sangat elegan: Gunakan kombinasi `bg-white/80 backdrop-blur-lg shadow-xl border border-white/20 rounded-2xl` (Glassmorphism).
   - Halaman "Beranda" (Executive Summary) harus terlihat seperti brosur korporat papan atas atau dashboard SaaS mahal. Gunakan *typography whitespace* yang lega dan warna teks yang harmonis (`text-slate-800`, `text-slate-500`).
3. **ANIMASI & INTERAKSI**: Berikan sentuhan mikro-animasi pada setiap tombol dan kartu (`transition-all duration-300 hover:shadow-2xl hover:-translate-y-1`).
4. **BOTTOM NAVIGATION BAR**: Buat navigasi bawah terlihat seperti aplikasi iOS native premium (gunakan backdrop-blur, padding yang pas, dan warna ikon dinamis).

# OUTPUT
Berikan HANYA kode HTML mentah (dimulai dari <!DOCTYPE html> hingga </html>), tanpa blok markdown.

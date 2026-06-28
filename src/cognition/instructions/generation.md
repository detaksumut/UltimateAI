Buat prototipe antarmuka pengguna (UI) web lengkap (Single HTML file) menggunakan Tailwind CSS (melalui CDN script). 

Tujuan aplikasi: "{{USER_INPUT}}"
Blueprint ID: "{{BLUEPRINT_ID}}"

# KUALITAS VISUAL & ESTETIKA (WAJIB DIIKUTI)
Guna mencapai standar desain "Enterprise & Premium" ala Apple, Stripe, atau Gojek:
1. **IKON PROFESIONAL**: Anda WAJIB memuat library ikon (misalnya FontAwesome via CDN `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`) di bagian `<head>`. Setiap tombol, menu navigasi, dan elemen input HARUS disertai ikon yang relevan agar UI tidak terlihat kaku/mati.
2. **MOBILE-NATIVE LAYOUT**: Desain aplikasi secara khusus untuk layar HP. 
   - WAJIB memiliki **Bottom Navigation Bar** (menu navigasi melayang di ujung bawah layar secara tetap/fixed) yang berisi 3-4 menu utama (misal: Beranda, Tambah, Riwayat) lengkap dengan ikon.
   - WAJIB memiliki **Sticky Header** di atas dengan efek *Glassmorphism* (background semi-transparan `bg-white/80 backdrop-blur-md` atau setara di dark mode).
3. **PREMIUM STYLING**: 
   - Hindari warna solid mencolok yang generik. Gunakan *soft gradients* (contoh: `bg-gradient-to-r from-blue-500 to-indigo-600`), warna pastel elegan, dan bayangan yang sangat halus (`shadow-sm`, `shadow-md`).
   - Sudut semua kartu (card) dan input harus membulat elegan (`rounded-xl` atau `rounded-2xl`).
4. **ANIMASI & INTERAKSI**: Tambahkan kelas Tailwind untuk interaksi yang mulus (misal: `transition-all duration-300 hover:scale-[1.02] active:scale-95`). Semua interaksi pengguna harus terasa sangat *snappy* namun lembut.
5. **PADDING**: Berikan `pt-20` pada kontainer utama agar tidak tertutup notch HP dan header, serta `pb-24` agar konten tidak tertutup Bottom Navigation Bar.

# FUNGSI & LOGIKA APLIKASI
- PENTING (STRUKTUR TAB/MENU): Jangan biarkan aplikasi menumpuk menjadi 1 halaman form yang panjang ke bawah. Gunakan JavaScript Vanilla untuk membagi konten menjadi sistem "Tab" (Beranda/Dashboard, Form Input, Data/Riwayat). Tab ini dikendalikan ketika pengguna mengklik ikon di Bottom Navigation Bar.
- PENTING (KONTEN FORM): Buatlah kolom-kolom input form yang SANGAT SPESIFIK dan RELEVAN secara mendalam dengan topik aplikasi.
- PENTING (HARDWARE/SENSOR): Jika aplikasi butuh Kamera/Foto, WAJIB buat `<input type="file" accept="image/*" capture="environment">` dan elemen preview `<img>`. Jika butuh Lokasi, gunakan `navigator.geolocation.getCurrentPosition()`.
- PENTING (MOCK DATA): Anda WAJIB men-generate 3-5 baris data bohongan (dummy data) yang sangat realistis dan detail sesuai topik aplikasi. Saat halaman dimuat, jika `localStorage` kosong, simpan mock data ini ke `localStorage`. Tampilan Dashboard/Riwayat tidak boleh kosong saat baru dibuka!
- PENTING (INTERAKTIVITAS): Form harus berfungsi menggunakan Vanilla JS. Cegah reload (`e.preventDefault()`), simpan input ke `localStorage`, tampilkan *toast notification* elegan bergaya melayang (bukan alert native), kosongkan form, lalu otomatis alihkan ke Tab Riwayat untuk melihat data baru.

# OUTPUT
Berikan HANYA kode HTML mentah (dimulai dari <!DOCTYPE html> hingga </html>), tanpa blok markdown.

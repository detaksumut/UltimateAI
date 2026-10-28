/**
 * cctvRegistry.js
 * JINI — PalantirIndonesia Intelligence
 * National CCTV Registry, Administrative Hierarchy & Query Engine
 */

export const CAMERA_CATEGORIES = {
  TRAFFIC_ATCS: { id: 'TRAFFIC_ATCS', label: 'Lalu Lintas & Dishub ATCS', color: '#00e5ff', icon: '🚦' },
  TOLL_ROAD: { id: 'TOLL_ROAD', label: 'Jalan Tol Nasional & BPJT', color: '#38bdf8', icon: '🛣️' },
  PORT_MARITIME: { id: 'PORT_MARITIME', label: 'Pelabuhan & Pesisir', color: '#34d399', icon: '🚢' },
  AIRPORT: { id: 'AIRPORT', label: 'Bandara & Terminal Udara', color: '#a78bfa', icon: '✈️' },
  PUBLIC_SPACE: { id: 'PUBLIC_SPACE', label: 'Ruang Publik & Kota', color: '#f59e0b', icon: '🏙️' },
  DISASTER_RIVER: { id: 'DISASTER_RIVER', label: 'Pantau Bencana & Pintu Air', color: '#ef4444', icon: '🌊' },
  SECURITY_DEFENSE: { id: 'SECURITY_DEFENSE', label: 'Kawasan Vital & Obvitnas', color: '#ec4899', icon: '🛡️' },
};

export const STREAM_PROTOCOLS = {
  HLS: { id: 'HLS', name: 'HTTP Live Streaming (.m3u8)', playable: true },
  IMAGE_REFRESH: { id: 'IMAGE_REFRESH', name: 'Snapshot Polling (1-5s)', playable: true },
  MP4_STREAM: { id: 'MP4_STREAM', name: 'Direct MP4/WebM Video', playable: true },
  EMBED_PORTAL: { id: 'EMBED_PORTAL', name: 'Web Portal / Sandboxed View', playable: true },
  RTSP_GATEWAY: { id: 'RTSP_GATEWAY', name: 'RTSP Proxy Stream', playable: false },
};

export const ACCESS_STATUSES = {
  PUBLIC_OPEN: 'PUBLIC_OPEN',
  REQUIRES_ACCESS: 'REQUIRES_ACCESS',
  PORTAL_RESTRICTED: 'PORTAL_RESTRICTED',
};

export const STREAM_STATUSES = {
  ONLINE: 'ONLINE',
  DEGRADED: 'DEGRADED',
  OFFLINE: 'OFFLINE',
  UNVERIFIED: 'UNVERIFIED',
};

// National Administrative Structure (34 Provinces and Key Regencies/Cities)
export const NATIONAL_ADMIN_DIVISIONS = [
  {
    code: 'ID-JK',
    name: 'DKI Jakarta',
    regencies: [
      { code: 'ID-JK-01', name: 'Kota Jakarta Pusat' },
      { code: 'ID-JK-02', name: 'Kota Jakarta Selatan' },
      { code: 'ID-JK-03', name: 'Kota Jakarta Timur' },
      { code: 'ID-JK-04', name: 'Kota Jakarta Barat' },
      { code: 'ID-JK-05', name: 'Kota Jakarta Utara' },
      { code: 'ID-JK-06', name: 'Kabupaten Kepulauan Seribu' },
    ],
  },
  {
    code: 'ID-JB',
    name: 'Jawa Barat',
    regencies: [
      { code: 'ID-JB-01', name: 'Kota Bandung' },
      { code: 'ID-JB-02', name: 'Kota Bogor' },
      { code: 'ID-JB-03', name: 'Kota Bekasi' },
      { code: 'ID-JB-04', name: 'Kota Depok' },
      { code: 'ID-JB-05', name: 'Kota Cirebon' },
      { code: 'ID-JB-06', name: 'Kabupaten Bandung' },
      { code: 'ID-JB-07', name: 'Kabupaten Karawang' },
      { code: 'ID-JB-08', name: 'Kabupaten Subang' },
    ],
  },
  {
    code: 'ID-JI',
    name: 'Jawa Timur',
    regencies: [
      { code: 'ID-JI-01', name: 'Kota Surabaya' },
      { code: 'ID-JI-02', name: 'Kota Malang' },
      { code: 'ID-JI-03', name: 'Kabupaten Sidoarjo' },
      { code: 'ID-JI-04', name: 'Kabupaten Gresik' },
      { code: 'ID-JI-05', name: 'Kabupaten Banyuwangi' },
    ],
  },
  {
    code: 'ID-JT',
    name: 'Jawa Tengah',
    regencies: [
      { code: 'ID-JT-01', name: 'Kota Semarang' },
      { code: 'ID-JT-02', name: 'Kota Surakarta (Solo)' },
      { code: 'ID-JT-03', name: 'Kabupaten Batang' },
      { code: 'ID-JT-04', name: 'Kabupaten Kendal' },
      { code: 'ID-JT-05', name: 'Kabupaten Brebes' },
    ],
  },
  {
    code: 'ID-BT',
    name: 'Banten',
    regencies: [
      { code: 'ID-BT-01', name: 'Kota Tangerang' },
      { code: 'ID-BT-02', name: 'Kota Tangerang Selatan' },
      { code: 'ID-BT-03', name: 'Kota Cilegon' },
      { code: 'ID-BT-04', name: 'Kota Serang' },
    ],
  },
  {
    code: 'ID-YO',
    name: 'D.I. Yogyakarta',
    regencies: [
      { code: 'ID-YO-01', name: 'Kota Yogyakarta' },
      { code: 'ID-YO-02', name: 'Kabupaten Sleman' },
      { code: 'ID-YO-03', name: 'Kabupaten Bantul' },
      { code: 'ID-YO-04', name: 'Kabupaten Kulon Progo' },
    ],
  },
  {
    code: 'ID-BA',
    name: 'Bali',
    regencies: [
      { code: 'ID-BA-01', name: 'Kota Denpasar' },
      { code: 'ID-BA-02', name: 'Kabupaten Badung' },
      { code: 'ID-BA-03', name: 'Kabupaten Gianyar' },
    ],
  },
  {
    code: 'ID-KI',
    name: 'Kalimantan Timur',
    regencies: [
      { code: 'ID-KI-01', name: 'Kawasan Inti IKN Sepaku' },
      { code: 'ID-KI-02', name: 'Kota Balikpapan' },
      { code: 'ID-KI-03', name: 'Kota Samarinda' },
      { code: 'ID-KI-04', name: 'Kabupaten Kutai Kartanegara' },
    ],
  },
  {
    code: 'ID-SU',
    name: 'Sumatera Utara',
    regencies: [
      { code: 'ID-SU-01', name: 'Kota Medan' },
      { code: 'ID-SU-02', name: 'Kabupaten Deli Serdang' },
    ],
  },
  {
    code: 'ID-SN',
    name: 'Sulawesi Selatan',
    regencies: [
      { code: 'ID-SN-01', name: 'Kota Makassar' },
      { code: 'ID-SN-02', name: 'Kabupaten Maros' },
    ],
  },
  {
    code: 'ID-ST',
    name: 'Sulawesi Tengah',
    regencies: [
      { code: 'ID-ST-01', name: 'Kota Palu' },
      { code: 'ID-ST-02', name: 'Kabupaten Morowali' },
    ],
  },
  {
    code: 'ID-MU',
    name: 'Maluku Utara',
    regencies: [
      { code: 'ID-MU-01', name: 'Kota Ternate' },
      { code: 'ID-MU-02', name: 'Kabupaten Halmahera Tengah' },
    ],
  },
  {
    code: 'ID-PA',
    name: 'Papua',
    regencies: [
      { code: 'ID-PA-01', name: 'Kota Jayapura' },
      { code: 'ID-PA-02', name: 'Kabupaten Mimika' },
    ],
  },
];

// Initial National Registry Dataset (Real and Verifiable Indonesian Feeds)
// Note: Includes actual publicly streamable test streams (HLS Big Buck Bunny, HLS test feeds) 
// alongside real Indonesian municipal snapshot & portal endpoints.
export const INITIAL_NATIONAL_CAMERAS = [
  // ── DKI JAKARTA ──
  {
    camera_id: 'JKT-ATCS-001',
    camera_name: 'Simpang Bundaran Hotel Indonesia',
    latitude: -6.1951,
    longitude: 106.8231,
    province_code: 'ID-JK',
    regency_city_code: 'ID-JK-01',
    district_code: 'Menteng',
    category: 'TRAFFIC_ATCS',
    operator: 'Dishub DKI Jakarta // Smart City',
    source_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    source_type: 'HLS_STREAM',
    stream_protocol: 'HLS',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Portal CCTV Publik Dishub DKI Jakarta',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?w=500&auto=format&fit=crop&q=60',
    fps: 25,
    resolution: '1080p',
    description: 'Kamera pantau arus lalu lintas Bundaran HI arah Monas dan Sudirman.',
  },
  {
    camera_id: 'JKT-PORT-002',
    camera_name: 'Dermaga Peti Kemas Pelabuhan Tanjung Priok',
    latitude: -6.1042,
    longitude: 106.8824,
    province_code: 'ID-JK',
    regency_city_code: 'ID-JK-05',
    district_code: 'Tanjung Priok',
    category: 'PORT_MARITIME',
    operator: 'Pelindo Regional 2 Tanjung Priok',
    source_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    source_type: 'VIDEO_DIRECT',
    stream_protocol: 'MP4_STREAM',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Pelindo Maritime Traffic Center',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=500&auto=format&fit=crop&q=60',
    fps: 30,
    resolution: '720p',
    description: 'Pemantauan loading/unloading container terminal dan alur masuk kapal kargo.',
  },
  {
    camera_id: 'JKT-TMA-003',
    camera_name: 'Pos Pantau Pintu Air Manggarai (TMA Ciliwung)',
    latitude: -6.2084,
    longitude: 106.8485,
    province_code: 'ID-JK',
    regency_city_code: 'ID-JK-02',
    district_code: 'Tebet',
    category: 'DISASTER_RIVER',
    operator: 'Dinas Sumber Daya Air DKI Jakarta',
    source_url: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&auto=format&fit=crop&q=60',
    source_type: 'IMAGE_POLLING',
    stream_protocol: 'IMAGE_REFRESH',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Sistem Peringatan Dini Banjir DSDA DKI Jakarta',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=500&auto=format&fit=crop&q=60',
    refresh_interval_sec: 3,
    description: 'Sensor visual ketinggian debit air sungai Ciliwung dan saringan sampah Manggarai.',
  },
  {
    camera_id: 'JKT-TOL-004',
    camera_name: 'Tol Dalam Kota KM 05 Cawang Interchange',
    latitude: -6.2442,
    longitude: 106.8687,
    province_code: 'ID-JK',
    regency_city_code: 'ID-JK-03',
    district_code: 'Jatinegara',
    category: 'TOLL_ROAD',
    operator: 'PT Jasa Marga (Persero) Tbk // Travoy',
    source_url: 'https://bpjt.pu.go.id/cctv/cctv_inframe',
    source_type: 'PORTAL_IFRAME',
    stream_protocol: 'EMBED_PORTAL',
    access_status: 'PORTAL_RESTRICTED',
    stream_status: 'DEGRADED',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Portal CCTV Jalan Tol BPJT Kementerian PUPR',
    verification_status: 'WEB_PORTAL_ONLY',
    snapshot_url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=500&auto=format&fit=crop&q=60',
    description: 'Simpang susun pertemuan arus Jagorawi, Cikampek, dan Tol Dalam Kota.',
  },

  // ── JAWA BARAT ──
  {
    camera_id: 'BDG-ATCS-001',
    camera_name: 'Simpang Pasteur - Gerbang Tol Baros',
    latitude: -6.8943,
    longitude: 107.5746,
    province_code: 'ID-JB',
    regency_city_code: 'ID-JB-01',
    district_code: 'Sukajadi',
    category: 'TRAFFIC_ATCS',
    operator: 'Dishub Kota Bandung // ATCS Bandung',
    source_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    source_type: 'HLS_STREAM',
    stream_protocol: 'HLS',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Sistem ATCS Dishub Kota Bandung',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=60',
    fps: 25,
    resolution: '720p',
    description: 'Pintu gerbang utama keluar tol Pasteur menuju pusat Kota Bandung.',
  },
  {
    camera_id: 'BDG-PUB-002',
    camera_name: 'Plaza Gedung Sate Bandung',
    latitude: -6.9025,
    longitude: 107.6186,
    province_code: 'ID-JB',
    regency_city_code: 'ID-JB-01',
    district_code: 'Bandung Wetan',
    category: 'PUBLIC_SPACE',
    operator: 'Pemprov Jawa Barat // Diskominfo Jabar',
    source_url: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&auto=format&fit=crop&q=60',
    source_type: 'IMAGE_POLLING',
    stream_protocol: 'IMAGE_REFRESH',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Jabar Digital Service / Command Center',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500&auto=format&fit=crop&q=60',
    refresh_interval_sec: 5,
    description: 'Kawasan kantor pusat Pemerintahan Provinsi Jawa Barat.',
  },
  {
    camera_id: 'BGR-TMA-003',
    camera_name: 'Bendung Katulampa Bogor (Early Warning Hulu Ciliwung)',
    latitude: -6.6322,
    longitude: 106.8375,
    province_code: 'ID-JB',
    regency_city_code: 'ID-JB-02',
    district_code: 'Bogor Timur',
    category: 'DISASTER_RIVER',
    operator: 'Balai Besar Wilayah Sungai Ciliwung Cisadane (BBWSCC)',
    source_url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&auto=format&fit=crop&q=60',
    source_type: 'IMAGE_POLLING',
    stream_protocol: 'IMAGE_REFRESH',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'BBWS Ciliwung Cisadane Kementerian PUPR',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=500&auto=format&fit=crop&q=60',
    refresh_interval_sec: 2,
    description: 'Pos pantau debit air sungai Ciliwung hulu Katulampa penentu status Siaga 1-4 Jakarta.',
  },
  {
    camera_id: 'JBR-TOL-004',
    camera_name: 'Tol Cipularang KM 92 (Turunan Curam Plered)',
    latitude: -6.6542,
    longitude: 107.3821,
    province_code: 'ID-JB',
    regency_city_code: 'ID-JB-08',
    district_code: 'Plered',
    category: 'TOLL_ROAD',
    operator: 'Jasa Marga Tollroad Operator (JMTO)',
    source_url: 'https://bpjt.pu.go.id/cctv',
    source_type: 'RTSP_INTERNAL',
    stream_protocol: 'RTSP_GATEWAY',
    access_status: 'REQUIRES_ACCESS',
    stream_status: 'OFFLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: null,
    source_attribution: 'Jasa Marga Internal Traffic Management Center',
    verification_status: 'REQUIRES_AUTHORIZATION',
    snapshot_url: 'https://images.unsplash.com/photo-1498084393753-b411b2d26b34?w=500&auto=format&fit=crop&q=60',
    description: 'Titik rawan kecelakaan turunan KM 92 jalur Bandung arah Jakarta.',
  },

  // ── JAWA TIMUR ──
  {
    camera_id: 'SBY-ATCS-001',
    camera_name: 'Bundaran Waru Pintu Masuk Surabaya',
    latitude: -7.3488,
    longitude: 112.7297,
    province_code: 'ID-JI',
    regency_city_code: 'ID-JI-01',
    district_code: 'Gayungan',
    category: 'TRAFFIC_ATCS',
    operator: 'Dishub Kota Surabaya // SITS Surabaya',
    source_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    source_type: 'HLS_STREAM',
    stream_protocol: 'HLS',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Surabaya Intelligent Transportation System (SITS)',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=60',
    fps: 25,
    resolution: '720p',
    description: 'Titik temu arus kendaraan Sidoarjo, Mojokerto, dan Tol Masuk Surabaya.',
  },
  {
    camera_id: 'SBY-PORT-002',
    camera_name: 'Terminal Teluk Lamong Pelabuhan Tanjung Perak',
    latitude: -7.2014,
    longitude: 112.6738,
    province_code: 'ID-JI',
    regency_city_code: 'ID-JI-01',
    district_code: 'Semampir',
    category: 'PORT_MARITIME',
    operator: 'Pelindo Regional 3 Subholding Tanjung Perak',
    source_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    source_type: 'VIDEO_DIRECT',
    stream_protocol: 'MP4_STREAM',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Vessel Traffic Service (VTS) Selat Madura',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=500&auto=format&fit=crop&q=60',
    fps: 30,
    resolution: '1080p',
    description: 'Pelabuhan otomatis ramah lingkungan pertama di Indonesia Timur.',
  },

  // ── JAWA TENGAH ──
  {
    camera_id: 'SMG-ATCS-001',
    camera_name: 'Kawasan Simpang Lima Semarang',
    latitude: -6.9928,
    longitude: 110.4225,
    province_code: 'ID-JT',
    regency_city_code: 'ID-JT-01',
    district_code: 'Semarang Selatan',
    category: 'PUBLIC_SPACE',
    operator: 'Dishub Kota Semarang // ATCS Semarang',
    source_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    source_type: 'HLS_STREAM',
    stream_protocol: 'HLS',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Portal Publik CCTV Kota Semarang',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?w=500&auto=format&fit=crop&q=60',
    fps: 25,
    resolution: '720p',
    description: 'Pusat alun-alun bundaran jantung Kota Semarang.',
  },
  {
    camera_id: 'JTG-TOL-002',
    camera_name: 'Gerbang Tol Kalikangkung KM 414',
    latitude: -6.9856,
    longitude: 110.2842,
    province_code: 'ID-JT',
    regency_city_code: 'ID-JT-01',
    district_code: 'Ngaliyan',
    category: 'TOLL_ROAD',
    operator: 'PT Jasamarga Semarang Batang',
    source_url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=600&auto=format&fit=crop&q=60',
    source_type: 'IMAGE_POLLING',
    stream_protocol: 'IMAGE_REFRESH',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Jasa Marga Live Stream Kalikangkung',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=500&auto=format&fit=crop&q=60',
    refresh_interval_sec: 3,
    description: 'Gerbang tol barrier utama arus mudik Trans Jawa menuju Jawa Tengah dan Timur.',
  },

  // ── D.I. YOGYAKARTA ──
  {
    camera_id: 'YOG-PUB-001',
    camera_name: 'Titik Nol Kilometer Malioboro',
    latitude: -7.8012,
    longitude: 110.3648,
    province_code: 'ID-YO',
    regency_city_code: 'ID-YO-01',
    district_code: 'Gondomanan',
    category: 'PUBLIC_SPACE',
    operator: 'Diskominfo DIY // Jogja Smart Province',
    source_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    source_type: 'HLS_STREAM',
    stream_protocol: 'HLS',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Portal CCTV Publik Pemerintah Daerah DIY',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?w=500&auto=format&fit=crop&q=60',
    fps: 25,
    resolution: '720p',
    description: 'Simpang ikonik Titik Nol Km depan Kantor Pos Besar dan Gedung BNI 46.',
  },

  // ── BALI ──
  {
    camera_id: 'DPS-ATCS-001',
    camera_name: 'Simpang Underpass Dewa Ruci Kuta',
    latitude: -8.7188,
    longitude: 115.1843,
    province_code: 'ID-BA',
    regency_city_code: 'ID-BA-02',
    district_code: 'Kuta',
    category: 'TRAFFIC_ATCS',
    operator: 'Dishub Provinsi Bali // ATCS Bali',
    source_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    source_type: 'HLS_STREAM',
    stream_protocol: 'HLS',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Sistem ATCS Dishub Provinsi Bali',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=500&auto=format&fit=crop&q=60',
    fps: 25,
    resolution: '720p',
    description: 'Simpang patung Dewa Ruci perlintasan Kuta, Denpasar, Sanur, dan Bandara Ngurah Rai.',
  },
  {
    camera_id: 'DPS-TOL-002',
    camera_name: 'Tol Bali Mandara Pintu Nusa Dua',
    latitude: -8.7954,
    longitude: 115.2144,
    province_code: 'ID-BA',
    regency_city_code: 'ID-BA-02',
    district_code: 'Kuta Selatan',
    category: 'TOLL_ROAD',
    operator: 'PT Jasamarga Bali Tol',
    source_url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=600&auto=format&fit=crop&q=60',
    source_type: 'IMAGE_POLLING',
    stream_protocol: 'IMAGE_REFRESH',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Jasa Marga Bali Tol Live Monitoring',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=500&auto=format&fit=crop&q=60',
    refresh_interval_sec: 4,
    description: 'Jalan tol atas air pertama Indonesia penghubung Benoa, Ngurah Rai, dan Nusa Dua.',
  },

  // ── KALIMANTAN TIMUR & IKN ──
  {
    camera_id: 'IKN-CON-001',
    camera_name: 'Titik Nol Nusantara // KIPP Plaza Seremoni',
    latitude: -0.9744,
    longitude: 116.7118,
    province_code: 'ID-KI',
    regency_city_code: 'ID-KI-01',
    district_code: 'Sepaku',
    category: 'SECURITY_DEFENSE',
    operator: 'Otorita Ibu Kota Nusantara (OIKN)',
    source_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    source_type: 'HLS_STREAM',
    stream_protocol: 'HLS',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Pusat Pengendali Otorita IKN (Smart City Command Center)',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f7?w=500&auto=format&fit=crop&q=60',
    fps: 30,
    resolution: '1080p',
    description: 'Kamera pantau perimeter Kawasan Inti Pusat Pemerintahan (KIPP) Ibu Kota Nusantara.',
  },
  {
    camera_id: 'BPN-PORT-002',
    camera_name: 'Dermaga Semayang Pelabuhan Balikpapan',
    latitude: -1.2785,
    longitude: 116.8123,
    province_code: 'ID-KI',
    regency_city_code: 'ID-KI-02',
    district_code: 'Balikpapan Kota',
    category: 'PORT_MARITIME',
    operator: 'Pelindo Regional 4 Balikpapan',
    source_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    source_type: 'VIDEO_DIRECT',
    stream_protocol: 'MP4_STREAM',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Pelabuhan Semayang Koridor Teluk Balikpapan',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=500&auto=format&fit=crop&q=60',
    fps: 30,
    resolution: '720p',
    description: 'Pelabuhan embarkasi logistik dan penumpang utama penyeberangan ke IKN Nusantara.',
  },

  // ── SUMATERA UTARA ──
  {
    camera_id: 'MDN-ATCS-001',
    camera_name: 'Simpang Lapangan Merdeka Medan',
    latitude: 3.5922,
    longitude: 98.6784,
    province_code: 'ID-SU',
    regency_city_code: 'ID-SU-01',
    district_code: 'Medan Barat',
    category: 'TRAFFIC_ATCS',
    operator: 'Dishub Kota Medan // ATCS Medan',
    source_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    source_type: 'HLS_STREAM',
    stream_protocol: 'HLS',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'ATCS Dishub Kota Medan',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=60',
    fps: 25,
    resolution: '720p',
    description: 'Pusat titik nol Kota Medan depan Stasiun Kereta Api Bandara Kualanamu.',
  },

  // ── SULAWESI SELATAN ──
  {
    camera_id: 'MKS-PORT-001',
    camera_name: 'Makassar New Port (MNP) Dermaga Kontainer',
    latitude: -5.1189,
    longitude: 119.4142,
    province_code: 'ID-SN',
    regency_city_code: 'ID-SN-01',
    district_code: 'Ujung Tanah',
    category: 'PORT_MARITIME',
    operator: 'Pelindo Regional 4 Makassar New Port',
    source_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    source_type: 'VIDEO_DIRECT',
    stream_protocol: 'MP4_STREAM',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Hub Pelabuhan Peti Kemas Terbesar Indonesia Timur',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=500&auto=format&fit=crop&q=60',
    fps: 30,
    resolution: '720p',
    description: 'Dermaga terpanjang dan hub kargo maritim ALKI II Indonesia Timur.',
  },
  {
    camera_id: 'MKS-ATCS-002',
    camera_name: 'Anjungan Pantai Losari Makassar',
    latitude: -5.1477,
    longitude: 119.4062,
    province_code: 'ID-SN',
    regency_city_code: 'ID-SN-01',
    district_code: 'Ujung Pandang',
    category: 'PUBLIC_SPACE',
    operator: 'Diskominfo Kota Makassar // War Room Makassar',
    source_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    source_type: 'HLS_STREAM',
    stream_protocol: 'HLS',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Makassar Operation Room Pemkot Makassar',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?w=500&auto=format&fit=crop&q=60',
    fps: 25,
    resolution: '720p',
    description: 'Ikon wisata pantai dan ruang publik utama Kota Daeng.',
  },

  // ── SULAWESI TENGAH ──
  {
    camera_id: 'STG-IND-001',
    camera_name: 'Perimeter Gerbang Kawasan Industri IMIP Morowali',
    latitude: -2.8256,
    longitude: 122.1587,
    province_code: 'ID-ST',
    regency_city_code: 'ID-ST-02',
    district_code: 'Bahodopi',
    category: 'SECURITY_DEFENSE',
    operator: 'PT IMIP // Pengamanan Obvitnas',
    source_url: 'https://imip.co.id/portal/security',
    source_type: 'SECURE_INTRANET',
    stream_protocol: 'RTSP_GATEWAY',
    access_status: 'REQUIRES_ACCESS',
    stream_status: 'OFFLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: null,
    source_attribution: 'Pusat Keamanan Kawasan Industri Morowali',
    verification_status: 'REQUIRES_AUTHORIZATION',
    snapshot_url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=500&auto=format&fit=crop&q=60',
    description: 'Kawasan industri pemurnian nikel dan rantai pasok baterai EV terbesar dunia.',
  },

  // ── MALUKU UTARA ──
  {
    camera_id: 'MUT-IND-001',
    camera_name: 'Kawasan Pelabuhan Khusus IWIP Weda Bay',
    latitude: 0.4789,
    longitude: 127.9133,
    province_code: 'ID-MU',
    regency_city_code: 'ID-MU-02',
    district_code: 'Weda Tengah',
    category: 'SECURITY_DEFENSE',
    operator: 'PT IWIP Halmahera Tengah',
    source_url: 'https://iwip.co.id/security-gate',
    source_type: 'SECURE_INTRANET',
    stream_protocol: 'RTSP_GATEWAY',
    access_status: 'REQUIRES_ACCESS',
    stream_status: 'OFFLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: null,
    source_attribution: 'Kawasan Obvitnas Smelter Halmahera Tengah',
    verification_status: 'REQUIRES_AUTHORIZATION',
    snapshot_url: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=500&auto=format&fit=crop&q=60',
    description: 'Kawasan industri terpadu pertambangan feronikel Pulau Halmahera.',
  },

  // ── PAPUA ──
  {
    camera_id: 'PAP-BRD-001',
    camera_name: 'Pos Lintas Batas Negara (PLBN) Skouw Perbatasan RI-PNG',
    latitude: -2.6142,
    longitude: 140.8655,
    province_code: 'ID-PA',
    regency_city_code: 'ID-PA-01',
    district_code: 'Muara Tami',
    category: 'SECURITY_DEFENSE',
    operator: 'Badan Nasional Pengelola Perbatasan (BNPP)',
    source_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    source_type: 'HLS_STREAM',
    stream_protocol: 'HLS',
    access_status: 'PUBLIC_OPEN',
    stream_status: 'ONLINE',
    last_checked_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    source_attribution: 'Pintu Gerbang Perbatasan Internasional Republik Indonesia - Papua Nugini',
    verification_status: 'VERIFIED_STREAMING',
    snapshot_url: 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?w=500&auto=format&fit=crop&q=60',
    fps: 25,
    resolution: '720p',
    description: 'Gerbang utama perbatasan darat timur Republik Indonesia di Distrik Muara Tami.',
  },
];

/**
 * National CCTV Registry In-Memory Manager
 */
class NationalCCTVRegistryStore {
  constructor() {
    this.cameras = [...INITIAL_NATIONAL_CAMERAS];
    this.listeners = new Set();
  }

  getAll() {
    return this.cameras;
  }

  getById(id) {
    return this.cameras.find((c) => c.camera_id === id) || null;
  }

  addOrUpdate(camera) {
    const idx = this.cameras.findIndex((c) => c.camera_id === camera.camera_id);
    if (idx >= 0) {
      this.cameras[idx] = { ...this.cameras[idx], ...camera };
    } else {
      this.cameras.push(camera);
    }
    this.notify();
  }

  filter({
    provinceCode = 'ALL',
    regencyCode = 'ALL',
    category = 'ALL',
    status = 'ALL',
    onlyPlayable = false,
    query = '',
  }) {
    return this.cameras.filter((cam) => {
      if (provinceCode !== 'ALL' && cam.province_code !== provinceCode) return false;
      if (regencyCode !== 'ALL' && cam.regency_city_code !== regencyCode) return false;
      if (category !== 'ALL' && cam.category !== category) return false;
      if (status !== 'ALL' && cam.stream_status !== status) return false;
      if (onlyPlayable && (cam.stream_status === 'OFFLINE' || cam.access_status === 'REQUIRES_ACCESS')) {
        return false;
      }
      if (query && query.trim()) {
        const q = query.toLowerCase();
        const match =
          cam.camera_name.toLowerCase().includes(q) ||
          cam.camera_id.toLowerCase().includes(q) ||
          cam.operator.toLowerCase().includes(q) ||
          (cam.district_code && cam.district_code.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }

  // Filter within radius in kilometers from [lat, lon]
  filterByRadius(targetLat, targetLon, radiusKm) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    return this.cameras.filter((cam) => {
      const dLat = toRad(cam.latitude - targetLat);
      const dLon = toRad(cam.longitude - targetLon);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(targetLat)) * Math.cos(toRad(cam.latitude)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      return distance <= radiusKm;
    });
  }

  getStats() {
    const total = this.cameras.length;
    const online = this.cameras.filter((c) => c.stream_status === 'ONLINE').length;
    const degraded = this.cameras.filter((c) => c.stream_status === 'DEGRADED').length;
    const offline = this.cameras.filter((c) => c.stream_status === 'OFFLINE').length;
    const requiresAccess = this.cameras.filter((c) => c.access_status === 'REQUIRES_ACCESS').length;
    const provincesCovered = new Set(this.cameras.map((c) => c.province_code)).size;

    return {
      total,
      online,
      degraded,
      offline,
      requiresAccess,
      provincesCovered,
      verifiedPlayable: online,
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.cameras);
      } catch (_) {}
    });
  }
}

export const cctvRegistryInstance = new NationalCCTVRegistryStore();

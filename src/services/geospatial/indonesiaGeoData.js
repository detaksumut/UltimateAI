/**
 * indonesiaGeoData.js
 * JINI — PalantirIndonesia Intelligence
 * Comprehensive Territorial Geospatial & Strategic Intelligence Dataset
 */

export const INDONESIA_BOUNDS = [
  [95.0, -11.0], // Southwest [lon, lat]
  [141.0, 6.0]   // Northeast [lon, lat]
];

export const INDONESIA_CENTER = [118.0149, -2.5489];
export const DEFAULT_ZOOM = 4.8;

export const REGIONS = [
  { id: 'ALL', label: 'SEMUA', center: [118.0149, -2.5489], zoom: 4.8 },
  { id: 'SUMATERA', label: 'SUMATRA', center: [101.5, 0.5], zoom: 6.0 },
  { id: 'JAWA', label: 'JAWA', center: [110.0, -7.3], zoom: 6.8 },
  { id: 'KALIMANTAN', label: 'KALIMANTAN', center: [114.0, -0.5], zoom: 6.0 },
  { id: 'SULAWESI', label: 'SULAWESI', center: [121.5, -2.0], zoom: 6.2 },
  { id: 'BALI_NUSRA', label: 'BALI-NUSRA', center: [119.5, -8.6], zoom: 6.8 },
  { id: 'MALUKU_PAPUA', label: 'MALUKU-PAPUA', center: [134.0, -3.5], zoom: 5.6 },
];

export const MAP_STYLES = {
  DARK_INTELLIGENCE: {
    id: 'DARK_INTELLIGENCE',
    name: 'DARK TACTICAL (ESRI)',
    version: 8,
    sources: {
      'esri-dark': {
        type: 'raster',
        tiles: [
          'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '© Esri, HERE, Garmin, © OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'esri-dark-bg',
        type: 'raster',
        source: 'esri-dark',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
  SATELLITE: {
    id: 'SATELLITE',
    name: 'SATELLITE ORBITAL',
    version: 8,
    sources: {
      'esri-sat': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: '© Esri, Earthstar Geographics'
      }
    },
    layers: [
      {
        id: 'esri-sat-bg',
        type: 'raster',
        source: 'esri-sat',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  }
};

export const PROVINCES_DATA = {
  'DKI JAKARTA': {
    code: 'ID-JK',
    name: 'DKI Jakarta',
    aliases: ['DKI JAKARTA', 'JAKARTA', 'DAERAH KHUSUS IBUKOTA JAKARTA'],
    capital: 'Jakarta Pusat',
    region: 'JAWA',
    coordinates: [106.8456, -6.2088],
    zoom: 9.5,
    population: '10.67 Juta Jiwa',
    grdp: 'Rp 3.186 Triliun',
    grdpShare: '16.6% PDB Nasional',
    growth: '+5.05%',
    hdi: '82.52 (Sangat Tinggi)',
    commodities: [
      { name: 'Jasa Keuangan & Perbankan', category: 'finance', level: 'Dominan' },
      { name: 'Pusat Logistik & Pelabuhan Tanjung Priok', category: 'logistics', level: 'Strategis Nasional' },
      { name: 'Kantor Pusat Korporasi & Fintech', category: 'technology', level: 'Nasional' }
    ],
    strategicProjects: [
      'MRT Jakarta Fase 2A & 2B',
      'LRT Jabodebek Ekspansi',
      'National Capital Integrated Coastal Development (NCICD Tanggul Laut)',
      'Sentra Data Center Nasional Tier IV'
    ],
    infrastructure: ['Pelabuhan Tanjung Priok', 'Bandara Halim Perdanakusuma', 'Simpul Tol Trans Jawa'],
    securityLevel: 'SIAGA CONDITIONAL // DEFCON 4',
    brief: 'Episentrum keuangan dan perputaran modal tertinggi di Asia Tenggara. Transformasi menuju Global Business Hub pasca transisi IKN.'
  },
  'JAWA BARAT': {
    code: 'ID-JB',
    name: 'Jawa Barat',
    aliases: ['JAWA BARAT', 'WEST JAVA'],
    capital: 'Bandung',
    region: 'JAWA',
    coordinates: [107.6098, -6.9175],
    zoom: 7.5,
    population: '49.94 Juta Jiwa',
    grdp: 'Rp 2.422 Triliun',
    grdpShare: '12.8% PDB Nasional',
    growth: '+5.15%',
    hdi: '73.74 (Tinggi)',
    commodities: [
      { name: 'Manufaktur Otomotif & Elektronik (Cikarang-Karawang)', category: 'industry', level: 'Episentrum Nasional' },
      { name: 'Industri Pertahanan (PT Pindad, PT DI)', category: 'defense', level: 'Kritis Strategis' },
      { name: 'Pertanian & Perkebunan Teh', category: 'agriculture', level: 'Tinggi' }
    ],
    strategicProjects: [
      'Kawasan Ekonomi Khusus Rebana (Patimban - Kertajati)',
      'Pelabuhan Internasional Patimban Subang',
      'Kereta Cepat Whoosh Jakarta-Bandung',
      'Tol Cisumdawu & Akses Kertajati'
    ],
    infrastructure: ['Pelabuhan Patimban', 'Bandara Internasional Kertajati', 'PLTA Cirata Floating Solar PV'],
    securityLevel: 'STABIL // VULKANIK & GEOLOGIS SESAR LEMBANG MONITORED',
    brief: 'Pusat manufaktur terbesar di Indonesia dengan koridor industri Karawang-Bekasi dan koridor masa depan Rebana Metropolitan.'
  },
  'JAWA TIMUR': {
    code: 'ID-JI',
    name: 'Jawa Timur',
    aliases: ['JAWA TIMUR', 'EAST JAVA'],
    capital: 'Surabaya',
    region: 'JAWA',
    coordinates: [112.7521, -7.2575],
    zoom: 7.5,
    population: '41.15 Juta Jiwa',
    grdp: 'Rp 2.953 Triliun',
    grdpShare: '14.5% PDB Nasional',
    growth: '+4.95%',
    hdi: '74.65 (Tinggi)',
    commodities: [
      { name: 'Hilirisasi Tembaga (Smelter Freeport Manyar)', category: 'mining', level: 'Strategis Global' },
      { name: 'Industri Maritim & Galangan Kapal (PT PAL)', category: 'defense', level: 'Kritis Pertahanan' },
      { name: 'Lumbung Pangan & Tebu Nasional', category: 'agriculture', level: 'No. 1 Nasional' }
    ],
    strategicProjects: [
      'Smelter PT Freeport Indonesia (JIIPE Gresik)',
      'Kawasan Industri Khusus JIIPE Gresik',
      'Pelabuhan Teluk Lamong & Tanjung Perak Hub Timur',
      'Tol Probowangi (Probolinggo-Banyuwangi)'
    ],
    infrastructure: ['Pelabuhan Tanjung Perak & Teluk Lamong', 'Bandara Juanda', 'Pangkalan Utama TNI AL Koarmada II'],
    securityLevel: 'STABIL // MARITIME HUB MONITORING',
    brief: 'Gerbang logistik Indonesia Timur dan pusat industri pengolahan mineral tembang-emas terbesar di Manyar Gresik.'
  },
  'JAWA TENGAH': {
    code: 'ID-JT',
    name: 'Jawa Tengah',
    aliases: ['JAWA TENGAH', 'CENTRAL JAVA'],
    capital: 'Semarang',
    region: 'JAWA',
    coordinates: [110.4203, -7.0051],
    zoom: 7.8,
    population: '37.03 Juta Jiwa',
    grdp: 'Rp 1.562 Triliun',
    grdpShare: '8.2% PDB Nasional',
    growth: '+5.08%',
    hdi: '73.39 (Tinggi)',
    commodities: [
      { name: 'Kawasan Industri Tekstil, Garmen & Alas Kaki', category: 'industry', level: 'Nasional' },
      { name: 'Industri Semen & Pengolahan Makanan', category: 'industry', level: 'Tinggi' },
      { name: 'Pertanian Beras & Bawang Merah (Brebes)', category: 'agriculture', level: 'Tinggi' }
    ],
    strategicProjects: [
      'Kawasan Industri Terpadu Batang (KIT Batang)',
      'Kawasan Industri Kendal (KIK)',
      'Tol Semarang-Demak (Tanggul Laut)',
      'PLTU Batang 2x1000 MW'
    ],
    infrastructure: ['Pelabuhan Tanjung Emas', 'Bandara Jenderal Ahmad Yani', 'Tol Trans Jawa Koridor Tengah'],
    securityLevel: 'KONDUSIF // ROB & ABRASI PANTAI UTARA WATCHED',
    brief: 'Pusat relokasi investasi manufaktur global dengan competitive labour cost dan infrastruktur terpadu KIT Batang.'
  },
  'BANTEN': {
    code: 'ID-BT',
    name: 'Banten',
    aliases: ['BANTEN', 'PROBANTEN'],
    capital: 'Serang',
    region: 'JAWA',
    coordinates: [106.1502, -6.1200],
    zoom: 8.5,
    population: '12.25 Juta Jiwa',
    grdp: 'Rp 798 Triliun',
    grdpShare: '4.2% PDB Nasional',
    growth: '+4.81%',
    hdi: '73.32 (Tinggi)',
    commodities: [
      { name: 'Petrokimia Terpadu (Chandra Asri Cilegon)', category: 'industry', level: 'Episentrum Kimia' },
      { name: 'Industri Baja Nasional (Krakatau Steel)', category: 'industry', level: 'Strategis Nasional' },
      { name: 'Gerbang Penyeberangan Selat Sunda (Merak)', category: 'logistics', level: 'Kritis Jawa-Sumatera' }
    ],
    strategicProjects: [
      'Ekspansi Petrokimia CAP2 Cilegon',
      'Pelabuhan Bojonegara & Ciwandan',
      'Tol Serang-Panimbang (Akses KEK Tanjung Lesung)',
      'Revitalisasi Kawasan Selat Sunda'
    ],
    infrastructure: ['Bandara Soekarno-Hatta (Tangerang)', 'Pelabuhan Merak & Ciwandan', 'PLTU Suralaya'],
    securityLevel: 'SIAGA SELAT SUNDA // TSUNAMI SENSOR GRID ACTIVE',
    brief: 'Kawasan industri berat, petrokimia, dan koridor logistik paling sibuk yang menghubungkan pulau Jawa dan Sumatera.'
  },
  'DAERAH ISTIMEWA YOGYAKARTA': {
    code: 'ID-YO',
    name: 'D.I. Yogyakarta',
    aliases: ['DAERAH ISTIMEWA YOGYAKARTA', 'YOGYAKARTA', 'DIY'],
    capital: 'Yogyakarta',
    region: 'JAWA',
    coordinates: [110.3695, -7.7956],
    zoom: 9.2,
    population: '3.76 Juta Jiwa',
    grdp: 'Rp 175 Triliun',
    grdpShare: '0.9% PDB Nasional',
    growth: '+5.37%',
    hdi: '81.09 (Sangat Tinggi)',
    commodities: [
      { name: 'Ekonomi Kreatif, Budaya & Pariwisata', category: 'tourism', level: 'Unggulan Nasional' },
      { name: 'Pendidikan Tinggi & R&D Talenta AI', category: 'education', level: 'Pusat Keilmuan' },
      { name: 'Kerajinan Logam & Industri Kulit', category: 'craft', level: 'Ekspor' }
    ],
    strategicProjects: [
      'Tol Solo-Yogyakarta-YIA Kulon Progo',
      'Tol Bawen-Yogyakarta',
      'Kawasan Aerotropolis Bandara YIA',
      'Pengembangan Riset Nuklir BATAN/BRIN Babarsari'
    ],
    infrastructure: ['Bandara Internasional Yogyakarta (YIA)', 'Stasiun Tugu Yogyakarta'],
    securityLevel: 'STABIL // GUNUNG MERAPI VULKANIK MONITORING LEVEL II',
    brief: 'Pusat riset, budaya, pariwisata berdaya saing global, serta lumbung talenta digital dan kecerdasan artifisial.'
  },
  'KALIMANTAN TIMUR': {
    code: 'ID-KI',
    name: 'Kalimantan Timur',
    aliases: ['KALIMANTAN TIMUR', 'EAST KALIMANTAN'],
    capital: 'Samarinda (Wilayah IKN Nusantara)',
    region: 'KALIMANTAN',
    coordinates: [116.7118, -0.9744],
    zoom: 7.2,
    population: '3.98 Juta Jiwa',
    grdp: 'Rp 921 Triliun',
    grdpShare: '4.8% PDB Nasional',
    growth: '+6.22%',
    hdi: '78.20 (Tinggi)',
    commodities: [
      { name: 'Batu Bara Thermal & Kokas', category: 'mining', level: 'Produsen Terbesar RI' },
      { name: 'Gas Alam Cair (LNG Bontang) & Pupuk', category: 'energy', level: 'Ekspor Utama' },
      { name: 'Kelapa Sawit & CPO', category: 'agriculture', level: 'Besar' }
    ],
    strategicProjects: [
      'IKN Nusantara (Ibu Kota Nusantara) — KIPP',
      'Tol IKN - Balikpapan Segmen 3A/3B/5A',
      'Kilang Minyak Pertamina RDMP Balikpapan',
      'Pelabuhan Kariangau & Bandara VVIP IKN'
    ],
    infrastructure: ['Kilang RDMP Balikpapan', 'Bandara SAMS Sepinggan', 'Pelabuhan Semayang & Kariangau'],
    securityLevel: 'VVIP SECURITY ZONE // NATIONAL CAPITAL DEFENSE TIER 1',
    brief: 'Pusat gravitasi politik-strategis baru Indonesia. Lokasi IKN Nusantara dan lumbung energi batu bara serta gas alam cair.'
  },
  'KALIMANTAN SELATAN': {
    code: 'ID-KS',
    name: 'Kalimantan Selatan',
    aliases: ['KALIMANTAN SELATAN', 'SOUTH KALIMANTAN'],
    capital: 'Banjarbaru',
    region: 'KALIMANTAN',
    coordinates: [114.5901, -3.3194],
    zoom: 7.8,
    population: '4.18 Juta Jiwa',
    grdp: 'Rp 271 Triliun',
    grdpShare: '1.4% PDB Nasional',
    growth: '+5.11%',
    hdi: '74.66 (Tinggi)',
    commodities: [
      { name: 'Batu Bara & Briket', category: 'mining', level: 'Tinggi' },
      { name: 'Minyak Sawit Mentah & Karet', category: 'agriculture', level: 'Tinggi' },
      { name: 'Biji Besi & Pasir Besi', category: 'mining', level: 'Sedang' }
    ],
    strategicProjects: [
      'Kawasan Industri Batulicin',
      'Kawasan Industri Jorong',
      'Bendungan Riam Kiwa',
      'Penyangga Pangan & Logistik IKN Nusantara'
    ],
    infrastructure: ['Bandara Syamsudin Noor', 'Pelabuhan Trisakti Banjarmasin'],
    securityLevel: 'KONDUSIF // IKN SUPPLY CORRIDOR ACTIVE',
    brief: 'Gerbang logistik selatan pulau Kalimantan dan mitra penyangga rantai pasok material vital pembangunan IKN.'
  },
  'KALIMANTAN TENGAH': {
    code: 'ID-KT',
    name: 'Kalimantan Tengah',
    aliases: ['KALIMANTAN TENGAH', 'CENTRAL KALIMANTAN'],
    capital: 'Palangka Raya',
    region: 'KALIMANTAN',
    coordinates: [113.9213, -1.8841],
    zoom: 7.2,
    population: '2.74 Juta Jiwa',
    grdp: 'Rp 198 Triliun',
    grdpShare: '1.0% PDB Nasional',
    growth: '+5.45%',
    hdi: '73.73 (Tinggi)',
    commodities: [
      { name: 'Perkebunan Kelapa Sawit Skala Luas', category: 'agriculture', level: 'Sangat Besar' },
      { name: 'Food Estate Padi & Singkong (Kapuas & Pulang Pisau)', category: 'agriculture', level: 'Strategis Pangan' },
      { name: 'Batu Bara & Zirkon', category: 'mining', level: 'Menengah' }
    ],
    strategicProjects: [
      'Food Estate Kalimantan Tengah',
      'Pelabuhan Bagendang Sampit',
      'Rehabilitasi Lahan Gambut Kritis',
      'Trans Kalimantan Lintas Selatan'
    ],
    infrastructure: ['Bandara Tjilik Riwut', 'Pelabuhan Kumai & Sampit'],
    securityLevel: 'MONITORING KARHUTLA MUSIM KERING // SENSOR SATELIT AKTIF',
    brief: 'Bentang alam gambut terluas dan kawasan proyek Food Estate ketahanan pangan nasional.'
  },
  'KALIMANTAN BARAT': {
    code: 'ID-KB',
    name: 'Kalimantan Barat',
    aliases: ['KALIMANTAN BARAT', 'WEST KALIMANTAN'],
    capital: 'Pontianak',
    region: 'KALIMANTAN',
    coordinates: [109.3425, -0.0263],
    zoom: 7.2,
    population: '5.54 Juta Jiwa',
    grdp: 'Rp 264 Triliun',
    grdpShare: '1.4% PDB Nasional',
    growth: '+4.88%',
    hdi: '70.47 (Sedang)',
    commodities: [
      { name: 'Bauksit & Alumina (Smelter Grade Alumina Mempawah)', category: 'mining', level: 'Episentrum Bauksit' },
      { name: 'Minyak Kelapa Sawit (CPO)', category: 'agriculture', level: 'Besar' },
      { name: 'Karet Alam & Kayu Olahan', category: 'forestry', level: 'Sedang' }
    ],
    strategicProjects: [
      'Smelter Grade Alumina Refinery (SGAR) Mempawah',
      'Pelabuhan Internasional Kijing Mempawah',
      'Pos Lintas Batas Negara (PLBN) Entikong, Aruk, Badau',
      'Trans Kalimantan Poros Perbatasan'
    ],
    infrastructure: ['Pelabuhan Internasional Kijing', 'Bandara Supadio', 'PLBN Terpadu Entikong'],
    securityLevel: 'PERBATASAN DARAT INTERNASIONAL // RADAR & POS PAMTAS',
    brief: 'Pusat hilirisasi bauksit menjadi alumina terbesar di Indonesia dan berbatasan darat langsung dengan Sarawak Malaysia.'
  },
  'KALIMANTAN UTARA': {
    code: 'ID-KU',
    name: 'Kalimantan Utara',
    aliases: ['KALIMANTAN UTARA', 'NORTH KALIMANTAN'],
    capital: 'Tanjung Selor',
    region: 'KALIMANTAN',
    coordinates: [116.8390, 3.0731],
    zoom: 7.5,
    population: '748 Ribu Jiwa',
    grdp: 'Rp 142 Triliun',
    grdpShare: '0.7% PDB Nasional',
    growth: '+5.02%',
    hdi: '72.88 (Tinggi)',
    commodities: [
      { name: 'Kawasan Industri Hijau & Petrokimia Tanah Kuning', category: 'energy', level: 'Mega Proyek Dunia' },
      { name: 'Pembangkit Listrik Tenaga Air (PLTA Kayan 9.000 MW)', category: 'energy', level: 'Potensi Terbesar RI' },
      { name: 'Perikanan Tangkap & Tambak Udang Windu', category: 'marine', level: 'Ekspor' }
    ],
    strategicProjects: [
      'Kawasan Industri Hijau Indonesia (KIHI) Tanah Kuning - Mangkupadi',
      'PLTA Sungai Kayan & Sungai Mentarang',
      'PLBN Sebatik & Long Midang',
      'Pelabuhan Malundung Tarakan'
    ],
    infrastructure: ['Bandara Juwata Tarakan', 'Pelabuhan Bebatu & Malundung'],
    securityLevel: 'FRONTIER MARITIM // AMBALAT & LAUT SULAWESI PATROL',
    brief: 'Provinsi termuda di Kalimantan dengan proyek Mega Kawasan Industri Hijau dan PLTA Kayan untuk transisi energi hijau Asia.'
  },
  'SULAWESI TENGAH': {
    code: 'ID-ST',
    name: 'Sulawesi Tengah',
    aliases: ['SULAWESI TENGAH', 'CENTRAL SULAWESI'],
    capital: 'Palu',
    region: 'SULAWESI',
    coordinates: [122.1587, -2.8256],
    zoom: 7.0,
    population: '3.12 Juta Jiwa',
    grdp: 'Rp 347 Triliun',
    grdpShare: '1.8% PDB Nasional',
    growth: '+11.91%',
    hdi: '71.01 (Tinggi)',
    commodities: [
      { name: 'Nikel & Baterai EV (Kawasan IMIP Morowali)', category: 'mining', level: 'No. 1 Nikel Dunia' },
      { name: 'Stainless Steel & Feronikel', category: 'industry', level: 'Ekspor Raksasa' },
      { name: 'Gas Alam Cair (Donggi Senoro LNG Banggai)', category: 'energy', level: 'Strategis Global' }
    ],
    strategicProjects: [
      'Indonesia Morowali Industrial Park (IMIP)',
      'Kawasan Industri Terpadu Bahodopi',
      'Donggi-Senoro LNG (DSLNG)',
      'Rehabilitasi Pasca Gempa Sesar Palu-Koro'
    ],
    infrastructure: ['Bandara Morowali', 'Pelabuhan Khusus IMIP', 'Bandara Mutiara SIS Al-Jufri Palu'],
    securityLevel: 'OBYEK VITAL NASIONAL // PENGAMANAN KHUSUS KAWASAN INDUSTRI',
    brief: 'Pusat hilirisasi nikel dan rantai pasok baterai kendaraan listrik global terbesar dunia dengan pertumbuhan PDRB di atas 11%.'
  },
  'SULAWESI TENGGARA': {
    code: 'ID-SG',
    name: 'Sulawesi Tenggara',
    aliases: ['SULAWESI TENGGARA', 'SOUTHEAST SULAWESI'],
    capital: 'Kendari',
    region: 'SULAWESI',
    coordinates: [122.5126, -3.9985],
    zoom: 7.5,
    population: '2.76 Juta Jiwa',
    grdp: 'Rp 176 Triliun',
    grdpShare: '0.9% PDB Nasional',
    growth: '+6.18%',
    hdi: '72.23 (Tinggi)',
    commodities: [
      { name: 'Bijih Nikel & Smelter Rotary Kiln (Konawe & Kolaka)', category: 'mining', level: 'Sangat Tinggi' },
      { name: 'Aspal Alam Buton (Pulau Buton)', category: 'mining', level: 'Unik Dunia' },
      { name: 'Perikanan Tuna & Rumput Laut', category: 'marine', level: 'Ekspor' }
    ],
    strategicProjects: [
      'Kawasan Industri Konawe (VDNI & OSS)',
      'Smelter Nikel Kolaka Pomalaa (PT Vale Indonesia)',
      'Optimalisasi Aspal Buton untuk Jalan Nasional',
      'Jembatan Teluk Kendari & Pelabuhan Bungkutoko'
    ],
    infrastructure: ['Pelabuhan Bungkutoko', 'Bandara Haluoleo Kendari'],
    securityLevel: 'VITAL RESOURCES // MARITIME EXCLUSION CORRIDOR',
    brief: 'Sentra pertambangan nikel Konawe-Kolaka dan satu-satunya penghasil aspal alam terbesar di dunia di Pulau Buton.'
  },
  'SULAWESI SELATAN': {
    code: 'ID-SN',
    name: 'Sulawesi Selatan',
    aliases: ['SULAWESI SELATAN', 'SOUTH SULAWESI'],
    capital: 'Makassar',
    region: 'SULAWESI',
    coordinates: [119.4327, -5.1477],
    zoom: 7.2,
    population: '9.31 Juta Jiwa',
    grdp: 'Rp 642 Triliun',
    grdpShare: '3.3% PDB Nasional',
    growth: '+5.08%',
    hdi: '73.44 (Tinggi)',
    commodities: [
      { name: 'Lumbung Padi & Jagung Indonesia Timur', category: 'agriculture', level: 'Pilar Ketahanan Pangan' },
      { name: 'Nikel Soroako (PT Vale Indonesia Luwu Timur)', category: 'mining', level: 'Strategis' },
      { name: 'Kopi Toraja & Kakao', category: 'agriculture', level: 'Premium Ekspor' }
    ],
    strategicProjects: [
      'Makassar New Port (MNP Hub Terbesar Timur)',
      'Kereta Api Makassar - Parepare Trans Sulawesi',
      'Kawasan Industri Bantaeng (KIBA)',
      'Bendungan Jenelata & Paselloreng'
    ],
    infrastructure: ['Makassar New Port', 'Bandara Internasional Sultan Hasanuddin', 'Pangkalan Udara Koopsau II'],
    securityLevel: 'HUB LOGISTIK & KOMANDO MILITER WILAYAH TIMUR',
    brief: 'Jangkar utama ekonomi dan logistik pulau Sulawesi dan seluruh Kawasan Timur Indonesia.'
  },
  'SULAWESI UTARA': {
    code: 'ID-SA',
    name: 'Sulawesi Utara',
    aliases: ['SULAWESI UTARA', 'NORTH SULAWESI'],
    capital: 'Manado',
    region: 'SULAWESI',
    coordinates: [124.8488, 1.4748],
    zoom: 7.8,
    population: '2.68 Juta Jiwa',
    grdp: 'Rp 171 Triliun',
    grdpShare: '0.9% PDB Nasional',
    growth: '+5.48%',
    hdi: '74.36 (Tinggi)',
    commodities: [
      { name: 'Pariwisata Bahari Kelas Dunia (Taman Laut Bunaken & Likupang)', category: 'tourism', level: 'DPSP Prioritas' },
      { name: 'Kelapa Terpadu, Kopra & Minyak Kelapa', category: 'agriculture', level: 'Eksportir Utama' },
      { name: 'Perikanan Tangkap Samudera Pasifik (Bitung)', category: 'marine', level: 'Hub Perikanan' }
    ],
    strategicProjects: [
      'Destinasi Pariwisata Super Prioritas (DPSP) Likupang',
      'Kawasan Ekonomi Khusus (KEK) Bitung',
      'Pelabuhan Bitung Hub Pasifik Internasional',
      'Tol Manado - Bitung'
    ],
    infrastructure: ['Pelabuhan Bitung Hub Pasifik', 'Bandara Sam Ratulangi Manado'],
    securityLevel: 'FRONTIER PASIFIK // PATROLI PERBATASAN MARITIM RI-FILIPINA',
    brief: 'Gerbang laut Indonesia menghadap kawasan Asia Timur dan Samudera Pasifik, sentra industri perikanan Bitung.'
  },
  'SULAWESI BARAT': {
    code: 'ID-SR',
    name: 'Sulawesi Barat',
    aliases: ['SULAWESI BARAT', 'WEST SULAWESI'],
    capital: 'Mamuju',
    region: 'SULAWESI',
    coordinates: [118.8895, -2.6775],
    zoom: 8.0,
    population: '1.46 Juta Jiwa',
    grdp: 'Rp 58 Triliun',
    grdpShare: '0.3% PDB Nasional',
    growth: '+5.25%',
    hdi: '66.86 (Sedang)',
    commodities: [
      { name: 'Kelapa Sawit & CPO', category: 'agriculture', level: 'Besar' },
      { name: 'Kakao (Cokelat) Rakyat', category: 'agriculture', level: 'Tinggi' },
      { name: 'Potensi Uranium & Bahan Galian Radioaktif', category: 'mining', level: 'Riset Khusus' }
    ],
    strategicProjects: [
      'Pelabuhan Belang-Belang Mamuju',
      'Jalur Logistik Selat Makassar ke IKN',
      'Rehabilitasi Gempa Majene-Mamuju',
      'Pengembangan Sentra Kakao Organik'
    ],
    infrastructure: ['Pelabuhan Belang-Belang', 'Bandara Tampa Padang Mamuju'],
    securityLevel: 'STABIL // JALUR LOGISTIK PENYEBERANGAN KE IKN AKTIF',
    brief: 'Penyangga logistik agrikultur dan pangan yang berhadapan langsung dengan Kalimantan Timur dan IKN melalui Selat Makassar.'
  },
  'GORONTALO': {
    code: 'ID-GO',
    name: 'Gorontalo',
    aliases: ['GORONTALO'],
    capital: 'Gorontalo',
    region: 'SULAWESI',
    coordinates: [123.0595, 0.5435],
    zoom: 8.5,
    population: '1.22 Juta Jiwa',
    grdp: 'Rp 50 Triliun',
    grdpShare: '0.25% PDB Nasional',
    growth: '+4.55%',
    hdi: '70.36 (Tinggi)',
    commodities: [
      { name: 'Komoditas Jagung Hibrida Nasional', category: 'agriculture', level: 'Lumbung Jagung' },
      { name: 'Perikanan Tangkap Teluk Tomini', category: 'marine', level: 'Kaya Hayati' },
      { name: 'Pertambangan Emas Rakyat & Industri', category: 'mining', level: 'Sedang' }
    ],
    strategicProjects: [
      'Kawasan Agropolitan Jagung Gorontalo',
      'Pelabuhan Anggrek Gorontalo Utara (KPBU)',
      'Bendungan Bulango Ulu',
      'Kawasan Konservasi Hiu Paus Botubarani'
    ],
    infrastructure: ['Pelabuhan Anggrek', 'Bandara Djalaluddin Gorontalo'],
    securityLevel: 'KONDUSIF // PENGEMBANGAN LOGISTIK TELUK TOMINI',
    brief: 'Lumbung jagung nasional di pesisir Teluk Tomini dengan pengembangan pelabuhan modern KPBU Anggrek.'
  },
  'BALI': {
    code: 'ID-BA',
    name: 'Bali',
    aliases: ['BALI'],
    capital: 'Denpasar',
    region: 'BALI_NUSRA',
    coordinates: [115.1889, -8.4095],
    zoom: 9.0,
    population: '4.43 Juta Jiwa',
    grdp: 'Rp 274 Triliun',
    grdpShare: '1.4% PDB Nasional',
    growth: '+5.71%',
    hdi: '76.44 (Tinggi)',
    commodities: [
      { name: 'Pariwisata & Hospitalitas Internasional', category: 'tourism', level: 'Etalase Global RI' },
      { name: 'Kawasan Ekonomi Khusus Kesehatan Sanur', category: 'healthcare', level: 'Internasional' },
      { name: 'Kerajinan Seni, Tekstil Tenun & Budaya', category: 'craft', level: 'Ekspor Dunia' }
    ],
    strategicProjects: [
      'KEK Kesehatan Internasional Sanur',
      'MRT / LRT Jalur Bandara Ngurah Rai - Seminyak',
      'Bendungan Sidan & Tamblang',
      'Transisi Energi Bersih Bali Net Zero Emission 2045'
    ],
    infrastructure: ['Bandara Internasional I Gusti Ngurah Rai', 'Pelabuhan Benoa Marina'],
    securityLevel: 'HIGH TOURISM & DIPLOMATIC PROTOCOL // PROTOKOL VVIP G20 READY',
    brief: 'Etalase pariwisata internasional Indonesia dan pusat konferensi diplomatik global.'
  },
  'NUSA TENGGARA BARAT': {
    code: 'ID-NB',
    name: 'Nusa Tenggara Barat',
    aliases: ['NUSATENGGARA BARAT', 'NUSA TENGGARA BARAT', 'NTB'],
    capital: 'Mataram',
    region: 'BALI_NUSRA',
    coordinates: [116.8390, -8.6529],
    zoom: 7.8,
    population: '5.56 Juta Jiwa',
    grdp: 'Rp 164 Triliun',
    grdpShare: '0.8% PDB Nasional',
    growth: '+7.10%',
    hdi: '70.20 (Tinggi)',
    commodities: [
      { name: 'Tembaga & Emas (PT Amman Mineral Nusa Tenggara - Batu Hijau)', category: 'mining', level: 'Smelter Kelas Dunia' },
      { name: 'Sport Tourism & Sirkuit Internasional Pertamina Mandalika', category: 'tourism', level: 'Event Dunia MotoGP' },
      { name: 'Padi, Jagung & Rumput Laut', category: 'agriculture', level: 'Tinggi' }
    ],
    strategicProjects: [
      'Smelter Tembaga PT Amman Mineral (Benete Sumbawa)',
      'KEK Mandalika & Sirkuit MotoGP',
      'Bendungan Meninting & Beringin Sila',
      'Industrialisasi Garam Bima'
    ],
    infrastructure: ['Bandara Internasional Zainuddin Abdul Madjid (BIA)', 'Pelabuhan Lembar & Benete'],
    securityLevel: 'STABIL // PENGAMANAN EVENT GLOBAL & VITAL SMELTER',
    brief: 'Sentra hilirisasi tembaga Sumbawa Barat (Amman Mineral) dan episentrum sport tourism internasional sirkuit Mandalika.'
  },
  'NUSA TENGGARA TIMUR': {
    code: 'ID-NT',
    name: 'Nusa Tenggara Timur',
    aliases: ['NUSA TENGGARA TIMUR', 'NTT'],
    capital: 'Kupang',
    region: 'BALI_NUSRA',
    coordinates: [123.6070, -10.1772],
    zoom: 7.0,
    population: '5.59 Juta Jiwa',
    grdp: 'Rp 128 Triliun',
    grdpShare: '0.6% PDB Nasional',
    growth: '+4.02%',
    hdi: '66.38 (Sedang)',
    commodities: [
      { name: 'Pariwisata Premium Labuan Bajo & Komodo Dragon', category: 'tourism', level: 'DPSP Dunia' },
      { name: 'Energi Panas Bumi (Geothermal Flores Pulau Panas Bumi)', category: 'energy', level: 'Tinggi' },
      { name: 'Peternakan Sapi Potong & Tenun Ikat NTT', category: 'agriculture', level: 'Khas Budaya' }
    ],
    strategicProjects: [
      'DPSP Labuan Bajo Terpadu (KTT ASEAN Venue)',
      'Pengembangan Flores Geothermal Island',
      'PLBN Motaain, Motamasin & Wini (Perbatasan Timor Leste)',
      'Bendungan Temef & Manikin'
    ],
    infrastructure: ['Bandara Komodo Labuan Bajo', 'Bandara El Tari Kupang', 'Pelabuhan Tenau Kupang'],
    securityLevel: 'BORDER CORRIDOR RI-TIMOR LESTE // POS PENJAGAAN TERPADU',
    brief: 'Destinasi wisata super premium Labuan Bajo, perbatasan internasional darat dengan Timor Leste, dan laboratorium energi geothermal.'
  },
  'MALUKU UTARA': {
    code: 'ID-MU',
    name: 'Maluku Utara',
    aliases: ['MALUKU UTARA', 'NORTH MALUKU'],
    capital: 'Sofifi',
    region: 'MALUKU_PAPUA',
    coordinates: [127.9133, 0.4789],
    zoom: 7.2,
    population: '1.34 Juta Jiwa',
    grdp: 'Rp 86 Triliun',
    grdpShare: '0.45% PDB Nasional',
    growth: '+20.5%',
    hdi: '70.98 (Tinggi)',
    commodities: [
      { name: 'Nikel Terpadu IWIP (Weda Bay Industrial Park Halmahera)', category: 'mining', level: 'Mega Kompleks Nikel' },
      { name: 'Rempah Cengkeh & Pala Bersejarah', category: 'agriculture', level: 'Kualitas Dunia' },
      { name: 'Perikanan Laut Dalam Halmahera', category: 'marine', level: 'Tinggi' }
    ],
    strategicProjects: [
      'Indonesia Weda Bay Industrial Park (IWIP)',
      'Kawasan Industri Pulau Obi (Harita Nickel)',
      'Smelter HPAL Baterai EV Halmahera',
      'Jalan Lingkar Pulau Halmahera'
    ],
    infrastructure: ['Pelabuhan Weda Bay', 'Bandara Babullah Ternate', 'Bandara Weda Bay'],
    securityLevel: 'VITAL SMELTER ZONE // PERTUMBUHAN EKONOMI TERTINGGI NASIONAL (>20%)',
    brief: 'Wilayah dengan laju pertumbuhan PDRB tertinggi di Indonesia berkat mega investasi hilirisasi nikel baterai di Weda Bay dan Pulau Obi.'
  },
  'MALUKU': {
    code: 'ID-MA',
    name: 'Maluku',
    aliases: ['MALUKU'],
    capital: 'Ambon',
    region: 'MALUKU_PAPUA',
    coordinates: [128.1814, -3.6958],
    zoom: 6.8,
    population: '1.92 Juta Jiwa',
    grdp: 'Rp 61 Triliun',
    grdpShare: '0.3% PDB Nasional',
    growth: '+5.32%',
    hdi: '71.55 (Tinggi)',
    commodities: [
      { name: 'Lumbung Ikan Nasional (LIN) Laut Banda & Arafura', category: 'marine', level: 'No. 1 Potensi Ikan RI' },
      { name: 'Gas Alam Abadi Blok Masela (Kepulauan Tanimbar)', category: 'energy', level: 'Cadangan Gas Raksasa' },
      { name: 'Rempah Kepulauan Banda (Pala & Fuli)', category: 'agriculture', level: 'Warisan Dunia' }
    ],
    strategicProjects: [
      'Proyek Gas Alam Abadi Blok Masela (Inpex & Pertamina)',
      'Ambon New Port & Lumbung Ikan Nasional',
      'Kawasan Terintegrasi Pulau Tanimbar',
      'Konektivitas Tol Laut Gugus Pulau Maluku'
    ],
    infrastructure: ['Pelabuhan Yos Sudarso Ambon', 'Bandara Pattimura Ambon'],
    securityLevel: 'ALKI III STRATEGIC STRAITS // PENGAMANAN MARITIM LAUT BANDA',
    brief: 'Pusat cadangan gas alam raksasa laut dalam Blok Masela dan wilayah tangkapan tuna terbesar di Wilayah Pengelolaan Perikanan WPP 718.'
  },
  'PAPUA': {
    code: 'ID-PA',
    name: 'Papua',
    aliases: ['PAPUA', 'IRIAN JAYA TIMUR', 'IRIAN JAYA TENGAH'],
    capital: 'Jayapura',
    region: 'MALUKU_PAPUA',
    coordinates: [140.7181, -2.5337],
    zoom: 6.2,
    population: '1.05 Juta Jiwa',
    grdp: 'Rp 96 Triliun',
    grdpShare: '0.5% PDB Nasional',
    growth: '+6.15%',
    hdi: '72.82 (Tinggi)',
    commodities: [
      { name: 'Pertanian Sagu & Pangan Lokal', category: 'agriculture', level: 'Besar' },
      { name: 'Perikanan Samudera Pasifik Utara', category: 'marine', level: 'Tinggi' },
      { name: 'Perdagangan Lintas Batas PNG (Skouw)', category: 'trade', level: 'Internasional' }
    ],
    strategicProjects: [
      'PLBN Terpadu Skouw (Perbatasan Papua Nugini)',
      'Jembatan Youtefa Teluk Youtefa',
      'Trans Papua Koridor Jayapura-Wamena',
      'Stadion Lukas Enembe & Sentra Olahraga Pasifik'
    ],
    infrastructure: ['Pelabuhan Jayapura', 'Bandara Internasional Sentani', 'PLBN Skouw'],
    securityLevel: 'PERBATASAN INTERNASIONAL RI-PNG // SATGAS PENGAMANAN',
    brief: 'Gerbang timur kedaulatan NKRI yang berbatasan langsung dengan negara Papua Nugini dan menghadap langsung Samudera Pasifik.'
  },
  'PAPUA BARAT': {
    code: 'ID-PB',
    name: 'Papua Barat',
    aliases: ['PAPUA BARAT', 'WEST PAPUA', 'IRIAN JAYA BARAT'],
    capital: 'Manokwari',
    region: 'MALUKU_PAPUA',
    coordinates: [134.0620, -0.8615],
    zoom: 6.5,
    population: '575 Ribu Jiwa',
    grdp: 'Rp 98 Triliun',
    grdpShare: '0.5% PDB Nasional',
    growth: '+4.90%',
    hdi: '66.80 (Sedang)',
    commodities: [
      { name: 'Gas Alam Cair LNG Tangguh (Teluk Bintuni Train 3)', category: 'energy', level: 'Kilang Gas Terbesar RI' },
      { name: 'Petrokimia Pupuk Kasuri Bintuni', category: 'industry', level: 'Strategis' },
      { name: 'Kakao Ransiki & Kelapa Sawit', category: 'agriculture', level: 'Sedang' }
    ],
    strategicProjects: [
      'Kilang LNG Tangguh Train 3 Teluk Bintuni (BP Berau)',
      'Kawasan Industri Pupuk Fakfak',
      'Pelabuhan Bintuni & Manokwari',
      'Trans Papua Segmen Barat'
    ],
    infrastructure: ['Bandara Rendani Manokwari', 'Pelabuhan Manokwari', 'Kilang LNG Tangguh'],
    securityLevel: 'VITAL ENERGY ASSET // OBVITNAS LNG TANGGUH WATCHED',
    brief: 'Pusat produksi LNG Tangguh Teluk Bintuni yang menyumbang sepertiga pasokan gas alam cair nasional.'
  },
  'SUMATERA UTARA': {
    code: 'ID-SU',
    name: 'Sumatera Utara',
    aliases: ['SUMATERA UTARA', 'NORTH SUMATRA'],
    capital: 'Medan',
    region: 'SUMATERA',
    coordinates: [98.6722, 3.5952],
    zoom: 7.2,
    population: '15.38 Juta Jiwa',
    grdp: 'Rp 1.051 Triliun',
    grdpShare: '5.2% PDB Nasional',
    growth: '+5.01%',
    hdi: '73.80 (Tinggi)',
    commodities: [
      { name: 'Minyak Sawit (CPO) & Karet Terbesar Bagian Barat', category: 'agriculture', level: 'Raksasa Sawit' },
      { name: 'Pariwisata DPSP Danau Toba', category: 'tourism', level: 'Super Prioritas Dunia' },
      { name: 'Aluminium Inalum (Kuala Tanjung)', category: 'industry', level: 'Strategis Nasional' }
    ],
    strategicProjects: [
      'Pelabuhan Hub Internasional Kuala Tanjung',
      'Kawasan Ekonomi Khusus Sei Mangkei',
      'Tol Trans Sumatera (Ruas Medan-Kualanamu-Tebing Tinggi-Parapat)',
      'DPSP Danau Toba & F1 Powerboat Venue'
    ],
    infrastructure: ['Pelabuhan Belawan & Kuala Tanjung', 'Bandara Internasional Kualanamu', 'Peleburan Aluminium Inalum'],
    securityLevel: 'STABIL // STRAIT OF MALACCA MONITORED',
    brief: 'Lokomotif ekonomi pulau Sumatera dengan pelabuhan internasional Kuala Tanjung dan pusat perkebunan kelapa sawit terpadu.'
  },
  'RIAU': {
    code: 'ID-RI',
    name: 'Riau',
    aliases: ['RIAU'],
    capital: 'Pekanbaru',
    region: 'SUMATERA',
    coordinates: [101.4478, 0.5071],
    zoom: 7.2,
    population: '6.73 Juta Jiwa',
    grdp: 'Rp 1.026 Triliun',
    grdpShare: '5.1% PDB Nasional',
    growth: '+4.22%',
    hdi: '74.95 (Tinggi)',
    commodities: [
      { name: 'Perkebunan Kelapa Sawit Terluas di Indonesia (>3 Juta Ha)', category: 'agriculture', level: 'No. 1 Sawit RI' },
      { name: 'Minyak Bumi Blok Rokan (Pertamina Hulu Rokan)', category: 'energy', level: 'Produsen Minyak Terbesar RI' },
      { name: 'Pulp & Kertas (RAPP & Indah Kiat)', category: 'industry', level: 'Eksportir Dunia' }
    ],
    strategicProjects: [
      'Optimalisasi Blok Rokan (Enhanced Oil Recovery)',
      'Tol Pekanbaru - Dumai & Pekanbaru - Bangkinang - Padang',
      'Kawasan Industri Tenayan',
      'Jembatan Selat Malaka Rupat'
    ],
    infrastructure: ['Pelabuhan Dumai (Pintu Ekspor CPO Terbesar)', 'Bandara Sultan Syarif Kasim II'],
    securityLevel: 'VITAL PETROLEUM // BLOK ROKAN ENERGY SECURITY',
    brief: 'Lumbung minyak bumi Blok Rokan dan produsen kelapa sawit terluas di Republik Indonesia.'
  },
  'KEPULAUAN RIAU': {
    code: 'ID-KR',
    name: 'Kepulauan Riau',
    aliases: ['KEPULAUAN RIAU', 'KEPRI'],
    capital: 'Tanjung Pinang (Hub Utama: Batam)',
    region: 'SUMATERA',
    coordinates: [104.0305, 1.1301],
    zoom: 7.0,
    population: '2.15 Juta Jiwa',
    grdp: 'Rp 334 Triliun',
    grdpShare: '1.7% PDB Nasional',
    growth: '+5.20%',
    hdi: '77.11 (Tinggi)',
    commodities: [
      { name: 'Galangan Kapal, Elektronik & Data Center (Batam FTZ)', category: 'industry', level: 'Hub Manufaktur Global' },
      { name: 'Migas Laut Dalam & Pasir Kuarsa Natuna', category: 'energy', level: 'Strategis Geopolitik' },
      { name: 'Pariwisata Internasional Bintan Resort', category: 'tourism', level: 'Mancanegara' }
    ],
    strategicProjects: [
      'KPBPB (Free Trade Zone) Batam, Bintan, Karimun (BBK)',
      'Jembatan Batam - Bintan (Babin)',
      'Pangkalan Militer & Radar Pertahanan Laut Natuna',
      'KEK Nongsa Digital Park (Data Center Hub)'
    ],
    infrastructure: ['Bandara Hang Nadim Batam', 'Pelabuhan Batu Ampar', 'Pangkalan Udara & Laut Ranai Natuna'],
    securityLevel: 'HIGH ALERT GEOPOLITIK LAUT NATUNA UTARA // RADAR & PATROLI TENTARA',
    brief: 'Garda depan maritim Selat Malaka dan Laut Natuna Utara, pusat manufaktur berteknologi tinggi Batam dan hub data center regional.'
  },
  'SUMATERA SELATAN': {
    code: 'ID-SS',
    name: 'Sumatera Selatan',
    aliases: ['SUMATERA SELATAN', 'SOUTH SUMATRA'],
    capital: 'Palembang',
    region: 'SUMATERA',
    coordinates: [104.7565, -2.9761],
    zoom: 7.2,
    population: '8.86 Juta Jiwa',
    grdp: 'Rp 624 Triliun',
    grdpShare: '3.1% PDB Nasional',
    growth: '+5.08%',
    hdi: '72.42 (Tinggi)',
    commodities: [
      { name: 'Batu Bara Cadangan Terbesar Sumatera (Tanjung Enim)', category: 'mining', level: 'Pilar Listrik Jawa-Sumatera' },
      { name: 'Karet Alam & Minyak Sawit', category: 'agriculture', level: 'Sangat Tinggi' },
      { name: 'Minyak & Gas Bumi (Pertamina Plaju)', category: 'energy', level: 'Kilang Bersejarah' }
    ],
    strategicProjects: [
      'PLTU Mulut Tambang Sumsel-8 (2x660 MW)',
      'Pelabuhan Laut Tanjung Carat',
      'Tol Trans Sumatera Kayu Agung - Palembang - Betung',
      'Hilirisasi Batu Bara menjadi DME (Dimetil Eter)'
    ],
    infrastructure: ['LRT Palembang', 'Kilang Pertamina Plaju', 'Bandara Sultan Mahmud Badaruddin II'],
    securityLevel: 'STABIL // ENERGY CORRIDOR SUMATERA-JAWA',
    brief: 'Lumbung energi Sumatera dengan tambang batu bara raksasa PT Bukit Asam Tanjung Enim dan jaringan kilang Plaju.'
  },
  'LAMPUNG': {
    code: 'ID-LA',
    name: 'Lampung',
    aliases: ['LAMPUNG'],
    capital: 'Bandar Lampung',
    region: 'SUMATERA',
    coordinates: [105.2580, -5.4297],
    zoom: 7.8,
    population: '9.31 Juta Jiwa',
    grdp: 'Rp 443 Triliun',
    grdpShare: '2.2% PDB Nasional',
    growth: '+4.55%',
    hdi: '70.45 (Tinggi)',
    commodities: [
      { name: 'Kopi Robusta Lampung Terkenal', category: 'agriculture', level: 'Produsen No. 1 Robusta' },
      { name: 'Nanas Kaleng & Pisang Cavendish (Great Giant Pineapple)', category: 'agriculture', level: 'Eksportir Terbesar Dunia' },
      { name: 'Ubi Kayu (Tapioka), Sawit & Tebu', category: 'agriculture', level: 'Tinggi' }
    ],
    strategicProjects: [
      'Kawasan Terintegrasi Bakauheni Harbour City (BHC)',
      'Kawasan Industri Way Pisang',
      'Tol Trans Sumatera Bakauheni - Terbanggi Besar - Kayu Agung',
      'Bendungan Margatiga & Way Sekampung'
    ],
    infrastructure: ['Pelabuhan Bakauheni (Pintu Gerbang Jawa-Sumatera)', 'Pelabuhan Panjang', 'Bandara Radin Inten II'],
    securityLevel: 'PINTU GERBANG LOGISTIK JAWA-SUMATERA // ARUS KENDARAAN TERPADU',
    brief: 'Pintu gerbang penghubung darat Sumatera-Jawa dan sentra agroindustri nanas dan kopi robusta kelas dunia.'
  },
  'ACEH': {
    code: 'ID-AC',
    name: 'Aceh',
    aliases: ['DI. ACEH', 'ACEH', 'NANGGROE ACEH DARUSSALAM'],
    capital: 'Banda Aceh',
    region: 'SUMATERA',
    coordinates: [95.3238, 5.5483],
    zoom: 7.2,
    population: '5.51 Juta Jiwa',
    grdp: 'Rp 221 Triliun',
    grdpShare: '1.1% PDB Nasional',
    growth: '+4.23%',
    hdi: '73.20 (Tinggi)',
    commodities: [
      { name: 'Kopi Arabika Gayo Organik Premium', category: 'agriculture', level: 'Standar Dunia' },
      { name: 'Gas Alam Arun (Regasifikasi LNG & Petrokimia PIM)', category: 'energy', level: 'Kawasan Industri Lhokseumawe' },
      { name: 'Minyak Sawit & Perikanan Samudera Hindia', category: 'agriculture', level: 'Tinggi' }
    ],
    strategicProjects: [
      'Kawasan Ekonomi Khusus (KEK) Arun Lhokseumawe',
      'Pabrik Pupuk NPK PT Pupuk Iskandar Muda (PIM)',
      'Tol Trans Sumatera Sigli - Banda Aceh (Sibanceh)',
      'Bendungan Keureuto & Rukoh'
    ],
    infrastructure: ['Pelabuhan Krueng Geukueh & Sabang FTZ', 'Bandara Sultan Iskandar Muda', 'Kilang LNG Arun'],
    securityLevel: 'DAMAI & OTONOMI KHUSUS // PENGAMANAN PERIKANAN SAMUDERA HINDIA',
    brief: 'Titik nol barat Indonesia dengan komoditas Kopi Gayo kelas dunia dan KEK Arun Lhokseumawe sebagai energi hub gas LNG.'
  },
  'SUMATERA BARAT': {
    code: 'ID-SB',
    name: 'Sumatera Barat',
    aliases: ['SUMATERA BARAT', 'WEST SUMATRA'],
    capital: 'Padang',
    region: 'SUMATERA',
    coordinates: [100.3543, -0.9492],
    zoom: 7.5,
    population: '5.75 Juta Jiwa',
    grdp: 'Rp 305 Triliun',
    grdpShare: '1.5% PDB Nasional',
    growth: '+4.63%',
    hdi: '73.88 (Tinggi)',
    commodities: [
      { name: 'Industri Semen Tertua (PT Semen Padang Indarung)', category: 'industry', level: 'Pionir Semen RI' },
      { name: 'Pariwisata Budaya Minangkabau & Danau Maninjau/Singkarak', category: 'tourism', level: 'Kuliner & Budaya' },
      { name: 'Minyak Kelapa Sawit & Karet', category: 'agriculture', level: 'Tinggi' }
    ],
    strategicProjects: [
      'Tol Padang - Sicincin - Pekanbaru',
      'Revitalisasi Pelabuhan Teluk Bayur',
      'Kawasan Wisata Bahari Terpadu Mandeh',
      'Pusat Halal Tourism & Edukasi Islam Minangkabau'
    ],
    infrastructure: ['Pelabuhan Teluk Bayur', 'Bandara Internasional Minangkabau (BIM)'],
    securityLevel: 'STABIL // RAWAN GEMPA MEGATHRUST PENTAS SAMUDERA HINDIA',
    brief: 'Ikon kuliner dan budaya Minangkabau, rumah bagi Semen Padang, dan sentra wisata maritim Kawasan Mandeh.'
  },
  'JAMBI': {
    code: 'ID-JA',
    name: 'Jambi',
    aliases: ['JAMBI'],
    capital: 'Jambi',
    region: 'SUMATERA',
    coordinates: [103.6131, -1.6101],
    zoom: 7.8,
    population: '3.67 Juta Jiwa',
    grdp: 'Rp 276 Triliun',
    grdpShare: '1.4% PDB Nasional',
    growth: '+4.66%',
    hdi: '72.77 (Tinggi)',
    commodities: [
      { name: 'Kelapa Sawit & CPO', category: 'agriculture', level: 'Tinggi' },
      { name: 'Karet Alam Kualitas Tinggi', category: 'agriculture', level: 'Sentra Karet' },
      { name: 'Minyak Bumi & Batu Bara', category: 'energy', level: 'Sedang' }
    ],
    strategicProjects: [
      'Pelabuhan Samudera Ujung Jabung',
      'Tol Trans Sumatera Betung - Tempino - Jambi',
      'Pengembangan Candi Muaro Jambi (World Heritage)',
      'Kawasan Industri Kemingking'
    ],
    infrastructure: ['Bandara Sultan Thaha Jambi', 'Pelabuhan Talang Duku'],
    securityLevel: 'KONDUSIF // RESTORASI EKOSISTEM GAMBAT AKTIF',
    brief: 'Sentra perkebunan karet dan kelapa sawit yang memiliki kawasan cagar budaya percandian bata Muaro Jambi terluas di Asia Tenggara.'
  },
  'BENGKULU': {
    code: 'ID-BE',
    name: 'Bengkulu',
    aliases: ['BENGKULU'],
    capital: 'Bengkulu',
    region: 'SUMATERA',
    coordinates: [102.2655, -3.7928],
    zoom: 8.0,
    population: '2.06 Juta Jiwa',
    grdp: 'Rp 93 Triliun',
    grdpShare: '0.45% PDB Nasional',
    growth: '+4.43%',
    hdi: '72.16 (Tinggi)',
    commodities: [
      { name: 'Batu Bara Kalori Tinggi', category: 'mining', level: 'Ekspor' },
      { name: 'Kelapa Sawit & Kopi Robusta Pegunungan', category: 'agriculture', level: 'Tinggi' },
      { name: 'Perikanan Samudera Hindia (Pulau Enggano)', category: 'marine', level: 'Strategis Terluar' }
    ],
    strategicProjects: [
      'Tol Bengkulu - Taba Penanjung - Lubuk Linggau',
      'Pengembangan Pelabuhan Pulau Baai sebagai Hub Samudera Hindia',
      'Konektivitas Pulau Terluar Enggano',
      'Konservasi Bunga Langka Rafflesia Arnoldii'
    ],
    infrastructure: ['Pelabuhan Samudera Pulau Baai', 'Bandara Fatmawati Soekarno'],
    securityLevel: 'PULAU TERLUAR ENGGANO PATROL // SEISMIC MEGATHRUST WATCH',
    brief: 'Bumi Rafflesia di pesisir barat daya Sumatera dengan Pelabuhan Samudera Pulau Baai dan pulau terdepan Enggano.'
  },
  'BANGKA BELITUNG': {
    code: 'ID-BB',
    name: 'Kepulauan Bangka Belitung',
    aliases: ['BANGKA BELITUNG', 'KEPULAUAN BANGKA BELITUNG', 'BABEL'],
    capital: 'Pangkal Pinang',
    region: 'SUMATERA',
    coordinates: [106.1118, -2.1316],
    zoom: 8.0,
    population: '1.51 Juta Jiwa',
    grdp: 'Rp 102 Triliun',
    grdpShare: '0.5% PDB Nasional',
    growth: '+4.38%',
    hdi: '72.24 (Tinggi)',
    commodities: [
      { name: 'Timah Murni Batangan (PT Timah Tbk)', category: 'mining', level: 'Produsen Terbesar No. 2 Dunia' },
      { name: 'Lada Putih Muntok (Muntok White Pepper)', category: 'agriculture', level: 'Indikasi Geografis Dunia' },
      { name: 'Pariwisata Geopark Pulau Belitung', category: 'tourism', level: 'UNESCO Global Geopark' }
    ],
    strategicProjects: [
      'Hilirisasi Timah & Logam Tanah Jarang (LTJ / Rare Earth)',
      'KEK Tanjung Kelayang Belitung',
      'Pelabuhan Tanjung Gudang Belinyu',
      'Pembangkit Listrik Tenaga Thorium/Nuklir Riset'
    ],
    infrastructure: ['Bandara Depati Amir Pangkal Pinang', 'Bandara H.A.S. Hanandjoeddin Tanjung Pandan'],
    securityLevel: 'PENGAWASAN PERAIRAN TAMBANG TIMAH ILEGAL // BEACUKAI & AL PATROL',
    brief: 'Produsen timah kelas dunia dan rumah geopark granit UNESCO Belitung dengan potensi strategis mineral tanah jarang (rare earth elements).'
  }
};

export const STRATEGIC_NODES = [
  { id: 'IKN', name: 'IKN Nusantara', type: 'POLITICAL_CENTER', coords: [116.7118, -0.9744], status: 'ACTIVE_DEVELOPMENT', color: '#00e5ff' },
  { id: 'IMIP', name: 'IMIP Morowali', type: 'CRITICAL_MINING', coords: [122.1587, -2.8256], status: 'HIGH_PRODUCTION', color: '#10b981' },
  { id: 'WEDA', name: 'IWIP Weda Bay', type: 'CRITICAL_MINING', coords: [127.9133, 0.4789], status: 'HIGH_PRODUCTION', color: '#10b981' },
  { id: 'GRAS', name: 'PT Freeport Grasberg', type: 'CRITICAL_MINING', coords: [137.1167, -4.0533], status: 'STRATEGIC_ASSET', color: '#f59e0b' },
  { id: 'PRIOK', name: 'Tanjung Priok Hub', type: 'MARITIME_LOGISTICS', coords: [106.8824, -6.1042], status: 'HIGH_TRAFFIC', color: '#38bdf8' },
  { id: 'BATAM', name: 'Batam & Malacca Strait', type: 'MARITIME_DEFENSE', coords: [104.0305, 1.1301], status: 'SECURITY_MONITORED', color: '#ef4444' },
  { id: 'NATUNA', name: 'Natuna Maritime Base', type: 'MILITARY_DEFENSE', coords: [108.3846, 3.9456], status: 'DEFCON_ELEVATED', color: '#ef4444' },
  { id: 'ROKAN', name: 'Blok Rokan Oilfield', type: 'ENERGY_RESERVE', coords: [101.4478, 1.5], status: 'HIGH_PRODUCTION', color: '#f59e0b' },
  { id: 'MASELA', name: 'Blok Masela Gas Field', type: 'ENERGY_RESERVE', coords: [130.5, -8.2], status: 'UNDER_DEVELOPMENT', color: '#f59e0b' },
  { id: 'TANGGUH', name: 'LNG Tangguh Bintuni', type: 'ENERGY_RESERVE', coords: [133.1, -2.4], status: 'CRITICAL_SUPPLY', color: '#f59e0b' },
  { id: 'MAKASSAR_PORT', name: 'Makassar New Port', type: 'MARITIME_LOGISTICS', coords: [119.41, -5.11], status: 'EASTERN_GATEWAY', color: '#38bdf8' },
  { id: 'KUALA_TANJUNG', name: 'Kuala Tanjung Hub', type: 'MARITIME_LOGISTICS', coords: [99.45, 3.35], status: 'GROWING_CORRIDOR', color: '#38bdf8' },
  { id: 'MANDALIKA', name: 'Mandalika International', type: 'SPECIAL_ZONE', coords: [116.2917, -8.8956], status: 'GLOBAL_CIRCUIT', color: '#c084fc' },
  { id: 'BATANG', name: 'KIT Batang Industrial', type: 'INDUSTRIAL_HUB', coords: [109.85, -6.95], status: 'GLOBAL_RELOCATION', color: '#10b981' }
];

export const MARITIME_CHOKEPOINTS = [
  { name: 'ALKI I — Selat Sunda ke Laut Natuna', path: [[105.8, -6.0], [106.5, -3.0], [107.5, 0.0], [108.5, 3.5]] },
  { name: 'ALKI II — Selat Lombok ke Selat Makassar', path: [[115.8, -8.7], [117.5, -4.5], [118.5, -1.0], [119.5, 2.0]] },
  { name: 'ALKI III — Laut Sawu/Banda ke Laut Maluku', path: [[125.0, -9.0], [126.5, -5.0], [127.5, -1.5], [128.5, 2.5]] }
];

/**
 * Match a GeoJSON feature to province metadata
 */
export function matchProvince(featureProps) {
  if (!featureProps) return null;
  const rawName = String(
    featureProps.Propinsi ||
    featureProps.NAME_1 ||
    featureProps.state ||
    featureProps.provinsi ||
    featureProps.name ||
    ''
  ).trim().toUpperCase();

  // Direct key lookup
  if (PROVINCES_DATA[rawName]) {
    return PROVINCES_DATA[rawName];
  }

  // Alias lookup
  for (const prov of Object.values(PROVINCES_DATA)) {
    if (prov.aliases.some((a) => a === rawName || rawName.includes(a) || a.includes(rawName))) {
      return prov;
    }
  }

  // Fallback stub for unmapped boundary
  return {
    code: `ID-${(featureProps.kode || 'XX')}`,
    name: featureProps.Propinsi || featureProps.NAME_1 || 'Provinsi Indonesia',
    aliases: [rawName],
    capital: 'Pusat Pemerintahan Daerah',
    region: 'INDONESIA',
    coordinates: INDONESIA_CENTER,
    zoom: 7,
    population: 'Data BPS Terverifikasi',
    grdp: 'PDRB Terintegrasi',
    grdpShare: 'PDB Nasional',
    growth: '+5.0%',
    hdi: 'Indeks Terstandarisasi',
    commodities: [{ name: 'Pertanian & Perdagangan', category: 'general', level: 'Aktif' }],
    strategicProjects: ['Infrastruktur Konektivitas Nasional'],
    infrastructure: ['Pelabuhan & Jaringan Jalan'],
    securityLevel: 'STABIL // MONITORED',
    brief: `Wilayah administratif strategis Republik Indonesia bagian dari kedaulatan NKRI.`
  };
}

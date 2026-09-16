/**
 * server/studio/architectural/DesignProgrammer.mjs
 * Spatial Zoning, Room Dimensions, and Functional Design Program Allocation.
 */

export class DesignProgrammer {
  constructor() {}

  /**
   * Generates a rational architectural design program based on site analysis and user preferences.
   */
  generateProgram(siteAnalysis, userPreferences = {}) {
    const totalArea = siteAnalysis.dimensions.totalArea;
    const isLargeEstate = totalArea >= 500;
    const isMediumLot = totalArea >= 250 && totalArea < 500;

    // 1. Determine Floor Count & Architectural Concept
    let floors = userPreferences.floors || 2;
    let style = userPreferences.style || 'Modern Tropical Luxury';
    let poolRequested = userPreferences.pool !== undefined ? userPreferences.pool : isLargeEstate;

    // 2. Spatial Zoning & Room Inventory
    const zoning = {
      public: [
        { id: 'garasi', name: 'Garasi Tertutup (2 Mobil)', dimensions: '6.0 × 6.5 m', area: 39.0, floor: 1 },
        { id: 'carport', name: 'Carport Terbuka Kanopi Kaca (2 Mobil)', dimensions: '6.0 × 5.5 m', area: 33.0, floor: 1 },
        { id: 'teras_depan', name: 'Teras Depan & Drop-off Area', dimensions: '4.0 × 2.5 m', area: 10.0, floor: 1 },
        { id: 'foyer', name: 'Foyer Penyambut Double-Height Ceiling', dimensions: '3.5 × 3.5 m', area: 12.25, floor: 1 },
        { id: 'ruang_tamu', name: 'Ruang Tamu Formal', dimensions: '4.5 × 4.0 m', area: 18.0, floor: 1 }
      ],
      semiPublic: [
        { id: 'ruang_keluarga', name: 'Ruang Keluarga Terbuka (Overlooking Pool)', dimensions: '7.5 × 5.0 m', area: 37.5, floor: 1 },
        { id: 'ruang_makan', name: 'Ruang Makan dengan Pintu Geser Lipat Kaca', dimensions: '4.5 × 4.0 m', area: 18.0, floor: 1 },
        { id: 'dapur_bersih', name: 'Dapur Bersih (Dry Kitchen + Island Table)', dimensions: '4.0 × 3.5 m', area: 14.0, floor: 1 },
        { id: 'powder_room', name: 'Powder Room Tamu', dimensions: '2.0 × 1.8 m', area: 3.6, floor: 1 }
      ],
      private: [
        { id: 'kamar_utama', name: 'Master Bedroom Suite (View Taman & Pool)', dimensions: '6.0 × 5.0 m', area: 30.0, floor: 1 },
        { id: 'master_closet', name: 'Master Walk-in Closet', dimensions: '3.5 × 2.8 m', area: 9.8, floor: 1 },
        { id: 'master_bath', name: 'Master En-suite Bathroom dengan Bathtub', dimensions: '3.5 × 2.8 m', area: 9.8, floor: 1 },
        { id: 'ruang_kerja', name: 'Ruang Kerja Pribadi / Studio', dimensions: '4.0 × 3.5 m', area: 14.0, floor: 1 },
        { id: 'kamar_anak_1', name: 'Kamar Tidur Anak 1 + Kamar Mandi Dalam', dimensions: '4.5 × 4.2 m', area: 18.9, floor: 2 },
        { id: 'kamar_anak_2', name: 'Kamar Tidur Anak 2 + Kamar Mandi Dalam', dimensions: '4.5 × 4.2 m', area: 18.9, floor: 2 },
        { id: 'kamar_tamu', name: 'Kamar Tidur Tamu Eksekutif', dimensions: '4.0 × 3.8 m', area: 15.2, floor: 2 },
        { id: 'ruang_santai_2', name: 'Family Lounge & Entertainment Area Lantai 2', dimensions: '5.5 × 4.5 m', area: 24.75, floor: 2 },
        { id: 'balkon_depan', name: 'Balkon Fasad Depan (Kisi Kayu & Tumbuhan)', dimensions: '5.0 × 2.0 m', area: 10.0, floor: 2 }
      ],
      service: [
        { id: 'dapur_basah', name: 'Dapur Basah (Wet Kitchen)', dimensions: '3.5 × 3.0 m', area: 10.5, floor: 1 },
        { id: 'laundry_jemur', name: 'Area Cuci & Jemur Higienis', dimensions: '3.5 × 3.0 m', area: 10.5, floor: 1 },
        { id: 'kamar_art', name: 'Kamar Tidur ART / Staf', dimensions: '3.0 × 2.5 m', area: 7.5, floor: 1 },
        { id: 'km_art', name: 'Kamar Mandi Servis', dimensions: '2.0 × 1.5 m', area: 3.0, floor: 1 },
        { id: 'gudang', name: 'Gudang Penyimpanan Utilitas', dimensions: '3.0 × 2.0 m', area: 6.0, floor: 1 }
      ],
      outdoor: [
        { id: 'taman_depan', name: 'Taman Depan Asri & Vegetasi Peneduh', dimensions: 'Proporsional', area: 75.0, floor: 1 },
        { id: 'kolam_renang', name: poolRequested ? 'Kolam Renang Infinity / Lap Pool (10×3.5m)' : 'Water Feature & Kolam Koi', dimensions: '10.0 × 3.5 m', area: 35.0, floor: 1 },
        { id: 'pool_deck', name: 'Pool Deck Kayu Ulin & Gazebo Santai', dimensions: 'Proporsional', area: 28.0, floor: 1 },
        { id: 'taman_belakang', name: 'Taman Belakang & Buffer Penghijauan', dimensions: 'Proporsional', area: 60.0, floor: 1 }
      ]
    };

    // Calculate Floor Area Summary
    let groundFloorBuiltArea = 0;
    let upperFloorBuiltArea = 0;

    Object.values(zoning).forEach(zoneList => {
      zoneList.forEach(room => {
        if (room.floor === 1 && zoneList !== zoning.outdoor) {
          groundFloorBuiltArea += room.area;
        } else if (room.floor === 2) {
          upperFloorBuiltArea += room.area;
        }
      });
    });

    // Add circulation factor (~15%)
    groundFloorBuiltArea = Math.round(groundFloorBuiltArea * 1.15);
    upperFloorBuiltArea = Math.round(upperFloorBuiltArea * 1.15);
    const totalBuiltArea = groundFloorBuiltArea + upperFloorBuiltArea;

    return {
      concept: {
        style,
        floors,
        massing: 'Dual Massing dengan Inner Courtyard Terbuka (Harmoni Tropis)',
        roofType: 'Pelana Modern Tersembunyi (Hidden Gutter) + Overhang Lebar 1.8m',
        facadeMaterials: [
          'Batu Alam Andesit Alur / Travertine Premium',
          'Kisi-kisi Kayu Solid Bengkirai / Ulin Eksterior',
          'Kaca Low-E Tempered Frameless Black Aluminium',
          'Cat Eksterior Weatherproof Monokrom Warm Grey & Charcoal'
        ]
      },
      zoning,
      metrics: {
        groundFloorBuiltArea,
        upperFloorBuiltArea,
        totalBuiltArea,
        kdbActualPercent: Math.round((groundFloorBuiltArea / totalArea) * 100),
        kdhActualPercent: Math.round(((totalArea - groundFloorBuiltArea) / totalArea) * 100)
      }
    };
  }
}

export const designProgrammerInstance = new DesignProgrammer();
export default designProgrammerInstance;

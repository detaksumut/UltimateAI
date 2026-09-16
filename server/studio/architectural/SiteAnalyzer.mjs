/**
 * server/studio/architectural/SiteAnalyzer.mjs
 * Automatic Site Analysis, Environmental Feasibility, and Zoning Parameters.
 */

export class SiteAnalyzer {
  constructor() {}

  /**
   * Extracts site dimensions and computes comprehensive site metrics.
   * Accepts texts like "lahan 20x30", "tanah 15 x 25 meter", "ukuran 20 * 30 m", etc.
   */
  analyzeSite(userInput = '', options = {}) {
    const text = String(userInput || '').toLowerCase();
    
    // 1. Extract Dimensions (A x B)
    let width = options.width || 0;
    let length = options.length || 0;

    if (!width || !length) {
      const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:[xX*×]|kali|by|\s+x\s+)\s*(\d+(?:[.,]\d+)?)\s*(?:m|meter|mtr)?/i);
      if (match) {
        const d1 = parseFloat(match[1].replace(',', '.'));
        const d2 = parseFloat(match[2].replace(',', '.'));
        // Smaller is usually frontage/width, larger is depth/length
        width = Math.min(d1, d2);
        length = Math.max(d1, d2);
      } else {
        // Fallback standard medium-large residential lot: 20 x 30 m
        width = 20;
        length = 30;
      }
    }

    const totalArea = Math.round(width * length * 10) / 10;
    const aspectRatio = `${width}:${length}`;

    // 2. Setback & Building Line (GSB) Standards
    // GSB front is typically 1/2 of road width + 1, assuming 8m local road -> 5m setback
    const gsbFront = width >= 20 ? 5.0 : (width >= 12 ? 4.0 : 3.0);
    const rearSetback = 3.0;
    const sideSetbackLeft = width >= 15 ? 2.5 : 1.5;
    const sideSetbackRight = width >= 15 ? 2.5 : 1.5;

    // 3. Zoning Coefficients (KDB, KDH, KLB)
    const kdbTarget = 0.55; // 55% built area
    const kdhTarget = 0.45; // 45% green space
    const maxGroundFootprint = Math.round(totalArea * kdbTarget);
    const minGreenArea = Math.round(totalArea * kdhTarget);

    // 4. Orientation & Microclimate Assumptions
    let orientation = 'Menghadap Utara/Selatan (Optimal Meminimalisir Radiasi Panas Langsung Timur-Barat)';
    let roadAccess = 'Jalan Lingkungan Lebar 8 Meter di Sisi Depan';

    if (/timur/i.test(text)) orientation = 'Menghadap Timur (Cahaya Pagi Optimal)';
    else if (/barat/i.test(text)) orientation = 'Menghadap Barat (Dilengkapi Buffer Secondary Skin)';
    else if (/utara/i.test(text)) orientation = 'Menghadap Utara (Pencahayaan Difus Merata)';
    else if (/selatan/i.test(text)) orientation = 'Menghadap Selatan (Pencahayaan Stabil)';

    const orientationAssumed = !/timur|barat|utara|selatan/i.test(text);
    const roadAssumed = !/jalan\s+utama|hook|sudut|gang/i.test(text);

    return {
      dimensions: {
        width,
        length,
        totalArea,
        aspectRatio
      },
      setbacks: {
        front: gsbFront,
        rear: rearSetback,
        left: sideSetbackLeft,
        right: sideSetbackRight,
        netBuildableWidth: width - (sideSetbackLeft + sideSetbackRight),
        netBuildableLength: length - (gsbFront + rearSetback)
      },
      regulations: {
        kdbPercent: Math.round(kdbTarget * 100),
        kdhPercent: Math.round(kdhTarget * 100),
        maxGroundFootprint,
        minGreenArea
      },
      orientation: {
        value: orientation,
        isAssumed: orientationAssumed,
        label: orientationAssumed ? 'ASUMSI DESAIN — DAPAT DIUBAH' : 'PARAMETER PENGGUNA'
      },
      access: {
        road: roadAccess,
        isAssumed: roadAssumed,
        label: roadAssumed ? 'ASUMSI DESAIN — DAPAT DIUBAH' : 'PARAMETER PENGGUNA'
      },
      environmentalStrategies: [
        'Ventilasi silang (cross-ventilation) melalui inner courtyard / taman samping',
        'Pencahayaan alami maksimal di seluruh ruang utama tanpa ketergantungan lampu siang hari',
        'Area resapan air hijau mandiri (>40% luas tapak) untuk konservasi air tanah',
        'Sirkulasi terpisah antara jalur kendaraan (carport/garasi) dengan akses pejalan kaki'
      ]
    };
  }
}

export const siteAnalyzerInstance = new SiteAnalyzer();
export default siteAnalyzerInstance;

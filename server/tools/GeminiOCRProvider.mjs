/**
 * GeminiOCRProvider.mjs
 * Provider OCR berbasis Gemini Vision & Multimodal untuk dokumen scan (PDF, Gambar) di UltimateAI / JIN.
 * Mendukung PDF scan, foto dokumen, screenshot, dan dokumen biner lainnya.
 */

import { geminiProviderInstance } from '../providers/GeminiProvider.mjs';
import fs from 'fs';
import path from 'path';

const OCR_PROMPT = `Anda adalah sistem OCR (Optical Character Recognition) presisi tinggi kelas enterprise.
Tugas Anda: Ekstrak dan transkripsikan SELURUH teks dari dokumen/gambar ini secara lengkap dan akurat.

Petunjuk Penting:
1. RUNTUT: Transkripsikan isi dokumen dari awal hingga akhir sesuai tata letak aslinya.
2. LENGKAP: Jangan memotong, merangkum, atau melewati bagian apa pun. Ekstrak setiap bab, pasal, ayat, tabel, header, footer, dan catatan kaki.
3. STRUKTUR: Pertahankan format hirarki judul, penomoran poin (1, a, i, dsb), dan struktur tabel jika ada.
4. KONTEN ASLI: Jangan menambahkan komentar, pembuka, atau penutup. Kembalikan HANYA teks isi dokumen hasil ekstraksi/transkripsi.`;

/**
 * Ekstrak teks dari Buffer dokumen/gambar menggunakan Gemini Multimodal.
 * @param {Buffer} buffer - Buffer file biner (PDF atau gambar)
 * @param {string} fileName - Nama file
 * @param {string} mimeType - MIME type (cth: 'application/pdf', 'image/jpeg', 'image/png')
 * @returns {Promise<{status: 'OK'|'NEED_OCR'|'FAILED', text: string, meta: object, error: string|null}>}
 */
export async function ocrFromBuffer(buffer, fileName = 'document.pdf', mimeType = 'application/pdf') {
  if (!buffer || buffer.length === 0) {
    return { status: 'EMPTY', text: '', meta: { fileName }, error: 'Buffer dokumen kosong.' };
  }

  // Tentukan MIME type yang tepat jika generic atau tidak disediakan
  let resolvedMime = mimeType;
  const lowerName = String(fileName || '').toLowerCase();
  if (!resolvedMime || resolvedMime === 'application/octet-stream') {
    if (lowerName.endsWith('.pdf')) resolvedMime = 'application/pdf';
    else if (lowerName.endsWith('.png')) resolvedMime = 'image/png';
    else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) resolvedMime = 'image/jpeg';
    else if (lowerName.endsWith('.webp')) resolvedMime = 'image/webp';
    else if (buffer.length > 5 && buffer.slice(0, 5).toString() === '%PDF-') resolvedMime = 'application/pdf';
  }

  // Batas ukuran inlineData Gemini (maksimal ~20MB buffer)
  if (buffer.length > 20 * 1024 * 1024) {
    console.warn(`[GeminiOCR] Dokumen terlalu besar (${Math.round(buffer.length / 1024 / 1024)}MB) untuk inlineData OCR.`);
    return {
      status: 'FAILED',
      text: '',
      meta: { fileName, sizeBytes: buffer.length },
      error: `Ukuran dokumen (${Math.round(buffer.length / 1024 / 1024)}MB) melebihi batas 20MB untuk OCR.`
    };
  }

  const base64Data = buffer.toString('base64');
  console.log(`[GeminiOCR] Memulai OCR untuk ${fileName} (${resolvedMime}, ${Math.round(buffer.length / 1024)} KB)...`);

  try {
    const messages = [
      {
        role: 'user',
        content: [
          {
            inlineData: {
              mimeType: resolvedMime,
              data: base64Data
            }
          },
          {
            text: OCR_PROMPT
          }
        ]
      }
    ];

    const extractedText = await geminiProviderInstance.sendChat({
      messages,
      stream: false,
      model: 'auto',
      temperature: 0.1
    });

    if (extractedText && typeof extractedText === 'string' && extractedText.trim().length >= 10) {
      const cleanText = extractedText.trim();
      console.log(`[GeminiOCR] Sukses mengekstrak ${cleanText.length} karakter dari ${fileName}.`);
      return {
        status: 'OK',
        text: cleanText,
        meta: {
          fileName,
          mimeType: resolvedMime,
          chars: cleanText.length,
          provider: 'gemini-vision-ocr',
          source: 'gemini-multimodal'
        },
        error: null
      };
    }

    return {
      status: 'NEED_OCR',
      text: '',
      meta: { fileName, mimeType: resolvedMime },
      error: 'Gemini OCR tidak menghasilkan teks yang memadai dari dokumen ini.'
    };
  } catch (err) {
    console.error(`[GeminiOCR] Error saat melakukan OCR pada ${fileName}:`, err.message);
    return {
      status: 'FAILED',
      text: '',
      meta: { fileName, mimeType: resolvedMime },
      error: `OCR Error: ${err.message}`
    };
  }
}

/**
 * Ekstrak teks dari DataURL (base64 string).
 * @param {string} dataUrl - data:mime;base64,...
 * @param {string} fileName - Nama file
 */
export async function ocrFromDataUrl(dataUrl, fileName = 'document.pdf') {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return { status: 'EMPTY', text: '', meta: { fileName }, error: 'dataUrl kosong.' };
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    return { status: 'FAILED', text: '', meta: { fileName }, error: 'Format dataUrl tidak valid.' };
  }
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return ocrFromBuffer(buffer, fileName, mimeType);
}

/**
 * OCR multi-halaman dari citra halaman PDF yang sudah di-render.
 *
 * Berbeda dengan ocrFromBuffer() yang mengirim satu inlineData (PDF utuh) —
 * jalur ini mengirim N halaman sebagai inlineData terpisah dalam satu request,
 * sehingga:
 *  - menghindari satu request giant yang selalu timeout untuk dokumen 40+ halaman;
 *  - setiap halaman diberi label eksplisit sehingga output bisa dipetakan
 *    kembali ke nomor halaman asli.
 *
 * @param {Array<{pageNumber:number, buffer:Buffer, mimeType?:string}>} pages
 * @param {Object} [opts]
 * @returns {Promise<{status:'OK'|'NEED_OCR'|'FAILED', text:string, meta:object, error:string|null}>}
 */
export async function ocrPageImages(pages = [], opts = {}) {
  const list = Array.isArray(pages) ? pages.filter(p => p && p.buffer && p.buffer.length) : [];
  if (list.length === 0) {
    return { status: 'NEED_OCR', text: '', meta: { pages: 0 }, error: 'Tidak ada citra halaman untuk di-OCR.' };
  }

  const maxPages = Number(process.env.DOC_OCR_MAX_PAGES_PER_REQUEST || 8);
  const batch = list.slice(0, maxPages);

  // Batas keras inlineData Gemini (~20MB untuk keseluruhan request).
  const MAX_INLINE_BYTES = 18 * 1024 * 1024;
  let totalBytes = 0;
  const parts = [];
  for (const p of batch) {
    totalBytes += p.buffer.length;
    parts.push({ inlineData: { mimeType: p.mimeType || 'image/png', data: p.buffer.toString('base64') } });
    parts.push({ text: `[INSTRUKSI: Transkripsikan SELURUH isi di atas (halaman ${p.pageNumber}). Jangan menambahkan komentar apa pun. Awal baris baru dengan penanda "### HALAMAN ${p.pageNumber} ###".` });
  }
  if (totalBytes > MAX_INLINE_BYTES) {
    return {
      status: 'FAILED',
      text: '',
      meta: { pages: batch.length, bytes: totalBytes },
      error: `Batch OCR melebihi batas inline (${Math.round(totalBytes / 1024 / 1024)}MB).`
    };
  }

  parts.push({ text: OCR_PROMPT });

  try {
    const extracted = await geminiProviderInstance.sendChat({
      messages: [{ role: 'user', content: parts }],
      stream: false,
      model: opts.model || 'auto',
      temperature: 0.1
    });

    if (extracted && typeof extracted === 'string' && extracted.trim().length >= 10) {
      return {
        status: 'OK',
        text: extracted.trim(),
        meta: {
          pages: batch.length,
          firstPage: batch[0].pageNumber,
          lastPage: batch[batch.length - 1].pageNumber,
          chars: extracted.trim().length,
          provider: 'gemini-vision-page-ocr',
          source: 'gemini-multimodal'
        },
        error: null
      };
    }

    return {
      status: 'NEED_OCR',
      text: '',
      meta: { pages: batch.length },
      error: 'Gemini tidak menghasilkan teks yang memadai untuk batch halaman ini.'
    };
  } catch (err) {
    return {
      status: 'FAILED',
      text: '',
      meta: { pages: batch.length },
      error: `OCR batch error: ${err.message}`
    };
  }
}

export default {
  ocrFromBuffer,
  ocrFromDataUrl,
  ocrPageImages
};

/**
 * DocumentParser.mjs
 * Production document parsing utility for JIN.
 * Extracts plain text from PDF, DOCX, TXT, CSV, JSON, MD buffers.
 */

import { createRequire } from 'module';
import AdmZip from 'adm-zip';

const require = createRequire(import.meta.url);

let PDFParseClass = null;
function getPDFParse() {
  if (!PDFParseClass) {
    try {
      const pdfModule = require('pdf-parse');
      PDFParseClass = pdfModule.PDFParse || pdfModule;
    } catch (err) {
      console.warn('[DocumentParser] pdf-parse load error:', err.message);
    }
  }
  return PDFParseClass;
}

/**
 * Extracts plain text from a buffer (PDF, DOCX, TXT, CSV, MD)
 * @param {Buffer} buffer
 * @param {string} fileName
 * @param {string} mimeType
 * @returns {Promise<string>}
 */
export async function extractTextFromBuffer(buffer, fileName = '', mimeType = '') {
  if (!buffer || buffer.length === 0) return '';

  const lowerName = String(fileName || '').toLowerCase();
  const lowerMime = String(mimeType || '').toLowerCase();

  const isPdf = lowerName.endsWith('.pdf') || lowerMime.includes('application/pdf') || (buffer.length > 5 && buffer.slice(0, 5).toString() === '%PDF-');
  const isDocx = lowerName.endsWith('.docx') || lowerMime.includes('wordprocessingml');

  if (isPdf) {
    const PDFClass = getPDFParse();
    if (PDFClass) {
      try {
        const parser = new PDFClass({ data: buffer });
        const res = await parser.getText();
        const text = (res && typeof res.text === 'string') ? res.text : (typeof res === 'string' ? res : '');
        if (text && text.trim()) return text.trim();
      } catch (pdfErr) {
        console.warn('[DocumentParser] PDF parsing failed, trying raw string fallback:', pdfErr.message);
      }
    }
  }

  if (isDocx) {
    try {
      const zip = new AdmZip(buffer);
      const xml = zip.readAsText('word/document.xml');
      if (xml) {
        return xml
          .replace(/<w:p\b[^>]*>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    } catch (docxErr) {
      console.warn('[DocumentParser] DOCX parsing failed:', docxErr.message);
    }
  }

  // Plain text / CSV / JSON / MD fallback
  try {
    return buffer.toString('utf-8').trim();
  } catch {
    return '';
  }
}

/**
 * Parses DataURL (e.g. data:application/pdf;base64,...)
 * @param {string} dataUrl
 * @param {string} fileName
 * @returns {Promise<string>}
 */
export async function extractTextFromDataUrl(dataUrl, fileName = '') {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    // If not a dataurl, might be raw string
    return dataUrl.trim();
  }

  const mimeType = match[1];
  const base64Str = match[2];
  const buffer = Buffer.from(base64Str, 'base64');
  return extractTextFromBuffer(buffer, fileName, mimeType);
}

/**
 * Cloud document parser for public JINI embeds.
 * Accepts { fileName, dataUrl } and returns extracted text.
 *
 * Important: Vercel serverless request-body limits still apply. Large files
 * should be uploaded to object storage and referenced by URL rather than
 * sent as base64 JSON.
 */
import { PDFParse } from 'pdf-parse';

const MAX_INLINE_BYTES = 3 * 1024 * 1024;
const MAX_TEXT_CHARS = 180000;

function decodeDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') throw new Error('dataUrl must be a string');
  const match = dataUrl.match(/^data:([^;,]+)?;base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) throw new Error('Invalid base64 data URL');
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw new Error('Uploaded file is empty');
  if (buffer.length > MAX_INLINE_BYTES) {
    const err = new Error('FILE_TOO_LARGE_FOR_INLINE_PARSE: upload file storage/reference flow is required for files above 3 MB.');
    err.statusCode = 413;
    throw err;
  }
  return { mimeType: (match[1] || '').toLowerCase(), buffer };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  let parser;
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = null; }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'A JSON body is required.' });
    }

    const { fileName = 'document.pdf', dataUrl = '' } = body;
    if (!dataUrl) return res.status(400).json({ error: 'dataUrl is required.' });

    const { mimeType, buffer } = decodeDataUrl(dataUrl);
    const ext = String(fileName).toLowerCase().split('.').pop();
    if (mimeType !== 'application/pdf' && ext !== 'pdf') {
      return res.status(415).json({ error: 'This endpoint currently supports PDF files only.' });
    }

    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = String(result?.text || '').trim();
    if (!text) {
      return res.status(422).json({
        error: 'PDF_TEXT_EMPTY',
        message: 'No selectable text was found. This PDF may require OCR for scanned pages.'
      });
    }

    return res.status(200).json({
      success: true,
      fileName: String(fileName).slice(0, 240),
      text: text.slice(0, MAX_TEXT_CHARS),
      length: Math.min(text.length, MAX_TEXT_CHARS),
      truncated: text.length > MAX_TEXT_CHARS,
      parser: 'pdf-parse'
    });
  } catch (err) {
    const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
    console.error('[CloudDocumentParse] failed:', err?.message || 'unknown error');
    return res.status(status).json({
      error: status === 413 ? 'FILE_TOO_LARGE_FOR_INLINE_PARSE' : 'DOCUMENT_PARSE_FAILED',
      message: String(err?.message || 'Document parsing failed').slice(0, 300)
    });
  } finally {
    if (parser && typeof parser.destroy === 'function') {
      try { await parser.destroy(); } catch (_) {}
    }
  }
}

import JSZip from 'jszip';
import { RouterConfig } from '../services/router/RouterConfig.js';

export const readFileAsText = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });

export const readFileAsDataUrl = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

let _pdfjsPromise = null;

function loadPdfJs() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsPromise) return _pdfjsPromise;

  _pdfjsPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        resolve(null);
      }
    };
    script.onerror = () => {
      const fallbackScript = document.createElement('script');
      fallbackScript.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
      fallbackScript.async = true;
      fallbackScript.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else {
          resolve(null);
        }
      };
      fallbackScript.onerror = () => resolve(null);
      document.head.appendChild(fallbackScript);
    };
    document.head.appendChild(script);
  });

  return _pdfjsPromise;
}

/**
 * Client-Side PDF text extraction.
 * Uses Mozilla's PDF.js in the browser without any backend requirement.
 */
export async function readPdfAsText(file) {
  try {
    const pdfjsLib = await loadPdfJs();
    if (!pdfjsLib) return '';

    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    });

    const pdf = await loadingTask.promise;
    const pages = [];
    const maxPages = Math.min(pdf.numPages, 100);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      if (pageText.trim()) {
        pages.push(`[Halaman ${i}]\n${pageText.trim()}`);
      }
    }

    const fullPdfText = pages.join('\n\n').trim();
    if (fullPdfText) {
      return fullPdfText;
    }
  } catch (err) {
    console.warn('[documentReader] Client-side PDF parse error:', err);
  }
  return '';
}

/**
 * Client-side Word DOCX extraction via JSZip.
 */
export async function readDocxAsText(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    const docXml = await zip.file('word/document.xml')?.async('text');
    if (docXml) {
      return docXml
        .replace(/<w:p\b[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  } catch (err) {
    console.warn('[documentReader] Failed to extract docx text via JSZip:', err);
  }
  return '';
}

/**
 * Client-side Word DOC (Word 97-2004 Binary / OLE2) text extraction.
 * Extracts UTF-16LE and ASCII text streams directly from the binary buffer.
 */
export async function readDocAsText(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 1. Extract UTF-16LE text sequences
    const utf16Chunks = [];
    let curUtf16 = [];
    for (let i = 0; i < bytes.length - 1; i += 2) {
      const low = bytes[i];
      const high = bytes[i + 1];
      if (high === 0 && ((low >= 32 && low <= 126) || low === 10 || low === 13 || low === 9 || (low >= 160 && low <= 255))) {
        curUtf16.push(String.fromCharCode(low));
      } else {
        if (curUtf16.length >= 4) {
          utf16Chunks.push(curUtf16.join(''));
        }
        curUtf16 = [];
      }
    }
    if (curUtf16.length >= 4) utf16Chunks.push(curUtf16.join(''));

    // 2. Extract ASCII 8-bit text sequences
    const asciiChunks = [];
    let curAscii = [];
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
        curAscii.push(String.fromCharCode(b));
      } else {
        if (curAscii.length >= 5) {
          asciiChunks.push(curAscii.join(''));
        }
        curAscii = [];
      }
    }
    if (curAscii.length >= 5) asciiChunks.push(curAscii.join(''));

    const filterGarbage = (chunks) =>
      chunks.filter((c) => {
        const trimmed = c.trim();
        if (trimmed.length < 3) return false;
        if (/^(Root Entry|WordDocument|1Table|0Table|Data|SummaryInformation|DocumentSummaryInformation|CompObj)/i.test(trimmed)) return false;
        if (/^(Times New Roman|Calibri|Arial|Courier New|Symbol|Wingdings)/i.test(trimmed) && trimmed.length < 20) return false;
        return true;
      });

    const cleanUtf16 = filterGarbage(utf16Chunks);
    const cleanAscii = filterGarbage(asciiChunks);

    const textUtf16 = cleanUtf16.join(' ').replace(/\s+/g, ' ').trim();
    const textAscii = cleanAscii.join(' ').replace(/\s+/g, ' ').trim();

    const bestText = textUtf16.length > textAscii.length ? textUtf16 : textAscii;
    if (bestText && bestText.length > 20) {
      return bestText;
    }
  } catch (err) {
    console.warn('[documentReader] Error extracting text from .doc:', err);
  }
  return '';
}

/**
 * Universal file processor for user attachments.
 */
export async function readUploadedDocument(file) {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx');
  const isDoc = file.name.toLowerCase().endsWith('.doc') && !isDocx;
  const isText =
    file.type.startsWith('text/') ||
    /\.(json|csv|js|ts|py|html|css|md|txt|log|xml|yaml|yml)$/i.test(file.name);

  let dataUrl = null;
  let content = '';

  if (isImage && file.size < 10 * 1024 * 1024) {
    dataUrl = await readFileAsDataUrl(file);
  } else if (isPdf && file.size < 35 * 1024 * 1024) {
    dataUrl = await readFileAsDataUrl(file);
    content = await readPdfAsText(file);
    if (!content) {
      // Fallback: parser backend via URL absolut LocalRouter.
      // JANGAN pakai '/api/...' relatif — di hosting statis (Vercel)
      // itu me-rewrite ke index.html -> 405 Method Not Allowed.
      try {
        const parseRes = await fetch(RouterConfig.api('/api/files/parse'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, dataUrl })
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (parseRes?.text || parseRes?.content) {
          content = parseRes.text || parseRes.content;
        }
      } catch (_) {}
    }
  } else if (isDocx && file.size < 25 * 1024 * 1024) {
    content = await readDocxAsText(file);
    if (!content) {
      dataUrl = await readFileAsDataUrl(file);
      try {
        const parseRes = await fetch(RouterConfig.api('/api/files/parse'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, dataUrl })
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (parseRes?.text || parseRes?.content) {
          content = parseRes.text || parseRes.content;
        }
      } catch (_) {}
    }
  } else if (isDoc && file.size < 25 * 1024 * 1024) {
    content = await readDocAsText(file);
    if (!content) {
      dataUrl = await readFileAsDataUrl(file);
      try {
        const parseRes = await fetch(RouterConfig.api('/api/files/parse'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, dataUrl })
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (parseRes?.text || parseRes?.content) {
          content = parseRes.text || parseRes.content;
        }
      } catch (_) {}
    }
    if (!content) {
      content = `[Dokumen: ${file.name} (Format Word .doc terlampir)]`;
    }
  } else if (isText && file.size < 10 * 1024 * 1024) {
    content = await readFileAsText(file);
  } else if (file.size < 5 * 1024 * 1024) {
    content = await readFileAsText(file);
  }

  return {
    id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: file.name,
    size: file.size,
    type: file.type || (isPdf ? 'application/pdf' : isDoc || isDocx ? 'application/msword' : 'document'),
    isImage,
    isPdf,
    isDoc: isDoc || isDocx,
    dataUrl,
    content: content || ''
  };
}

/**
 * ContentExtractor.js (Hardened Edition)
 * Enterprise-grade multi-format document content extractor with context budgeting, chunking, and malformed data protection.
 */

export class ContentExtractor {
  static MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB Hard Limit
  static MAX_CONTEXT_CHARS = 10000; // 10,000 chars context window budget per document
  static EXTRACTION_TIMEOUT_MS = 8000;

  static async extractFromFile(file) {
    if (!file) throw new Error('No file provided');

    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`File melampaui batas maksimal 10MB (${(file.size / (1024 * 1024)).toFixed(1)}MB). Mohon unggah dokumen yang lebih ringkas.`);
    }

    const fileName = file.name;
    const fileType = file.type || '';
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    if (fileType.startsWith('image/')) {
      return this.processImage(file);
    }

    if (extension === 'json') {
      return this.processJson(file);
    }

    if (extension === 'csv') {
      return this.processCsv(file);
    }

    return this.processPlainText(file);
  }

  static async processPlainText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const timer = setTimeout(() => {
        try { reader.abort(); } catch {}
        reject(new Error('Timeout ekstraksi teks. Operasi dibatalkan.'));
      }, this.EXTRACTION_TIMEOUT_MS);

      reader.onload = (e) => {
        clearTimeout(timer);
        const raw = e.target.result || '';
        const charCount = raw.length;
        const isTruncated = charCount > this.MAX_CONTEXT_CHARS;
        const content = isTruncated ? raw.substring(0, this.MAX_CONTEXT_CHARS) + `\n\n[...Konten diringkas: Total ${charCount} karakter...]` : raw;

        resolve({
          fileName: file.name,
          type: 'text/document',
          size: file.size,
          charCount,
          isTruncated,
          content,
          preview: raw.substring(0, 250) + (raw.length > 250 ? '...' : '')
        });
      };

      reader.onabort = () => {
        clearTimeout(timer);
        reject(new Error('Ekstraksi dibatalkan.'));
      };

      reader.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Gagal membaca file teks.'));
      };

      reader.readAsText(file);
    });
  }

  static async processCsv(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const timer = setTimeout(() => reject(new Error('Timeout parsing CSV.')), this.EXTRACTION_TIMEOUT_MS);

      reader.onload = (e) => {
        clearTimeout(timer);
        try {
          const raw = e.target.result || '';
          const lines = raw.split('\n').filter(l => l.trim().length > 0);
          
          if (lines.length === 0) {
            throw new Error('File CSV kosong.');
          }

          const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
          const rowCount = Math.max(0, lines.length - 1);

          // Sample first 20 representative rows for Context Budget
          const sampleRows = lines.slice(1, 21);
          const structuredSummary = `CSV Dataset Schema: [${headers.join(', ')}]\nTotal Baris: ${rowCount}\nSample Data:\n${sampleRows.join('\n')}`;

          resolve({
            fileName: file.name,
            type: 'data/tabular',
            size: file.size,
            headers,
            rowCount,
            isTruncated: rowCount > 20,
            content: structuredSummary,
            preview: `CSV Dataset: ${rowCount} baris, Kolom: [${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}]`
          });
        } catch (err) {
          reject(new Error(`Format CSV rusak atau tidak valid: ${err.message}`));
        }
      };

      reader.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Gagal memproses file CSV.'));
      };

      reader.readAsText(file);
    });
  }

  static async processJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const timer = setTimeout(() => reject(new Error('Timeout parsing JSON.')), this.EXTRACTION_TIMEOUT_MS);

      reader.onload = (e) => {
        clearTimeout(timer);
        try {
          const raw = e.target.result || '{}';
          const parsed = JSON.parse(raw);
          const isArray = Array.isArray(parsed);
          const count = isArray ? parsed.length : Object.keys(parsed).length;
          
          // Truncate payload safely if oversized
          const stringified = JSON.stringify(parsed, null, 2);
          const isTruncated = stringified.length > this.MAX_CONTEXT_CHARS;
          const content = isTruncated
            ? stringified.substring(0, this.MAX_CONTEXT_CHARS) + '\n\n[...Struktur JSON diringkas...]'
            : stringified;

          resolve({
            fileName: file.name,
            type: 'data/json',
            size: file.size,
            isTruncated,
            content,
            preview: `JSON Data (${isArray ? `${count} items array` : `${count} object keys`})`
          });
        } catch {
          reject(new Error('Format JSON rusak / Syntax Error pada file JSON.'));
        }
      };

      reader.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Gagal membaca file JSON.'));
      };

      reader.readAsText(file);
    });
  }

  static async processImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          fileName: file.name,
          type: 'image/visual',
          size: file.size,
          dataUrl: e.target.result,
          content: `[Visual Asset Attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`,
          preview: `Image Asset: ${file.name}`
        });
      };
      reader.onerror = () => reject(new Error('Gagal memproses file gambar.'));
      reader.readAsDataURL(file);
    });
  }
}

export default ContentExtractor;

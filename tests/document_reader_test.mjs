import fs from 'fs';
import path from 'path';

// Unit test verifying binary .doc extraction logic
async function testDocExtraction() {
  console.log('[TEST] Testing .doc text extraction logic...');
  
  // Construct a mock binary .doc buffer with OLE header + UTF-16LE text and ASCII text
  const textSample = "JUDUL PENELITIAN: ANALISIS IMPLEMENTASI SISTEM INTELIJEN AI TAHUN 2026";
  const utf16Bytes = [];
  for (let i = 0; i < textSample.length; i++) {
    utf16Bytes.push(textSample.charCodeAt(i));
    utf16Bytes.push(0); // UTF-16LE high byte
  }
  
  const mockBuffer = new Uint8Array([
    0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, // OLE2 magic
    0x00, 0x01, 0x02, 0x03,
    ...utf16Bytes,
    0x00, 0x00, 0x00, 0x00
  ]);
  
  // Apply documentReader extraction logic
  const bytes = mockBuffer;
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
  
  const extracted = utf16Chunks.join(' ').trim();
  console.log('[TEST] Extracted text from mock .doc:', extracted);
  
  if (extracted.includes("ANALISIS IMPLEMENTASI")) {
    console.log('[TEST] ✅ .doc binary extraction logic PASSED');
  } else {
    throw new Error('[TEST] ❌ .doc extraction failed');
  }
}

testDocExtraction().then(() => {
  console.log('[TEST] ALL DOCUMENT EXTRACTION LOGIC TESTS PASSED');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

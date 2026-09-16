import assert from 'assert';

async function testDocumentPipeline() {
  console.log('--- 1. Testing /api/files/parse with PDF dataUrl ---');
  const minimalPdfBase64 = Buffer.from(`%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 120 >> stream
BT
/F1 18 Tf
0 50 Td
(PERMENDAGRI NOMOR 47 TAHUN 2016 TENTANG TATA CARA PEMBUKUAN ASET DESA) Tj
ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000370 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
444
%%EOF`).toString('base64');

  const dataUrl = `data:application/pdf;base64,${minimalPdfBase64}`;

  const parseRes = await fetch('http://127.0.0.1:20200/api/files/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'Permendagri_47_2016.pdf',
      dataUrl
    })
  });

  assert.strictEqual(parseRes.status, 200, 'Expected 200 from /api/files/parse');
  const parseJson = await parseRes.json();
  console.log('Parse response:', parseJson);
  assert(parseJson.success, 'Parse should succeed');
  assert(parseJson.text.includes('PERMENDAGRI NOMOR 47 TAHUN'), 'Parsed text must contain document content');
  console.log('✓ /api/files/parse successfully extracted text from PDF!');

  console.log('\n--- 2. Testing Chat Streaming with Attached Document ---');
  const systemPrompt = `You are JIN, an autonomous, highly capable, deeply thoughtful, and articulate AI partner in UltimateAI.
PRINSIP KOGNISI & ANALISIS DOKUMEN:
Ketika dokumen dilampirkan dalam format teks di bawah ini, Anda WAJIB langsung membaca dan menganalisis isinya secara komprehensif, objektif, dan terstruktur. JANGAN PERNAH menolak atau mengatakan "tidak dapat membuka berkas" karena teks dokumen sudah ada di bawah ini.`;

  const sampleDocText = `PERATURAN MENTERI DALAM NEGERI REPUBLIK INDONESIA NOMOR 47 TAHUN 2016 TENTANG TATA CARA PEMBUKUAN, INVENTARISASI, DAN PELAPORAN BARANG MILIK DESA.
BAB I KETENTUAN UMUM
Pasal 1:
1. Aset Desa adalah barang milik Desa yang berasal dari kekayaan asli Desa, dibeli atau diperoleh atas beban Anggaran Pendapatan dan Belanja Desa atau perolehan hak lainnya yang sah.
2. Pembukuan adalah proses pencatatan aset desa ke dalam buku inventaris desa.
3. Inventarisasi adalah kegiatan untuk melakukan pendataan, pencatatan, dan pelaporan hasil pendataan barang milik desa.
BAB II PENGELOLAAN DAN PEMBUKUAN
Pasal 4:
Kepala Desa memegang kekuasaan pengelolaan aset desa dan berwenang menetapkan kebijakan pengelolaan serta pembukuan aset desa.`;

  const chatPrompt = `Tolong baca dan analisis isi dokumen yang saya lampirkan berikut:

--- [BERKAS DOKUMEN TERLAMPIR: Permendagri_47_2016.pdf] ---
${sampleDocText}
--- [AKHIR DOKUMEN: Permendagri_47_2016.pdf] ---

Jelaskan apa inti yang diatur dalam dokumen ini dan siapa penanggung jawab utamanya?`;

  const chatRes = await fetch('http://127.0.0.1:20200/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3:8b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: chatPrompt }
      ],
      stream: false
    })
  });

  assert.strictEqual(chatRes.status, 200, 'Expected 200 from chat completions');
  const chatJson = await chatRes.json();
  const reply = chatJson.choices?.[0]?.message?.content || '';
  console.log('\nJIN Response:\n', reply.slice(0, 600) + '...\n');

  assert(reply.length > 50, 'JIN must provide a substantial response');
  assert(!reply.includes('Saya tidak dapat membuka atau membaca berkas'), 'Must NOT say cannot open/read file');
  assert(!reply.includes('Saya tidak memiliki data yang cukup'), 'Must NOT refuse with no data');
  assert(!reply.includes('Permintaan Anda sedang diproses:'), 'Must NOT return deterministic dummy fallback');
  console.log('✓ JIN successfully read, comprehended, and analyzed the document!');
}

testDocumentPipeline().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});

import assert from 'assert';

async function testCleanPresentationFlow() {
  console.log('=== TEST: Verifikasi Pembersihan Regex Hijacking ===');

  // Test 1: User asks for 5 slide presentation outline from document
  const chatPayload = {
    model: 'qwen3:8b',
    stream: false,
    messages: [
      {
        role: 'user',
        content: `Tolong baca dokumen berikut dan buatkan poin-poin materi untuk presentasi 5 slide:\n\n--- [BERKAS DOKUMEN TERLAMPIR: UU_Desa.txt] ---\nPasal 1: Desa adalah kesatuan masyarakat hukum yang memiliki batas wilayah.\nPasal 2: Penyelenggaraan Pemerintahan Desa berasaskan kepastian hukum, tertib penyelenggaraan, dan keterbukaan.\nPasal 3: Kepala Desa bertugas menyelenggarakan Pemerintahan Desa, melaksanakan Pembangunan Desa, pembinaan kemasyarakatan Desa, dan pemberdayaan masyarakat Desa.\n--- [AKHIR DOKUMEN: UU_Desa.txt] ---\n\nBuat poin-poin presentasi 5 slide.`
      }
    ]
  };

  console.log('Mengirim permintaan pembuatan materi 5 slide ke /v1/chat/completions...');
  const res = await fetch('http://127.0.0.1:20200/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatPayload)
  });

  assert(res.ok, `Status response must be 200, got ${res.status}`);
  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content || '';

  console.log('\nRespon JIN:\n', reply.slice(0, 400), '...\n');

  // Validasi: Tidak boleh ada kalimat penolakan atau fallback deterministik
  assert(!reply.includes('Permintaan Anda sedang diproses:'), 'TIDAK BOLEH memicu fallback deterministik dummy!');
  assert(!reply.includes('Saya tidak memiliki data yang cukup'), 'TIDAK BOLEH menolak membaca dokumen!');
  assert(reply.toLowerCase().includes('slide') || reply.toLowerCase().includes('desa'), 'Respon harus memuat slide atau topik desa!');
  console.log('✓ TEST 1 PASS: Permintaan materi presentasi dialirkan murni ke LLM tanpa dibajak regex!');

  console.log('\n=== SELURUH TEST PEMBERSIHAN HIJACKING LULUS (100% PASS) ===');
}

testCleanPresentationFlow().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});

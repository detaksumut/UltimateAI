/**
 * scratch/run_live_revision_8steps.mjs
 * Perform ONE live IMAGE_REVISION against LocalRouterServer (127.0.0.1:20200)
 * Request: "sekarang ubah suasananya menjadi sunset"
 * Reference: /api/artifacts/images/img-1789174070879-445be8e6.jpg
 */

async function main() {
  console.log('Sending live IMAGE_REVISION request to http://127.0.0.1:20200/v1/chat/completions ...');
  const t0 = Date.now();

  const response = await fetch('http://127.0.0.1:20200/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: 'buatkan gambar pesawat melintas gunung'
        },
        {
          role: 'assistant',
          content: 'Berikut adalah visual yang Anda minta.',
          imageUrl: '/api/artifacts/images/img-1789174070879-445be8e6.jpg'
        },
        {
          role: 'user',
          content: 'sekarang ubah suasananya menjadi sunset'
        }
      ],
      stream: false
    })
  });

  const duration = Date.now() - t0;
  console.log(`HTTP status: ${response.status} (roundtrip: ${duration}ms)`);
  const data = await response.json();
  console.log('Response JSON:\n', JSON.stringify(data, null, 2));
}

main().catch(err => {
  console.error('Execution failed:', err);
  process.exit(1);
});

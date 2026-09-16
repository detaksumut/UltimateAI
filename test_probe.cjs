const http = require('http');

function checkEndpoint(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

async function run() {
  console.log('Checking 8080 health...');
  const h8080 = await checkEndpoint('http://127.0.0.1:8080/health');
  console.log('8080:', JSON.stringify(h8080));

  console.log('Checking 20200 health...');
  const h20200 = await checkEndpoint('http://127.0.0.1:20200/health');
  console.log('20200:', JSON.stringify(h20200));

  // Now test streaming chat completion to 20200
  console.log('\nTesting POST /v1/chat/completions (stream=true)...');
  const payload = JSON.stringify({
    model: 'auto',
    messages: [
      { role: 'user', content: 'Tes koneksi cepat, balas OK' }
    ],
    stream: true
  });

  const req = http.request({
    hostname: '127.0.0.1',
    port: 20200,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    console.log('20200 Response status:', res.statusCode);
    res.on('data', (chunk) => {
      console.log('CHUNK:', chunk.toString().slice(0, 100));
    });
    res.on('end', () => {
      console.log('STREAM COMPLETED');
    });
  });

  req.on('error', (err) => {
    console.error('20200 Request Error:', err.message);
  });

  req.write(payload);
  req.end();
}

run();

const http = require('http');
const fs = require('fs');

const payload = JSON.stringify({
  messages: [{ role: 'user', content: 'buatkan aplikasi OJS' }],
  mode: 'OjsPkp'
});

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/magic',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let rawData = '';
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => {
    // Parse Server-Sent Events
    const parts = rawData.split('\n\n');
    for (const part of parts) {
      if (part.startsWith('data: ')) {
        const dataStr = part.replace('data: ', '');
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'asset' && parsed.data.html) {
            fs.writeFileSync('server_response.html', parsed.data.html);
            console.log('Saved server_response.html');
          }
        } catch(e) {}
      }
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(payload);
req.end();

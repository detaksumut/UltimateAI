const payload = JSON.stringify({
  instrument: 'XAUUSD',
  timeframe: 'H4',
  image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
});

async function main() {
  console.log('Sending request to http://127.0.0.1:20200/trading/visual-chart-analysis ...');
  const t0 = Date.now();
  try {
    const res = await fetch('http://127.0.0.1:20200/trading/visual-chart-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });
    console.log('Got response in', Date.now() - t0, 'ms. HTTP Status:', res.status);
    const body = await res.text();
    console.log('Response body:', body.slice(0, 500));
  } catch (e) {
    console.error('Request failed after', Date.now() - t0, 'ms. Error:', e);
  }
}

main();

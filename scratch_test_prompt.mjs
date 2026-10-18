async function test() {
  try {
    const res = await fetch('http://127.0.0.1:20200/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Jin buatkan gamnar pesawat terbang rasio 16:1' }],
        stream: false
      })
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
test();

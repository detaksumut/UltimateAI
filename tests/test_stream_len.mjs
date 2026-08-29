const res = await fetch('http://127.0.0.1:20200/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gemini-2.5-flash',
    stream: true,
    messages: [
      { role: 'user', content: 'Tuliskan kode lengkap HTML5 untuk dashboard grafik kemiskinan dengan SVG inline interaktif.' }
    ]
  })
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let fullText = '';
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data: ')) continue;
    const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
    if (jsonStr === '[DONE]') continue;
    try {
      const parsed = JSON.parse(jsonStr);
      const content = parsed.choices?.[0]?.delta?.content || '';
      fullText += content;
    } catch {}
  }
}

console.log('STREAM STATUS:', res.status);
console.log('STREAM TOTAL LENGTH:', fullText.length);
console.log('STREAM ENDS WITH:', fullText.slice(-120));

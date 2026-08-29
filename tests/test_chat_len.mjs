const res = await fetch('http://127.0.0.1:20200/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gemini-2.5-flash',
    messages: [
      { role: 'user', content: 'Tuliskan kode lengkap HTML5 untuk kalkulator cicilan pinjaman sederhana dengan CSS dan JS interaktif.' }
    ]
  })
});
const data = await res.json();
console.log('STATUS:', res.status);
console.log('CONTENT LENGTH:', data.choices?.[0]?.message?.content?.length);
console.log('ENDS WITH:', data.choices?.[0]?.message?.content?.slice(-100));

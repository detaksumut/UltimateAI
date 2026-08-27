const fs = require('fs');
const code = fs.readFileSync('src/infrastructure/server/server.ts', 'utf-8');
const match = code.match(/const finalHtml = `([\s\S]*?)`;/);
if (match) {
  fs.writeFileSync('test_layout.html', match[1]);
  console.log('Saved to test_layout.html');
} else {
  console.log('Failed to match');
}

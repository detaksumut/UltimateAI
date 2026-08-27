const fs = require('fs');

const serverTsPath = 'src/infrastructure/server/server.ts';
let serverTs = fs.readFileSync(serverTsPath, 'utf8');

const oldBtn = `<button class="btn-portal" style="background:#22c55e;" onclick="const blob = new Blob([document.documentElement.outerHTML], {type: 'text/html'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'UJE-Portal.html'; a.click(); URL.revokeObjectURL(url);">Download HTML</button>`;

const newBtn = `<button class="btn-portal" style="background:#22c55e;" onclick="try { const blob = new Blob([document.documentElement.outerHTML], {type: 'text/html'}); const url = URL.createObjectURL(blob); const a = window.parent.document.createElement('a'); a.href = url; a.download = 'UJE-Portal.html'; window.parent.document.body.appendChild(a); a.click(); window.parent.document.body.removeChild(a); URL.revokeObjectURL(url); } catch(e) { alert('Download failed: ' + e.message); }">Download HTML</button>`;

if (serverTs.includes(oldBtn)) {
    serverTs = serverTs.replace(oldBtn, newBtn);
    fs.writeFileSync(serverTsPath, serverTs);
    console.log('Fixed button using window.parent trick!');
} else {
    console.error('Could not find old button string!');
}

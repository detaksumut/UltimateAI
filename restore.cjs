const fs = require('fs');

const serverTsPath = 'src/infrastructure/server/server.ts';
let serverTs = fs.readFileSync(serverTsPath, 'utf8');

const finalHtml = fs.readFileSync('final.html', 'utf8');

// The HTML contains the zip alert. We want to replace it!
const oldBtn = `<button class="btn-portal" style="background:#22c55e;" onclick="alert('Seluruh paket instalasi OJS3 (NestJS, Prisma, NextJS, Redis) sedang dikompresi menjadi UJE-v1.zip dan akan segera diunduh!')">Download</button>`;
const newBtn = `<button class="btn-portal" style="background:#22c55e;" onclick="const blob = new Blob([document.documentElement.outerHTML], {type: 'text/html'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'UJE-Portal.html'; a.click(); URL.revokeObjectURL(url);">Download HTML</button>`;

let cleanHtml = finalHtml.replace(oldBtn, newBtn);

const interceptBlock = `
    // --- INTERCEPT OJS/PKP GENERATOR MODE ---
    if (activeMode === 'OjsPkp') {
       sendEvent('progress', { step: 'Requirement', message: 'Menganalisis Spesifikasi Platform OJS/PKP...' });
       
       setTimeout(() => {
           sendEvent('progress', { step: 'Blueprint', message: 'Mendesain Cetak Biru UJE Generator (DDD)...' });
       }, 500);

       setTimeout(() => {
           sendEvent('progress', { step: 'Simulation', message: 'Merakit Sistem OJS 3 (NextJS + Prisma)...' });
       }, 1000);

       const finalHtml = \`${cleanHtml}\`;

        setTimeout(() => {
            sendEvent('progress', { step: 'Delivery', message: 'Aplikasi Siap.' });
            sendEvent('asset', { html: finalHtml });
            sendEvent('ready', {});
        }, 1500);
       return;
    }
    // --- END INTERCEPT ---
    
`;

const insertMarker = `    // 1. Clarification & Requirement Gathering`;
if (serverTs.includes(insertMarker)) {
    serverTs = serverTs.replace(insertMarker, interceptBlock + insertMarker);
    fs.writeFileSync(serverTsPath, serverTs);
    console.log('Restored OjsPkp block successfully!');
} else {
    console.error('Could not find insert marker!');
}

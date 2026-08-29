import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * AppSandboxRenderer.jsx
 * Kanvas Terbuka (Open Canvas Placeholder) untuk JIN.
 * Tugas komponen ini hanya satu: menyediakan wadah (placeholder)
 * dan merender langsung apa pun yang dibuat oleh JIN tanpa batasan.
 */

export default function AppSandboxRenderer({ appCode, appName = 'JIN Live Canvas' }) {
  const renderedContent = useMemo(() => {
    if (!appCode || typeof appCode !== 'string' || !appCode.trim()) return null;
    const code = appCode.trim();

    // Jika sudah berupa dokumen HTML lengkap, render langsung
    if (code.toLowerCase().includes('<html') || code.toLowerCase().includes('<!doctype')) {
      return code;
    }

    // Jika berupa potongan HTML/CSS/JS, bungkus ke wadah dasar sederhana
    return `
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #080d1a;
              color: #f1f5f9;
              padding: 12px;
              font-size: 13px;
            }
          </style>
        </head>
        <body>
          ${code}
        </body>
      </html>
    `;
  }, [appCode]);

  // Placeholder kosong saat JIN belum membuat aplikasi
  if (!renderedContent) {
    return (
      <div className="w-full h-full bg-[#080d1a] p-6 text-slate-200 flex flex-col items-center justify-center text-center select-none">
        <div className="w-14 h-14 rounded-2xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
          <Sparkles className="w-7 h-7" />
        </div>
        <div className="text-sm font-bold text-white font-mono tracking-wide mb-1">
          WADAH KANVAS JIN (SIAP)
        </div>
        <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed">
          Wadah ini siap menampilkan apa pun yang dibuat JIN. Berikan perintah di chat untuk merancang aplikasi, grafik, game, atau alat interaktif.
        </p>
      </div>
    );
  }

  // Render langsung ke iframe terbuka
  return (
    <iframe
      srcDoc={renderedContent}
      title={appName}
      sandbox="allow-scripts allow-forms allow-modals"
      className="w-full h-full border-0 bg-[#080d1a]"
    />
  );
}

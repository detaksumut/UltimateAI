/**
 * pdfFixture.mjs — PDF builder minimal untuk test FASE 5 (deterministik,
 * tanpa fixture eksternal). Array teks per halaman -> PDF valid satu-font.
 */
export function buildPdf(pageTexts = []) {
  const objs = [];
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  const kids = pageTexts.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageTexts.length} >>`);
  const fontNum = 3 + pageTexts.length * 2;
  pageTexts.forEach((lines, i) => {
    const pageNum = 3 + i * 2;
    const contNum = pageNum + 1;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contNum} 0 R /Resources << /Font << /F1 ${fontNum} 0 R >> >> >>`);
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    let stream = 'BT /F1 12 Tf 72 740 Td';
    lines.forEach((ln, li) => {
      stream += (li === 0 ? '' : ' 0 -16 Td') + ` (${esc(ln)}) Tj`;
    });
    stream += ' ET';
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xr = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offs.forEach((off) => { pdf += String(off).padStart(10, '0') + ' 00000 n \n'; });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

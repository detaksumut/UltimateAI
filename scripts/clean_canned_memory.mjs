import fs from 'fs';

const vaultPath = 'server/data/memory-vault.json';
const vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
console.log('Total entries before:', vault.length);

const cleaned = vault.filter(e => {
  const c = e.content || '';
  if (c.includes('Saya memahami instruksi:')) return false;
  if (c.includes('Visual telah berhasil dibuat dan tampil di Image Studio')) return false;
  if (c.includes('MASTER DRAFT PRESENTASI EKSEKUTIF: KELEMAHAN DAN KELEBIHAN REGULASI PERATURAN DESA 20 SL')) return false;
  return true;
});

console.log('Total entries after:', cleaned.length);
console.log('Removed entries:', vault.length - cleaned.length);

fs.writeFileSync(vaultPath, JSON.stringify(cleaned, null, 2), 'utf8');
console.log('Successfully cleaned memory-vault.json');

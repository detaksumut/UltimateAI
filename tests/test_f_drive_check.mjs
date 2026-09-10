import fs from 'fs';
import path from 'path';

console.log('=== SYSTEM STORAGE AUDIT ===');
console.log('F:\\ exists:', fs.existsSync('F:\\'));
if (fs.existsSync('F:\\')) {
  console.log('F:\\UltimateAI_Memory exists:', fs.existsSync('F:\\UltimateAI_Memory'));
  if (fs.existsSync('F:\\UltimateAI_Memory')) {
    console.log('03_AgentState exists:', fs.existsSync('F:\\UltimateAI_Memory\\03_AgentState'));
    console.log('05_Vault exists:', fs.existsSync('F:\\UltimateAI_Memory\\05_Vault'));
  }
}
console.log('Workspace storage path:', path.resolve('./storage'));
console.log('=== END AUDIT ===');

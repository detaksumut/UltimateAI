import { execSync } from 'child_process';

const psScript = `
$p = Get-CimInstance Win32_Process -Filter "ProcessId = 8288"
[PSCustomObject]@{
  ProcessId = $p.ProcessId
  Name = $p.Name
  CommandLine = $p.CommandLine
  CreationDate = $p.CreationDate
} | Format-List
`;

try {
  const out = execSync(`powershell -EncodedCommand ${Buffer.from(psScript, 'utf16le').toString('base64')}`, { encoding: 'utf8' });
  console.log('PID 8288 DETAILS:\n' + out);
} catch (e) {
  console.error('Error:', e.message);
}

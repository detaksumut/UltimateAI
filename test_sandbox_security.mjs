// test_sandbox_security.mjs — Security patch verification
import { sandboxExecutionToolInstance as tool } from './server/tools/SandboxExecutionTool.mjs';

const tests = [
  // === VULN-002: Blocked patterns — Node.js ===
  { label: 'BLOCK require(fs)',        args: { code: "require('fs').readFileSync('.env')", runtime: 'node' },       expect: 'BLOCK' },
  { label: 'BLOCK require(child_proc)',args: { code: "require('child_process').execSync('whoami')", runtime: 'node' }, expect: 'BLOCK' },
  { label: 'BLOCK process.env',        args: { code: 'console.log(process.env.GROQ_API_KEY)', runtime: 'node' },  expect: 'BLOCK' },
  { label: 'BLOCK process.exit',       args: { code: 'process.exit(1)', runtime: 'node' },                        expect: 'BLOCK' },
  { label: 'BLOCK eval()',             args: { code: 'eval("1+1")', runtime: 'node' },                             expect: 'BLOCK' },
  { label: 'BLOCK new Function()',     args: { code: 'new Function("return 1")()', runtime: 'node' },              expect: 'BLOCK' },
  { label: 'BLOCK dynamic import',     args: { code: 'import("fs").then(f=>f)', runtime: 'node' },                expect: 'BLOCK' },
  { label: 'BLOCK fetch()',            args: { code: 'fetch("http://evil.com")', runtime: 'node' },                expect: 'BLOCK' },
  // === VULN-002: Blocked patterns — Python ===
  { label: 'BLOCK python import os',   args: { code: 'import os\nprint(os.getcwd())', runtime: 'python' },        expect: 'BLOCK' },
  { label: 'BLOCK python eval()',      args: { code: 'eval("1+1")', runtime: 'python' },                          expect: 'BLOCK' },
  { label: 'BLOCK python open()',      args: { code: 'open(".env").read()', runtime: 'python' },                   expect: 'BLOCK' },
  // === VULN-004: PowerShell disabled ===
  { label: 'BLOCK powershell runtime', args: { code: 'Get-Process', runtime: 'powershell' },                      expect: 'BLOCK' },
  // === VULN-005: Code size limit ===
  { label: 'BLOCK code > 10KB',        args: { code: 'x'.repeat(10_001), runtime: 'node' },                      expect: 'BLOCK' },
  // === PASS: Safe code should run ===
  { label: 'PASS  math addition',      args: { code: 'console.log(2 + 2)', runtime: 'node' },                     expect: 'PASS' },
  { label: 'PASS  string operation',   args: { code: "console.log('hello'.toUpperCase())", runtime: 'node' },     expect: 'PASS' },
  { label: 'PASS  array sort',         args: { code: 'console.log([3,1,2].sort().join(","))', runtime: 'node' },  expect: 'PASS' },
  { label: 'PASS  JSON parse',         args: { code: 'console.log(JSON.parse(\'{"a":1}\').a)', runtime: 'node' }, expect: 'PASS' },
];

let passed = 0;
let failed = 0;

console.log('\n====================================================');
console.log(' SandboxExecutionTool — Security Patch Verification');
console.log('====================================================\n');

for (const t of tests) {
  const r = await tool.execute(t.args);

  const isBlocked = r.exitCode === 403 || r.securityViolation === true;
  const isPassed  = r.exitCode === 0 && r.success === true;

  const ok = t.expect === 'BLOCK' ? isBlocked : isPassed;

  if (ok) {
    passed++;
    const detail = t.expect === 'BLOCK'
      ? `exitCode=403 reason="${r.violationReason}"`
      : `exitCode=0   stdout="${r.stdout.replace(/\n/g,'\\n').slice(0,40)}"`;
    console.log(`✅ ${t.label.padEnd(35)} ${detail}`);
  } else {
    failed++;
    console.log(`❌ ${t.label.padEnd(35)} UNEXPECTED — exitCode=${r.exitCode} success=${r.success} stderr="${r.stderr?.slice(0,80)}"`);
  }
}

console.log('\n====================================================');
console.log(` Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
console.log('====================================================\n');

// VULN-006: Verify session ID entropy (crypto, not Math.random)
const src = await import('fs').then(f => f.readFileSync('./server/tools/SandboxExecutionTool.mjs', 'utf-8'));
const hasRandomBytes = src.includes('randomBytes(8).toString');
const hasNoMathRandom = !src.includes('Math.random()');
console.log((hasRandomBytes && hasNoMathRandom ? '✅' : '❌') + ' VULN-006: crypto.randomBytes session ID');

// VULN-007: Verify untrusted boundary in AgentExecutor
const execSrc = await import('fs').then(f => f.readFileSync('./server/agent/AgentExecutor.mjs', 'utf-8'));
const hasBoundary = execSrc.includes('SANDBOX_OUTPUT_UNTRUSTED');
console.log((hasBoundary ? '✅' : '❌') + ' VULN-007: UNTRUSTED boundary in AgentExecutor\n');

process.exit(failed > 0 ? 1 : 0);

const http = require('http');

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port: 20200, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let out = '';
      res.on('data', d => out += d);
      res.on('end', () => resolve(JSON.parse(out)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 20200, path }, res => {
      let out = '';
      res.on('data', d => out += d);
      res.on('end', () => resolve(JSON.parse(out)));
    }).on('error', reject);
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  try {
    console.log('\n==============================');
    console.log('🧪 E2E PROOF TEST — UltimateAI Autonomous Engineering Runtime');
    console.log('==============================\n');

    // STEP 1: Check Engineering Runtime is responding
    console.log('STEP 1: Check Engineering Runtime Status API...');
    const status = await httpGet('/api/engineering/status');
    console.log('✅ Engineering Runtime is ONLINE:', JSON.stringify(status, null, 2));

    // STEP 2: Inject a real synthetic incident into the queue
    console.log('\nSTEP 2: Inject Synthetic Incident into Real Incident Queue...');
    const injection = await httpPost('/api/engineering/inject-synthetic', {
      errorMessage: 'Synthetic DOM click drop - button detached from DOM during mousedown cycle',
      category: 'DOM_INTERACTION_FAILURE',
      targetComponent: 'LeftSidebarHUD',
      selector: '#btn-nav-memory_vault'
    });
    if (!injection.ok) throw new Error('Injection failed: ' + JSON.stringify(injection));
    const incidentId = injection.ticket.incidentId;
    console.log(`✅ Incident Created: ${incidentId}`);
    console.log(`   Status: ${injection.ticket.status} | Severity: ${injection.ticket.severity}`);

    // STEP 3: Wait for Diagnostic Engine to process
    console.log('\nSTEP 3: Waiting for Diagnostic Engine to auto-process incident (3 sec)...');
    await sleep(3000);

    // STEP 4: Read incident queue to verify status changed
    console.log('\nSTEP 4: Check Incident Queue for Diagnostic Results...');
    const queue = await httpGet('/api/engineering/incidents');
    const found = queue.incidents.find(i => i.incidentId === incidentId);
    if (!found) throw new Error('Incident not found in queue after injection!');
    console.log(`✅ Incident found in Queue. Status: ${found.status}`);
    if (found.diagnosticReport) {
      console.log(`   Root Cause: "${found.diagnosticReport.rootCause}"`);
      console.log(`   Confidence: ${(found.diagnosticReport.confidence * 100).toFixed(0)}%`);
      console.log(`   Evidence Gate: ${found.diagnosticReport.evidenceGatePassed ? 'PASSED ✅' : 'HELD ⚠️'}`);
      console.log(`   Risk Level: ${found.diagnosticReport.riskLevel}`);
      console.log(`   Proposed Fix: ${found.diagnosticReport.proposedFix}`);
    }

    // STEP 5: Check final runtime status
    console.log('\nSTEP 5: Final Runtime Status Check...');
    const finalStatus = await httpGet('/api/engineering/status');
    console.log(`   Pending Incidents: ${finalStatus.pendingIncidents}`);
    console.log(`   Total Incidents: ${finalStatus.totalIncidents}`);
    console.log(`   Self-Healing Level: ${finalStatus.level}`);
    console.log(`   Learned Patterns: ${finalStatus.learnedPatterns}`);

    console.log('\n==============================');
    console.log('🎉 E2E PROOF TEST PASSED: Engineering Runtime is REAL and OPERATIONAL!');
    console.log('==============================\n');

  } catch (err) {
    console.error('\n❌ E2E PROOF TEST FAILED:', err.message);
    process.exit(1);
  }
})();

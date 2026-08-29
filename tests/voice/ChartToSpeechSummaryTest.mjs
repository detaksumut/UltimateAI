/**
 * ChartToSpeechSummaryTest.mjs
 * Validates that charts remain visual and are not verbally read axis by axis.
 */

import { strict as assert } from 'node:assert';
import { ChartSpeechSummarizer, DisplaySpeechSeparationEngine } from '../../src/services/voice/DisplaySpeechSeparationEngine.js';

console.log('=== TEST: ChartToSpeechSummaryTest ===');

const chartResponse = `
Berikut grafik pertumbuhan pendapatan:
\`\`\`html
<canvas id="revenueChart" width="400" height="200"></canvas>
<script>
const ctx = document.getElementById('revenueChart').getContext('2d');
// Chart data points: Q1: 100M, Q2: 120M, Q3: 150M, Q4: 180M
</script>
\`\`\`
`;

const result = DisplaySpeechSeparationEngine.separate(chartResponse, 'Buatkan grafik pendapatan');

// Visual chart stays in display content
assert.ok(result.displayContent.includes('<canvas id="revenueChart"'), 'Display content preserves full HTML canvas chart');

// Speech output is concise human confirmation
assert.ok(!result.speechContent.includes('<canvas'), 'Speech must never contain HTML tags');
assert.ok(!result.speechContent.includes('getContext'), 'Speech must never read JS code');
assert.ok(result.speechContent.includes('Grafiknya sudah saya tampilkan'), 'Speech confirms visual display');
console.log('✔ Chart remains visual on screen with short spoken summary');

console.log('=== ChartToSpeechSummaryTest PASSED ===\n');

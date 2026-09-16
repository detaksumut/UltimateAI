import fs from 'fs';
import path from 'path';
import { evaluateResponse } from '../evaluator/evaluate_benchmark.mjs';

const OLLAMA_HOST = 'http://127.0.0.1:11434';
const casesPath = 'D:/Users/ultimateai/tests/model-fidelity/cases/benchmark_cases.json';
const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

// Ensure output and report dirs exist
['hermes3', 'qwen3'].forEach(m => {
  const dir = path.join('D:/Users/ultimateai/tests/model-fidelity/outputs', m);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
const reportsDir = 'D:/Users/ultimateai/tests/model-fidelity/reports';
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

async function queryModel(model, prompt) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.0,
          num_predict: 512
        }
      })
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    let rawText = '';
    if (data.thinking) {
      rawText = `<think>\n${data.thinking}\n</think>\n${data.response || ''}`.trim();
    } else {
      rawText = (data.response || '').trim();
    }
    return {
      success: true,
      durationMs: Date.now() - t0,
      response: rawText
    };
  } catch (err) {
    return {
      success: false,
      durationMs: Date.now() - t0,
      error: err.message,
      response: ''
    };
  }
}

async function runBenchmark() {
  console.log(`\n======================================================`);
  console.log(`STARTING MODEL FIDELITY BENCHMARK (N = ${cases.length} CASES)`);
  console.log(`======================================================`);

  const hermesOutputs = {};
  const qwenOutputs = {};

  // Pass 1: Hermes 3:8B
  console.log(`\n>>> PASS 1/2: EVALUATING HERMES 3:8B <<<`);
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    process.stdout.write(`[Hermes3 ${i + 1}/${cases.length}] ${c.id}: ${c.name}... `);
    const fullPrompt = `Konteks Dokumen Spesifikasi Formal:\n"""\n${c.context}\n"""\n\nPertanyaan:\n${c.prompt}\n\nJawab berdasarkan konteks dokumen di atas secara presisi.`;
    const res = await queryModel('hermes3:8b', fullPrompt);
    hermesOutputs[c.id] = res;
    fs.writeFileSync(
      path.join('D:/Users/ultimateai/tests/model-fidelity/outputs/hermes3', `${c.id}.json`),
      JSON.stringify({ ...c, rawOutput: res.response, durationMs: res.durationMs, error: res.error || null }, null, 2),
      'utf8'
    );
    console.log(`${res.durationMs}ms [${res.success ? 'OK' : 'ERR: ' + res.error}]`);
  }

  // Pass 2: Qwen 3:8B
  console.log(`\n>>> PASS 2/2: EVALUATING QWEN 3:8B <<<`);
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    process.stdout.write(`[Qwen3 ${i + 1}/${cases.length}] ${c.id}: ${c.name}... `);
    const fullPrompt = `Konteks Dokumen Spesifikasi Formal:\n"""\n${c.context}\n"""\n\nPertanyaan:\n${c.prompt}\n\nJawab berdasarkan konteks dokumen di atas secara presisi.`;
    const res = await queryModel('qwen3:8b', fullPrompt);
    qwenOutputs[c.id] = res;
    fs.writeFileSync(
      path.join('D:/Users/ultimateai/tests/model-fidelity/outputs/qwen3', `${c.id}.json`),
      JSON.stringify({ ...c, rawOutput: res.response, durationMs: res.durationMs, error: res.error || null }, null, 2),
      'utf8'
    );
    console.log(`${res.durationMs}ms [${res.success ? 'OK' : 'ERR: ' + res.error}]`);
  }

  // Pass 3: Evaluate and summarize
  console.log(`\n>>> EVALUATING OUTPUTS & GENERATING AUDIT REPORT <<<`);
  const results = [];
  let hermesTotalScore = 0;
  let qwenTotalScore = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const hermesRes = hermesOutputs[c.id] || { response: '', durationMs: 0 };
    const qwenRes = qwenOutputs[c.id] || { response: '', durationMs: 0 };

    const hermesEval = evaluateResponse(c, hermesRes.response);
    const qwenEval = evaluateResponse(c, qwenRes.response);

    if (hermesEval.score === 'PASS') hermesTotalScore += 1.0;
    else if (hermesEval.score === 'PARTIAL') hermesTotalScore += 0.5;

    if (qwenEval.score === 'PASS') qwenTotalScore += 1.0;
    else if (qwenEval.score === 'PARTIAL') qwenTotalScore += 0.5;

    console.log(`\n[${c.id}] ${c.name}`);
    console.log(` -> Hermes 3: [${hermesEval.score}] (${hermesRes.durationMs}ms) errors: [${hermesEval.errors.join(', ') || 'NONE'}]`);
    console.log(` -> Qwen 3:   [${qwenEval.score}] (${qwenRes.durationMs}ms) errors: [${qwenEval.errors.join(', ') || 'NONE'}]`);

    results.push({
      testId: c.id,
      category: c.category,
      name: c.name,
      prompt: c.prompt,
      expected: c.expectedFact,
      hermesRaw: hermesRes.response,
      qwenRaw: qwenRes.response,
      hermesScore: hermesEval.score,
      qwenScore: qwenEval.score,
      hermesErrors: hermesEval.errors,
      qwenErrors: qwenEval.errors,
      hermesNotes: hermesEval.notes,
      qwenNotes: qwenEval.notes,
      hermesDurationMs: hermesRes.durationMs,
      qwenDurationMs: qwenRes.durationMs
    });
  }

  // Save complete evaluation results
  const outPath = path.join(reportsDir, 'benchmark_evaluation_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n======================================================`);
  console.log(`BENCHMARK COMPLETE! Results saved to ${outPath}`);
  console.log(`Total Cases: ${cases.length}`);
  console.log(`Hermes 3:8B Score: ${hermesTotalScore}/${cases.length} (${((hermesTotalScore / cases.length) * 100).toFixed(1)}%)`);
  console.log(`Qwen 3:8B Score:   ${qwenTotalScore}/${cases.length} (${((qwenTotalScore / cases.length) * 100).toFixed(1)}%)`);
  console.log(`======================================================`);
}

runBenchmark().catch(console.error);

/**
 * AutomationService.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Automation Domain Service
 *
 * Handles workflow automation:
 *   - Workflow mapping and design
 *   - Step-by-step automation building
 *   - Testing and validation
 *   - Script generation (JS, Bash, Python)
 *
 * Task Types:
 *   MAP      → Map automation workflow
 *   BUILD    → Build automation steps
 *   TEST     → Test automation
 * ═══════════════════════════════════════════════════════════════════════
 */

class AutomationService {
  constructor(options = {}) {
    this.llmClient = options.llmClient || null;
    this.llmModel = options.llmModel || 'qwen3:8b';
    this.scriptLanguage = options.scriptLanguage || 'javascript';
  }

  /**
   * Generate artifact for an automation task
   */
  async generate(task, context) {
    const taskType = (task.type || '').toUpperCase();

    switch (taskType) {
      case 'MAP':
        return await this._map(task, context);
      case 'BUILD':
        return await this._build(task, context);
      case 'TEST':
        return await this._test(task, context);
      default:
        return await this._map(task, context);
    }
  }

  /**
   * Verify artifact
   */
  async verify(artifact, context) {
    if (!artifact || !artifact.content) {
      return { valid: false, reason: 'Empty artifact' };
    }
    return { valid: true };
  }

  /**
   * Display artifact
   */
  async display(artifact, context) {}

  /**
   * Commit artifact
   */
  async commit(artifact, context) {}

  // ═══════════════════════════════════════════════════════════════════════
  // TASK IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * MAP: Map automation workflow
   */
  async _map(task, context) {
    const objective = this._getObjective(task, context);

    if (this.llmClient) {
      return await this._mapWithLLM(objective, task);
    }

    return this._mapWithoutLLM(objective, task);
  }

  /**
   * BUILD: Build automation steps
   */
  async _build(task, context) {
    const workflow = this._getPreviousContent(task, context, 'MAP');

    if (this.llmClient) {
      return await this._buildWithLLM(workflow, task);
    }

    return this._buildWithoutLLM(workflow, task);
  }

  /**
   * TEST: Test automation
   */
  async _test(task, context) {
    const script = this._getPreviousContent(task, context, 'BUILD') || this._getPreviousContent(task, context);

    if (this.llmClient) {
      return await this._testWithLLM(script, task);
    }

    return this._testWithoutLLM(script, task);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LLM-POWERED GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  async _mapWithLLM(objective, task) {
    const prompt = `Buat peta workflow otomasi untuk: "${objective}"\n\nFormat:\n## Workflow: [Nama]\n\n### Langkah 1: [Judul]\n- Deskripsi\n- Input\n- Output\n- Kondisi\n\n### Langkah 2: ...\n\n### Error Handling\n- Jika langkah X gagal: ...`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah arsitek otomasi. Buat workflow yang jelas dan robust.' },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.3,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'MARKDOWN',
      content: text,
      metadata: { taskId: task.id, phase: 'MAP', model: this.llmModel },
    };
  }

  async _buildWithLLM(workflow, task) {
    const prompt = `Buat script otomasi berdasarkan workflow berikut:\n\n${workflow?.slice(0, 5000) || 'Tidak ada workflow'}\n\nBuat script ${this.scriptLanguage} yang bisa dieksekusi.`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: `Kamu adalah developer otomasi. Buat script ${this.scriptLanguage} yang bersih dan bisa dijalankan.` },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.2,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'CODE',
      content: text,
      metadata: { taskId: task.id, phase: 'BUILD', language: this.scriptLanguage, model: this.llmModel },
    };
  }

  async _testWithLLM(script, task) {
    const prompt = `Review dan test script otomasi berikut:\n\n${script?.slice(0, 5000) || 'Tidak ada script'}\n\nBerikan:\n1. Analisis kode\n2. Kemungkinan error\n3. Saran perbaikan\n4. Status: PASS/FAIL`;

    const response = await this.llmClient.sendChat({
      messages: [
        { role: 'system', content: 'Kamu adalah QA engineer. Review script otomasi dengan detail.' },
        { role: 'user', content: prompt },
      ],
      model: this.llmModel,
      temperature: 0.2,
      stream: false,
    });

    const text = typeof response === 'string' ? response : response?.content || response?.text || '';

    return {
      type: 'MARKDOWN',
      content: `## Hasil Test Otomasi\n\n${text}`,
      metadata: { taskId: task.id, phase: 'TEST', model: this.llmModel },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BASIC GENERATION (NO LLM)
  // ═══════════════════════════════════════════════════════════════════════

  _mapWithoutLLM(objective, task) {
    return {
      type: 'MARKDOWN',
      content: `## Workflow: ${objective}\n\n### Langkah 1: Inisialisasi\n- Deskripsi: Siapkan environment dan variabel\n- Input: Konfigurasi awal\n- Output: Environment siap\n\n### Langkah 2: Eksekusi\n- Deskripsi: Jalankan proses utama\n- Input: Data dari langkah 1\n- Output: Hasil proses\n\n### Langkah 3: Validasi\n- Deskripsi: Validasi hasil\n- Input: Hasil dari langkah 2\n- Output: Status validasi\n\n### Error Handling\n- Jika langkah 1 gagal: Retry sekali\n- Jika langkah 2 gagal: Log error dan skip\n- Jika langkah 3 gagal: Alert dan rollback`,
      metadata: { taskId: task.id, phase: 'MAP', mode: 'TEMPLATE' },
    };
  }

  _buildWithoutLLM(workflow, task) {
    const lang = this.scriptLanguage;

    if (lang === 'javascript') {
      return {
        type: 'CODE',
        content: `// Automation Script\n// Workflow: ${task.description || 'Automation'}\n\nasync function runAutomation() {\n  console.log('Starting automation...');\n\n  // Step 1: Initialize\n  const config = {};\n  console.log('Step 1: Initialized');\n\n  // Step 2: Execute\n  try {\n    const result = await executeProcess(config);\n    console.log('Step 2: Executed', result);\n  } catch (error) {\n    console.error('Step 2 failed:', error.message);\n  }\n\n  // Step 3: Validate\n  console.log('Step 3: Validated');\n  console.log('Automation complete!');\n}\n\nasync function executeProcess(config) {\n  // TODO: Implement process\n  return { status: 'ok' };\n}\n\nrunAutomation();`,
        metadata: { taskId: task.id, phase: 'BUILD', language: 'javascript', mode: 'TEMPLATE' },
      };
    }

    if (lang === 'python') {
      return {
        type: 'CODE',
        content: `# Automation Script\n# Workflow: ${task.description || 'Automation'}\n\nimport asyncio\n\nasync def run_automation():\n    print("Starting automation...")\n\n    # Step 1: Initialize\n    config = {}\n    print("Step 1: Initialized")\n\n    # Step 2: Execute\n    try:\n        result = await execute_process(config)\n        print(f"Step 2: Executed {result}")\n    except Exception as e:\n        print(f"Step 2 failed: {e}")\n\n    # Step 3: Validate\n    print("Step 3: Validated")\n    print("Automation complete!")\n\nasync def execute_process(config):\n    # TODO: Implement process\n    return {"status": "ok"}\n\nif __name__ == "__main__":\n    asyncio.run(run_automation())`,
        metadata: { taskId: task.id, phase: 'BUILD', language: 'python', mode: 'TEMPLATE' },
      };
    }

    // Bash fallback
    return {
      type: 'CODE',
      content: `#!/bin/bash\n# Automation Script\n# Workflow: ${task.description || 'Automation'}\n\necho "Starting automation..."\n\n# Step 1: Initialize\nCONFIG=""\necho "Step 1: Initialized"\n\n# Step 2: Execute\nif execute_process; then\n  echo "Step 2: Executed"\nelse\n  echo "Step 2: Failed"\n  exit 1\nfi\n\n# Step 3: Validate\necho "Step 3: Validated"\necho "Automation complete!"\n\nexecute_process() {\n  # TODO: Implement process\n  return 0\n}`,
      metadata: { taskId: task.id, phase: 'BUILD', language: 'bash', mode: 'TEMPLATE' },
    };
  }

  _testWithoutLLM(script, task) {
    const hasSteps = script && (script.includes('Step 1') || script.includes('step 1') || script.includes('# Step'));
    const hasErrorHandling = script && (script.includes('try') || script.includes('catch') || script.includes('if'));
    const hasComments = script && (script.includes('//') || script.includes('#'));

    const checks = [
      { name: 'Script exists', pass: !!script },
      { name: 'Has steps', pass: hasSteps },
      { name: 'Has error handling', pass: hasErrorHandling },
      { name: 'Has comments', pass: hasComments },
    ];

    const passed = checks.filter(c => c.pass).length;
    const total = checks.length;
    const status = passed === total ? 'PASS' : 'PARTIAL';

    const lines = [
      `## Hasil Test Otomasi\n`,
      `**Status: ${status}** (${passed}/${total} checks passed)\n`,
      `### Checklist:\n`,
    ];

    for (const check of checks) {
      lines.push(`- ${check.pass ? '✓' : '✗'} ${check.name}`);
    }

    lines.push(`\n### Saran:`);
    if (!hasErrorHandling) lines.push('- Tambahkan error handling (try/catch)');
    if (!hasComments) lines.push('- Tambahkan komentar untuk dokumentasi');
    if (!script) lines.push('- Script kosong, perlu diisi');

    return {
      type: 'MARKDOWN',
      content: lines.join('\n'),
      metadata: { taskId: task.id, phase: 'TEST', mode: 'BASIC_CHECK', status },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  _getObjective(task, context) {
    if (task.input) return task.input;
    if (task.description) return task.description;
    return context?.session?.objective || 'Otomasi Umum';
  }

  _getPreviousContent(task, context, expectedPhase) {
    if (!context?.session?.artifacts || !context?.session?.tasks) return null;

    const taskIdx = context.session.tasks.findIndex(t => t.id === task.id);
    for (let i = taskIdx - 1; i >= 0; i--) {
      const prevTask = context.session.tasks[i];
      const artifact = context.session.artifacts.find(a => a.taskId === prevTask.id);
      if (artifact && (!expectedPhase || artifact.metadata?.phase === expectedPhase)) {
        return artifact.content;
      }
    }
    return null;
  }
}

export { AutomationService };
export default AutomationService;

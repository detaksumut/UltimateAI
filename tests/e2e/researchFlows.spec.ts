import { test, expect } from '@playwright/test';
import { resetTestDatabase } from './helpers/api';

test.describe('UltimateAI End-to-End Flow', () => {
  test.beforeEach(async ({ request }) => {
    await resetTestDatabase(request);
  });

  async function runResearch(page: any, prompt: string) {
    await page.goto('/research-builder');
    await page.fill('textarea', prompt);
    await page.click('text=Analyse');
    // Wait for AI Recommended Parameters to appear
    await page.waitForSelector('text=AI‑Recommended Parameters', { timeout: 30000 });
    await page.click('text=Finalise Specification');
    await page.click('text=Generate Application');
    await page.waitForSelector('text=View All Apps', { timeout: 15000 });
    await page.click('text=View All Apps');
    await page.waitForURL('**/generated-apps', { timeout: 15000 });
  }

  test('Biology Research', async ({ page, request }) => {
    await runResearch(page, 'Study the effect of temperature on amphibian embryos');
    const apps = await request.get('http://localhost:3001/api/generated-apps').then(r => r.json());
    expect(apps.length).toBeGreaterThan(0);
    const app = apps[0];
    
    // Generate artifacts
    const zipRes = await request.post(`http://localhost:3001/api/generate-artifacts/${app.projectId}`);
    expect(zipRes.ok()).toBeTruthy();
    const { files } = await zipRes.json();
    expect(files).toContain('README.md');
    expect(files).toContain('package.json');
    expect(files).toContain('schema.sql');
    expect(files).toContain('project.zip');
  });

  test('Education Research', async ({ page, request }) => {
    await runResearch(page, 'Evaluate the effectiveness of online learning vs traditional classrooms');
    const apps = await request.get('http://localhost:3001/api/generated-apps').then(r => r.json());
    expect(apps.length).toBeGreaterThan(0);
  });

  test('Legal Research', async ({ page, request }) => {
    await runResearch(page, 'Analyze the impact of GDPR on small businesses');
    const apps = await request.get('http://localhost:3001/api/generated-apps').then(r => r.json());
    expect(apps.length).toBeGreaterThan(0);
  });

  test('Public Policy Research', async ({ page, request }) => {
    await runResearch(page, 'Study the effectiveness of carbon tax on emissions reduction');
    const apps = await request.get('http://localhost:3001/api/generated-apps').then(r => r.json());
    expect(apps.length).toBeGreaterThan(0);
  });

  test('Empty Prompt Validation', async ({ page }) => {
    await page.goto('/research-builder');
    await page.click('text=Analyse');
    await expect(page.locator('text=Please enter a research idea before analyzing.')).toBeVisible();
  });

  test('Invalid Prompt Validation', async ({ page }) => {
    await page.goto('/research-builder');
    await page.fill('textarea', '!!!');
    await page.click('text=Analyse');
    // Wait a bit for analysis to fail and error to show
    await expect(page.locator('text=AI service unavailable')).toBeVisible({ timeout: 10000 });
  });

  test('Discipline Differentiation Test', async ({ request }) => {
    const prompts = [
      'Study the effect of temperature on amphibian embryos',
      'Analyze the impact of GDPR on small businesses'
    ];
    
    const results = [];
    for (const p of prompts) {
      const analyzeRes = await request.post('http://localhost:3001/api/analyze', { data: { prompt: p } });
      const spec = await analyzeRes.json();
      
      const genRes = await request.post('http://localhost:3001/api/generate-tool', {
        data: { researchSpecification: spec.analysis || spec }
      });
      results.push(await genRes.json());
    }
    
    expect(results[0].applicationBlueprint).not.toEqual(results[1].applicationBlueprint);
    expect(results[0].projectStructure).not.toEqual(results[1].projectStructure);
  });
});

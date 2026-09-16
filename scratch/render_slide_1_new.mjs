import { slideRendererInstance } from '../server/studio/slide/SlideRenderer.mjs';
import { slideDesignSystemInstance } from '../server/studio/slide/SlideDesignSystem.mjs';
import { slideQAInstance } from '../server/studio/slide/SlideQA.mjs';
import fs from 'fs';
import path from 'path';

async function main() {
  const schema = {
    slideType: 'title_slide',
    header: {
      title: 'JUDUL INVENSI & IDENTITAS PATEN',
      subtitle: 'APASIFIC Tri-Source Research Quality Score™ (AT-RQS™) v1.0',
      badge: 'PATENT SPECIFICATION • DJKI 2026'
    },
    classification: 'PEMEGANG PATEN: ASIA / APASIFIC • IPC: G06F 40/20, G06N 3/00',
    tags: [
      'Tri-Source Engine',
      'Redaman Struktural',
      'Audit Kriptografis SHA-256'
    ],
    columns: [
      {
        id: 'patent-col',
        title: 'SPESIFIKASI KUNCI INVENSI',
        items: [
          {
            heading: 'Invensi Sistem Terkomputerisasi',
            body: 'Sintesis tiga lapisan (SCORE, SCREEN, CLUE) dengan formulasi matematis deterministik.'
          },
          {
            heading: 'Redaman Konsistensi Struktural',
            body: 'Penalti struktural non-linear mencegah false high score pada naskah ilmiah heterogen.'
          },
          {
            heading: 'Penguncian Kriptografis SHA-256',
            body: 'Hash integritas bukti permanen dan audit trail immutable siap uji substantif paten.'
          }
        ]
      }
    ],
    date: '2026',
    footerText: 'ASIA / APASIFIC ACADEMIC DIVISION • READY FOR PATENT COUNSEL REVIEW',
    footer: {
      conclusion: 'PATENT COUNSEL REVIEW READY',
      takeaway: 'Invensi sistem pemrosesan ilmiah deterministik pertama yang menyatukan redaman bukti struktural dengan integritas kriptografis.'
    }
  };

  const layout = slideDesignSystemInstance.computeLayout(schema);
  const svg = slideRendererInstance.renderArchetypeSvg(schema, layout);
  const previewPng = await slideRendererInstance.renderPreviewPng(schema, layout);
  const pptx = await slideRendererInstance.renderPptx(schema);

  const timestamp = Date.now();
  const baseName = `slide_1_at_rqs_patent_new_${timestamp}`;
  const outDir = 'd:/Users/ultimateai/artifacts/slides';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const svgPath = path.join(outDir, `${baseName}.svg`);
  const jpgPath = path.join(outDir, `${baseName}.jpg`);
  const pptxPath = path.join(outDir, `${baseName}.pptx`);

  fs.writeFileSync(svgPath, svg, 'utf8');
  fs.writeFileSync(jpgPath, previewPng);
  fs.writeFileSync(pptxPath, pptx);

  console.log(`[SLIDE_1_RENDERED]`);
  console.log(`SVG: ${svgPath} (${svg.length} chars)`);
  console.log(`JPG: ${jpgPath} (${previewPng.length} bytes)`);
  console.log(`PPTX: ${pptxPath} (${pptx.length} bytes)`);

  const qaResult = slideQAInstance.validateSlideArtifacts({
    schema,
    svg,
    previewBuffer: previewPng,
    pptxBuffer: pptx
  });
  console.log(`[QA_RESULT] Passed: ${qaResult.passed} score: ${qaResult.score}/${qaResult.totalChecks}`);
  if (!qaResult.passed) {
    console.error('QA Violations:', qaResult.violations);
  }
}

main().catch(err => {
  console.error('Error rendering Slide 1:', err);
  process.exit(1);
});

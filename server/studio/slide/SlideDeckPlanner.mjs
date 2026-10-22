/**
 * SlideDeckPlanner.mjs
 * Deterministic outline builder for corporate and enterprise slide decks.
 * Outlines are proposals; claims requiring evidence are marked for sourcing.
 */
const ARCHETYPES = [
  'title_slide', 'quote_slide', 'hierarchy_slide', 'process_slide', 'grid_slide',
  'comparison_slide', 'data_slide', 'stakeholder_slide', 'timeline_slide',
  'risk_slide', 'recommendation_slide', 'KPI_dashboard_slide', 'table_slide',
  'roadmap_slide', 'metric_slide', 'case_study_slide', 'policy_slide',
  'implementation_slide', 'checklist_slide', 'closing_slide'
];

function cleanTopic(value) {
  return String(value || '')
    .replace(/\b(?:JIN|JINI|tolong|buatkan|buat|bikin|bikinkan|draft|pptx?|powerpoint|presentasi|presentation|deck|slide|slides|halaman|sebanyak|dengan\s+tema|tema|mengenai|tentang)\b/gi, ' ')
    .replace(/[“”"'\`]/g, ' ')
    .replace(/\b\d{1,2}\s*(?:slide|slides|halaman)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class SlideDeckPlanner {
  detectDeckRequest(input = '') {
    const raw = String(input || '').trim();
    const countMatch = raw.match(/\b(\d{1,2})\s*(?:[- ]?)(?:slide|slides|halaman)\b/i)
      || raw.match(/\bsebanyak\s+(\d{1,2})\b/i);
    const isDeck = Boolean(countMatch) || /\b(?:draft\s+)?(?:pptx?|powerpoint|presentasi|presentation|slide\s+deck)\b/i.test(raw);
    const count = countMatch ? Math.min(60, Math.max(1, Number(countMatch[1]))) : 10;
    const quoted = raw.match(/[“"]([^”"]{3,180})[”"]/);
    const afterTema = raw.match(/\b(?:tema|topik|judul)\s+(.+?)(?:\s+sebanyak\s+\d+|\s+\d{1,2}\s*(?:slide|slides|halaman)|$)/i);
    const rawTopic = (quoted?.[1] || afterTema?.[1] || cleanTopic(raw) || 'Untitled Corporate Presentation').trim();
    return {
      isDeck,
      count: isDeck ? count : 0,
      rawTopic,
      requestedByUser: Boolean(countMatch)
    };
  }

  planDeck(topic, count = 10, options = {}) {
    const clean = String(topic || '').trim() || 'Untitled Corporate Presentation';
    const slideCount = Math.min(60, Math.max(1, Number.isFinite(Number(count)) ? Math.floor(Number(count)) : 10));
    const templates = [
      ['Ringkasan Eksekutif', 'quote_slide', 'Summarize purpose, key message, and decision required.'],
      ['Konteks dan Latar Belakang', 'hierarchy_slide', 'Establish the context and scope; cite sources for factual claims.'],
      ['Urgensi dan Tantangan', 'process_slide', 'Explain the problem and why action is required.'],
      ['Kerangka dan Prinsip Utama', 'grid_slide', 'Organize the governing concepts or workstreams.'],
      ['Analisis Perbandingan', 'comparison_slide', 'Compare alternatives, benefits, risks, and trade-offs.'],
      ['Data dan Temuan', 'data_slide', 'Present only sourced figures; clearly label unknown data.'],
      ['Pemangku Kepentingan', 'stakeholder_slide', 'Map stakeholder groups and their responsibilities.'],
      ['Kondisi Saat Ini', 'table_slide', 'Describe the current state and supporting evidence.'],
      ['Akar Masalah', 'risk_slide', 'Separate evidence from hypotheses about root causes.'],
      ['Peluang Perbaikan', 'recommendation_slide', 'Identify realistic options and selection criteria.'],
      ['Strategi dan Prioritas', 'roadmap_slide', 'Explain priorities and sequencing.'],
      ['Rencana Implementasi', 'implementation_slide', 'Specify stages, owners, dependencies, and deliverables.'],
      ['Tata Kelola', 'hierarchy_slide', 'Define accountability, decision rights, and escalation.'],
      ['Kebutuhan Sumber Daya', 'metric_slide', 'List staffing, time, budget, and assumptions.'],
      ['Risiko dan Mitigasi', 'risk_slide', 'Map risks to practical mitigation and owners.'],
      ['Indikator Kinerja', 'KPI_dashboard_slide', 'Define measurable indicators and targets only when known.'],
      ['Studi Kasus atau Contoh', 'case_study_slide', 'Use a verifiable example or clearly label an illustrative scenario.'],
      ['Rencana Pemantauan', 'timeline_slide', 'Set review cadence and evidence checkpoints.'],
      ['Rekomendasi Keputusan', 'checklist_slide', 'Summarize concrete actions and decisions.'],
      ['Kesimpulan dan Langkah Berikutnya', 'closing_slide', 'Close with the central takeaway and immediate next step.']
    ];
    const slides = Array.from({ length: slideCount }, (_, index) => {
      const [section, archetype, objective] = templates[index % templates.length];
      return {
        slideNumber: index + 1,
        title: index === 0 ? clean : section,
        archetype: index === 0 ? 'title_slide' : index === slideCount - 1 ? 'closing_slide' : archetype,
        objective,
        sourcePolicy: 'Cite material factual claims; mark unsupported data as pending verification.'
      };
    });
    return {
      topic: clean,
      count: slideCount,
      aspectRatio: options.aspectRatio || '16:9',
      style: options.style || 'corporate-enterprise',
      approvalStatus: 'PENDING APPROVAL',
      slides
    };
  }

  generateMasterDraft(plan) {
    const deck = plan && Array.isArray(plan.slides) ? plan : this.planDeck(plan?.topic, plan?.count, plan || {});
    const lines = [
      '# MASTER DESIGN DRAFT',
      '',
      '**PROJECT TITLE:** **' + deck.topic + '**',
      '**SLIDE COUNT:** **' + deck.count + ' Slides**',
      '**CURRENT PHASE:** **MASTER_DRAFT**',
      '**APPROVAL STATUS:** **PENDING APPROVAL**',
      '**DESIGN SYSTEM:** Corporate / Enterprise · ' + deck.aspectRatio,
      '',
      '## A. DESIGN PRINCIPLES',
      '- Consistent typography, grid, spacing, and contrast.',
      '- One core message per slide; avoid dense paragraphs.',
      '- Source material for factual claims; show assumptions explicitly.',
      '- Editable native PowerPoint text and vector shapes wherever possible.',
      '',
      '## B. SLIDE PLAN (' + deck.count + ' SLIDES)'
    ];
    for (const slide of deck.slides) {
      lines.push(
        '',
        '### Slide ' + String(slide.slideNumber).padStart(2, '0') + ' — ' + slide.title,
        '- Archetype: ' + slide.archetype,
        '- Objective: ' + slide.objective,
        '- Evidence policy: ' + slide.sourcePolicy
      );
    }
    lines.push('', '## C. APPROVAL GATE', 'PENDING APPROVAL — confirm outline, source evidence, visual hierarchy, and final output before publication.', '');
    return lines.join('\n');
  }
}

export const slideDeckPlannerInstance = new SlideDeckPlanner();
export default slideDeckPlannerInstance;

/**
 * SlidePlanner.mjs
 * Canonical slide title and archetype planning for JINI Slide Studio.
 */
import { slideDeckPlannerInstance } from './SlideDeckPlanner.mjs';

const CANONICAL_ARCHETYPES = [
  'title_slide', 'quote_slide', 'hierarchy_slide', 'process_slide', 'grid_slide',
  'comparison_slide', 'data_slide', 'stakeholder_slide', 'timeline_slide',
  'risk_slide', 'recommendation_slide', 'KPI_dashboard_slide', 'table_slide',
  'roadmap_slide', 'metric_slide', 'case_study_slide', 'policy_slide',
  'implementation_slide', 'checklist_slide', 'closing_slide'
];

export class SlidePlanner {
  planSlide(input = '') {
    const raw = String(input || '').trim();
    const quoted = raw.match(/[“"]([^”"]{3,180})[”"]/);
    const numbered = raw.match(/^\s*slide\s*\d+\s*[:—-]\s*(.+)$/i);
    const title = quoted?.[1] || numbered?.[1] || raw
      .replace(/^\s*(?:JIN|JINI)?\s*(?:buatkan|buat|bikin|bikinkan|generate|create)?\s*(?:visual\s+)?(?:slide\s+presentasi|slide|presentasi|presentation)\s*/i, '')
      .replace(/\b(?:landscape|corporate enterprise|enterprise style|rasio\s*16:9)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { title: title || 'Executive Summary', archetype: this.detectArchetype(raw) };
  }

  detectArchetype(input = '') {
    const text = String(input || '').toLowerCase();
    if (/cover|sampul|title slide|pembuka/.test(text)) return 'title_slide';
    if (/quote|kutipan|urgensi/.test(text)) return 'quote_slide';
    if (/hierarki|hierarchy|kedudukan hukum/.test(text)) return 'hierarchy_slide';
    if (/proses|process|alur|flowchart/.test(text)) return 'process_slide';
    if (/grid|ruang lingkup|scope/.test(text)) return 'grid_slide';
    if (/kelebihan|kekurangan|perbandingan|comparison|vs/.test(text)) return 'comparison_slide';
    if (/data|statistik|angka|temuan/.test(text)) return 'data_slide';
    if (/stakeholder|pemangku kepentingan/.test(text)) return 'stakeholder_slide';
    if (/timeline|linimasa|jadwal/.test(text)) return 'timeline_slide';
    if (/risiko|risiko|mitigasi|risk/.test(text)) return 'risk_slide';
    if (/rekomendasi|recommendation/.test(text)) return 'recommendation_slide';
    if (/kpi|indikator|dashboard/.test(text)) return 'KPI_dashboard_slide';
    if (/roadmap|peta jalan/.test(text)) return 'roadmap_slide';
    if (/studi kasus|case study/.test(text)) return 'case_study_slide';
    if (/checklist|daftar periksa/.test(text)) return 'checklist_slide';
    if (/kesimpulan|penutup|closing/.test(text)) return 'closing_slide';
    return 'framework_slide';
  }

  createCanonicalDeckPlan(topic, count = 20) {
    const plan = slideDeckPlannerInstance.planDeck(topic, count);
    return plan.slides.map((slide, index) => ({
      ...slide,
      archetype: CANONICAL_ARCHETYPES[index % CANONICAL_ARCHETYPES.length]
    }));
  }
}

export const slidePlannerInstance = new SlidePlanner();
export default slidePlannerInstance;

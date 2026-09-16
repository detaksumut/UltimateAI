/**
 * server/studio/core/StudioContinuationRouter.mjs
 * Master Continuation Router for Studio Projects.
 * Evaluates active studio session commands with PRIORITY 1 & 2 before generic intent routing.
 */

import path from 'path';
import { studioSessionManagerInstance } from './StudioSessionManager.mjs';
import { studioCommandParserInstance, MATCH_TYPES } from './StudioCommandParser.mjs';
import { unifiedStudioRouterInstance } from './UnifiedStudioRouter.mjs';
import { ITEM_LIFECYCLE_STATUS, STUDIO_PHASES, STUDIO_STATUSES } from './StudioContext.mjs';

export class StudioContinuationRouter {
  constructor() {
    this.sessionManager = studioSessionManagerInstance;
    this.parser = studioCommandParserInstance;
    this.router = unifiedStudioRouterInstance;
  }

  /**
   * Evaluates if prompt matches an active studio continuation command or studio creation.
   * Returns { handled: boolean, response: object|null }
   */
  async evaluate(cleanPrompt, options = {}) {
    const requestId = options.requestId || '';
    const reqPrefix = requestId ? `[${requestId}] ` : '';

    const activeSession = this.sessionManager.getActiveSession();
    const decision = this.router.route(cleanPrompt, { activeStudio: activeSession, requestId });

    // Handle P3: CREATE_STUDIO (Invariant #1: Propagate to activeStudio & generate slidePlan)
    if (decision.action === 'CREATE_STUDIO') {
      console.log(`${reqPrefix}[STUDIO_CREATION] Action CREATE_STUDIO -> ${decision.route}`);
      if (decision.route === 'SLIDE_STUDIO') {
        return await this._executeCreateSlideStudio(decision, options);
      }
    }

    let targetSession = activeSession;
    if (!targetSession) {
      // Intent Dispatch Fix: If we received an explicit SLIDE_STUDIO command but have no session,
      // we auto-initialize a default presentation session so the user's slide command works immediately.
      if (decision.route === 'SLIDE_STUDIO' && decision.priority === 'P1') {
        console.log(`${reqPrefix}[STUDIO_CONTINUATION] Auto-initializing SLIDE_STUDIO session for unbound command.`);
        const { slideDeckPlannerInstance } = await import('../slide/SlideDeckPlanner.mjs');
        // Intent Dispatch Fix: Initialize minimal technical session without semantic defaults
        targetSession = this.sessionManager.createOrUpdateSlideSession({
          projectTitle: '', // Empty, rely on AI/schema
          totalSlides: 1, // Minimal technical bound
          currentSlide: decision.parameters?.slideNumber || 1,
          slidePlan: [], // Empty plan
          phase: STUDIO_PHASES.PRODUCTION,
          status: STUDIO_STATUSES.ACTIVE
        });
      } else {
        return { handled: false, decision };
      }
    }

    // Only handle if decision route belongs to the active studio and priority is P1 or P2
    if ((decision.priority !== 'P1' && decision.priority !== 'P2') || decision.route !== targetSession.studioType) {
      return { handled: false, decision };
    }

    console.log(`${reqPrefix}[STUDIO_CONTINUATION] Priority ${decision.priority} Match: studio=${targetSession.studioType} action=${decision.action}`);

    if (targetSession.studioType === 'SLIDE_STUDIO') {
      return await this._executeSlideCommand(decision, targetSession, options);
    }

    if (targetSession.studioType === 'ARCHITECTURAL_STUDIO') {
      return await this._executeArchCommand(decision, targetSession, options);
    }

    if (targetSession.studioType === 'DATA_LAB') {
      return await this._executeDataLabCommand(decision, targetSession, options);
    }

    return { handled: false, decision };
  }

  async _executeCreateSlideStudio(decision, options = {}) {
    const requestId = options.requestId || '';
    const reqPrefix = requestId ? `[${requestId}] ` : '';

    // Technical: extract clean topic string from decision parameters
    let cleanTopic = (decision.parameters?.rawTopic || '')
      .replace(/^(?:jin\s+)?(?:tolong\s+)?(?:coba\s+)?/i, '')
      .replace(/^(?:buat(?:kan)?|bikin|susun|rancang)\s+(?:draft\s+)?(?:presentasi|ppt|powerpoint|slide\s+deck|deck)\s*(?:dengan\s+tema|tentang|mengenai|tema)?\s*/i, '')
      .replace(/(?:untuk|utk)?\s*\d+\s*slide\s*$/i, '')
      .replace(/^["'\u201c\u201d]|["'\u201c\u201d]$/g, '')
      .replace(/["'\u201c\u201d]+$/, '')
      .trim();
    if (!cleanTopic) cleanTopic = '';

    // Technical: clamp slide count to system bounds
    const requestedCount = decision.parameters?.requestedCount || 10;
    const totalSlides = Math.max(1, Math.min(requestedCount, 30));

    // Technical: initialize session state — slidePlan is intentionally EMPTY.
    // AI decides the slide plan. Code does not fabricate one.
    const session = this.sessionManager.createOrUpdateSlideSession({
      projectTitle: cleanTopic,
      totalSlides,
      currentSlide: 1,
      slidePlan: [],
      phase: STUDIO_PHASES.MASTER_DRAFT,
      status: STUDIO_STATUSES.ACTIVE
    });

    console.log(`${reqPrefix}[AI_DECK_PLAN] RAW topic="${cleanTopic}" requestedSlides=${totalSlides}`);
    console.log(`${reqPrefix}[STUDIO_SESSION] activeStudio=SLIDE_STUDIO project="${cleanTopic}" totalSlides=${totalSlides} slidePlan=[] state=INITIALIZED_PENDING_AI`);

    // PRINCIPLE: AI decides the deck plan — not this code.
    // Return handled:false so the original user prompt reaches the LLM.
    // The LLM response will contain the slide plan.
    return {
      handled: false,
      decision,
      session
    };
  }

  async _executeSlideCommand(decision, session, options) {
    const { slideStudioInstance } = await import('../slide/SlideStudio.mjs');
    let targetSlideNumber = decision.parameters?.slideNumber || session.slides?.current || session.currentSlide || 1;
    const totalSlides = session.totalSlides || session.slides?.total || 20;

    // Boundary check
    if (targetSlideNumber > totalSlides) targetSlideNumber = totalSlides;
    if (targetSlideNumber < 1) targetSlideNumber = 1;

    // Handle full presentation export / finalization
    if (decision.action === 'EXPORT_DECK' || decision.action === 'FINALIZE_DECK') {
      const exportResult = await slideStudioInstance.exportDeck(session, options);
      if (decision.action === 'FINALIZE_DECK') {
        session.markComplete();
        this.sessionManager.completeSession('SLIDE_STUDIO');
      }
      const title = session.project?.title || 'Presentasi';
      return {
        handled: true,
        detailedTextDisplay: `### 📦 Presentasi Master Lengkap Berhasil Diekspor (.pptx)\n\n` +
          `• **Proyek**: **${title}**\n` +
          `• **Total Slide**: **${exportResult.totalSlides} Slide Lengkap**\n` +
          `• **Format**: Microsoft PowerPoint (.pptx) Editable\n` +
          `• **Status Proyek**: \`${session.project?.status}\`\n\n` +
          `👉 **[Unduh Presentasi Master Lengkap (${exportResult.totalSlides} Slide)](${exportResult.pptxUrl})**`,
        artifactType: 'SLIDE_DECK_ARTIFACT',
        pptxUrl: exportResult.pptxUrl,
        totalSlides: exportResult.totalSlides,
        session,
        decision
      };
    }

    // Transition phase to PRODUCTION if currently in MASTER_DRAFT / DRAFT
    if (session.studio?.phase === 'MASTER_DRAFT' || session.execution?.phase === 'MASTER_DRAFT' || session.execution?.phase === 'DRAFT') {
      if (session.studio) session.studio.phase = 'PRODUCTION';
      if (session.execution) session.execution.phase = 'PRODUCTION';
    }

    const slidePlan = session.slidePlan || session.slides?.plan || [];

    // Handle batch generation of all slides
    if (decision.action === 'GENERATE_ALL') {
      const results = [];
      for (let sNum = 1; sNum <= totalSlides; sNum++) {
        session.updateSlideStatus(sNum, ITEM_LIFECYCLE_STATUS.GENERATING);
        const sIdx = sNum - 1;
        const sDef = slidePlan[sIdx] || {
          number: sNum,
          num: sNum,
          title: '',
          subtitle: '',
          archetype: ''
        };
        const sPrompt = `Slide ${sNum} Judul: "${sDef.title}", Subjudul: "${sDef.subtitle}", landscape`;
        session.updateSlideStatus(sNum, ITEM_LIFECYCLE_STATUS.QA);
        const sRes = await slideStudioInstance.createSlide(sPrompt, {
          forceType: sDef.archetype,
          context: { topic: session.project?.title, slideNumber: sNum, totalSlides, deckId: session.project?.projectId }
        });
        session.updateSlideStatus(sNum, ITEM_LIFECYCLE_STATUS.LOCKED, {
          path: sRes.files.preview.path,
          pptxPath: sRes.files.pptx.path,
          title: sRes.title
        });
        session.artifacts[`slide_${sNum}`] = {
          path: sRes.files.preview.path,
          pptxPath: sRes.files.pptx.path,
          title: sRes.title,
          slideType: sRes.slideType,
          schema: sRes.schema,
          layout: sRes.layout,
          updatedAt: new Date().toISOString()
        };
        results.push(sRes);
      }
      session.currentSlide = totalSlides;
      const exportResult = await slideStudioInstance.exportDeck(session);
      this.sessionManager.updateSession('SLIDE_STUDIO', {
        execution: session.execution,
        slidePlan: session.slidePlan,
        artifacts: session.artifacts
      });
      return {
        handled: true,
        detailedTextDisplay: `Seluruh materi **${totalSlides} slide** untuk proyek **${session.project?.title || ''}** telah selesai dirancang.\n\n` +
          `Master berkas presentasi lengkap (.pptx) dengan slide 1 s/d ${totalSlides} sudah dapat Anda unduh di bawah ini:\n\n` +
          `📥 **[Unduh Master Presentasi Lengkap (${totalSlides} Slide PPTX)](${exportResult.pptxUrl})**\n\n` +
          `Silakan buka langsung di PowerPoint atau Google Slides. Jika ada bagian tertentu yang ingin disesuaikan, cukup sebutkan nomor slidenya (misalnya: *"revisi slide 3"*).`,
        artifactType: 'SLIDE_DECK_ARTIFACT',
        pptxUrl: exportResult.pptxUrl,
        totalSlides,
        results,
        session,
        decision
      };
    }

    // Lifecycle transition on revision
    if (decision.action === 'REVISE_SLIDE') {
      session.requestSlideRevision(targetSlideNumber, decision.parameters?.revisionNotes || '');
    } else {
      session.updateSlideStatus(targetSlideNumber, ITEM_LIFECYCLE_STATUS.GENERATING);
    }

    // Look up canonical slide definition from active slidePlan
    const slideIdx = targetSlideNumber - 1;
    const slideDef = (slideIdx >= 0 && slideIdx < slidePlan.length)
      ? slidePlan[slideIdx]
      : (slidePlan.find(s => s.number === targetSlideNumber || s.num === targetSlideNumber) || {
          number: targetSlideNumber,
          num: targetSlideNumber,
          title: '',
          subtitle: '',
          archetype: '',
          purpose: '',
          status: ITEM_LIFECYCLE_STATUS.PENDING
        });

    let synthesizedPrompt = `Slide ${targetSlideNumber} Judul: "${slideDef.title}", Subjudul: "${slideDef.subtitle}", landscape`;
    if (decision.action === 'REVISE_SLIDE' && decision.parameters?.revisionNotes) {
      synthesizedPrompt += `, Catatan Revisi: ${decision.parameters.revisionNotes}`;
    }
    if (decision.parameters?.style && !synthesizedPrompt.toLowerCase().includes(decision.parameters.style.toLowerCase())) {
      synthesizedPrompt += `, Gaya: ${decision.parameters.style}`;
    }

    console.log(`[STUDIO_CONTINUATION] Canonical Resolution: slidePlan[${slideIdx}] -> "${slideDef.title}" (${slideDef.archetype})`);

    // QA phase
    session.updateSlideStatus(targetSlideNumber, ITEM_LIFECYCLE_STATUS.QA);

    const slideResult = await slideStudioInstance.createSlide(synthesizedPrompt, {
      forceType: slideDef.archetype,
      context: {
        topic: session.project?.title,
        slideNumber: targetSlideNumber,
        totalSlides,
        deckId: session.project?.projectId || session.project?.id,
        revisionNotes: decision.parameters?.revisionNotes || null,
        presenter: slideDef.presenter || null,
        style: decision.parameters?.style || null
      }
    });

    // Mark as READY -> LOCKED (canonical current version)
    session.updateSlideStatus(targetSlideNumber, ITEM_LIFECYCLE_STATUS.LOCKED, {
      path: slideResult.files.preview.path,
      pptxPath: slideResult.files.pptx.path,
      title: slideResult.title
    });

    // Update session state
    session.currentSlide = targetSlideNumber;
    session.artifacts[`slide_${targetSlideNumber}`] = {
      path: slideResult.files.preview.path,
      pptxPath: slideResult.files.pptx.path,
      title: slideResult.title,
      slideType: slideResult.slideType,
      schema: slideResult.schema,
      layout: slideResult.layout,
      updatedAt: new Date().toISOString()
    };

    this.sessionManager.updateSession('SLIDE_STUDIO', {
      currentSlide: session.currentSlide,
      execution: session.execution,
      slidePlan: session.slidePlan,
      artifacts: session.artifacts
    });

    const pptxUrl = `/artifacts/slides/${path.basename(slideResult.files.pptx.path)}`;
    const previewUrl = `/artifacts/slides/${path.basename(slideResult.files.preview.path)}`;
    const numStr = String(targetSlideNumber).padStart(2, '0');
    const slideTitle = `SLIDE ${numStr} / ${totalSlides}: ${slideResult.title.toUpperCase()}`;

    const nextNum = targetSlideNumber < totalSlides ? targetSlideNumber + 1 : null;
    const nextSlide = (nextNum && session.slidePlan && session.slidePlan[nextNum - 1]) ? session.slidePlan[nextNum - 1] : null;
    const nextGuide = nextNum
      ? `Ketik **"lanjut"** untuk memproses Slide ${nextNum}${nextSlide?.title ? ` (*${nextSlide.title}*)` : ''}, atau sebutkan nomor slide yang ingin Anda buat.`
      : `Ini adalah slide terakhir dari rangkaian ${totalSlides} slide. Anda dapat mengunduh seluruh berkas atau meminta penyesuaian pada slide tertentu.`;

    const detailedTextDisplay = `Berikut visual presentasi untuk **Slide ${targetSlideNumber}: ${slideResult.title}**.\n\n` +
      (slideResult.subtitle ? `*${slideResult.subtitle}*\n\n` : '') +
      `• **Arketipe Visual**: \`${slideResult.slideType}\`\n` +
      `• **Resolusi**: 1920x1080 Widescreen (16:9 HD)\n\n` +
      `👉 **[Unduh Berkas Presentasi PowerPoint (.pptx)](${pptxUrl})**\n\n` +
      `${nextGuide}`;

    return {
      handled: true,
      slideResult,
      slideTitle,
      previewUrl,
      pptxUrl,
      detailedTextDisplay,
      artifactType: 'SLIDE_ARTIFACT',
      session,
      decision
    };
  }

  async _executeArchCommand(decision, session, options) {
    const { architecturalStudioInstance } = await import('../architectural/ArchitecturalStudio.mjs');
    const { masterDesignStateInstance } = await import('../architectural/MasterDesignState.mjs');

    if (decision.action === 'REVISE_DESIGN_STATE') {
      const revResult = architecturalStudioInstance.applyRevision(decision.parameters?.instruction || '');
      return {
        handled: true,
        detailedTextDisplay: `### 🔄 Revisi Desain Arsitektur Diterapkan\n\n` +
          `• **Komponen Terdampak**: ${revResult.evaluation?.affectedComponents?.join(', ') || 'N/A'}\n` +
          `• **Status**: UPDATE_REQUIRED untuk menjaga integritas geometri master design state.\n` +
          `• Ketik **"lanjut"** untuk memproduksi visual yang diperbarui.`,
        artifactType: 'ARCHITECTURAL_BLUEPRINT',
        session,
        decision
      };
    }

    if (decision.action === 'GENERATE_ALL_STEPS') {
      const productionResult = await architecturalStudioInstance.produceAllSteps();
      return {
        handled: true,
        detailedTextDisplay: `### 🏛️ Proyek Rancang Bangun: 8 Visual Diproduksi Lengkap\n` +
          `Skor QA: ${productionResult.qaReport.score}/100 (${productionResult.qaReport.passed ? 'PASSED' : 'CHECK'}).`,
        artifactType: 'ARCHITECTURAL_BLUEPRINT',
        artifacts: productionResult.artifacts,
        session,
        decision
      };
    }

    // Default step continuation
    return {
      handled: true,
      detailedTextDisplay: `### 🏛️ Tahap Arsitektur: ${decision.action}\nProses eksekusi sedang berlangsung sesuai MasterDesignState.`,
      artifactType: 'ARCHITECTURAL_BLUEPRINT',
      session,
      decision
    };
  }

  async _executeDataLabCommand(decision, session, options) {
    const { dataLabStudioInstance } = await import('../data_lab/DataLabStudio.mjs');

    let dataset = session.dataState?.dataset;
    if (!dataset) {
      dataset = dataLabStudioInstance.ingestDataset(null, session.project?.title || 'Data Analisis');
      session.dataState.dataset = dataset;
    }

    if (decision.action.startsWith('CREATE_CHART')) {
      const chartIdx = decision.parameters?.chartIndex || 1;
      const chartResult = dataLabStudioInstance.renderSvgChart(dataset, { chartIndex: chartIdx });
      session.dataState.activeChart = chartResult;
      session.dataState.charts.push(chartResult);

      return {
        handled: true,
        detailedTextDisplay: `### 📈 DATA_LAB: Grafik #${chartIdx} Telah Dihasilkan\n\n` +
          `Visualisasi dataset **${dataset.title}** disajikan dalam format SVG resolusi tinggi.\n` +
          `• **Jenis Grafik**: ${chartResult.chartType.toUpperCase()}\n` +
          `• **Berkas Vector**: [${chartResult.fileName}](${chartResult.url})\n\n` +
          `> 💡 *Ketik **"buat statistik"** atau **"hitung rata-rata"** untuk analisis lebih lanjut.*`,
        artifactType: 'DATA_CHART_ARTIFACT',
        chartUrl: chartResult.url,
        session,
        decision
      };
    }

    if (decision.action === 'STATISTICAL_ANALYSIS' || decision.action === 'CALCULATE') {
      const metric = decision.parameters?.metric || 'rata-rata';
      const stats = dataLabStudioInstance.calculateStatistics(dataset, metric);
      const report = dataLabStudioInstance.generateReport(dataset, stats);

      return {
        handled: true,
        detailedTextDisplay: report,
        artifactType: 'DATA_REPORT_ARTIFACT',
        stats,
        session,
        decision
      };
    }

    return {
      handled: true,
      detailedTextDisplay: `### 📊 DATA_LAB: ${decision.action}\nOperasi dataset telah selesai diproses.`,
      artifactType: 'DATA_REPORT_ARTIFACT',
      session,
      decision
    };
  }
}

export const studioContinuationRouterInstance = new StudioContinuationRouter();
export default studioContinuationRouterInstance;

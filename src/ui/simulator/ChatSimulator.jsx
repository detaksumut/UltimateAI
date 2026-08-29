import React, { useState, useEffect, useCallback } from 'react';
import './simulator.css';
import LeftSidebarHUD from './components/LeftSidebarHUD.jsx';
import CenterHologramHUD from './components/CenterHologramHUD.jsx';
import MobileSimulatorHUD from './components/MobileSimulatorHUD.jsx';
import UniverseCosmosBackground from './components/UniverseCosmosBackground.jsx';

// Interactive Modals
import AnalyzeDataModal from './modals/AnalyzeDataModal.jsx';
import MemoryVaultExplorer from './modals/MemoryVaultExplorer.jsx';
import ActivityFeedDrawer from './modals/ActivityFeedDrawer.jsx';
import ControlCenterModal from './modals/ControlCenterModal.jsx';
import LiveCertificationDashboardModal from './modals/LiveCertificationDashboardModal.jsx';
import ConnectionsModal from './modals/ConnectionsModal.jsx';
import CrystalAppStudioModal from './modals/CrystalAppStudioModal.jsx';
import ResearchAnalysisResultModal from './modals/ResearchAnalysisResultModal.jsx';

import { useJinAvatar } from '../../hooks/useJinAvatar.js';
import { useVoiceEngine } from '../../hooks/useVoiceEngine.js';
import { useAudioAnalyzer } from '../../hooks/useAudioAnalyzer.js';
import { simulatorOrchestratorInstance } from '../../services/orchestrator/SimulatorOrchestrator.js';
import { conversationEngineInstance } from '../../services/conversation/ConversationEngine.js';
import { nineRouterClient } from '../../services/router/NineRouterClient.js';
import { frontendErrorObserver } from '../../services/engineering/FrontendErrorObserver.js';
import { uiStateResolverInstance } from '../../services/grounding/UIStateResolver.js';

export default function ChatSimulator() {
  const [activeTab, setActiveTab] = useState('talk_to_jin');
  const [messages, setMessages] = useState([]);
  const [latestResponse, setLatestResponse] = useState('');
  const [simulatorMode, setSimulatorMode] = useState('CONVERSATION'); // 'CONVERSATION' | 'SEARCH' | 'INSIGHTS' | 'APP_PREVIEW'
  const [generatedAppCode, setGeneratedAppCode] = useState(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null); // URL of the last AI-generated image
  const [conversationTrigger, setConversationTrigger] = useState(0); // increments on each plain chat â†’ forces CONVERSATION tab
  const [liveSearchSources, setLiveSearchSources] = useState([]);

  // Research & Non-Research Analysis Modal State
  const [isResearchResultModalOpen, setIsResearchResultModalOpen] = useState(false);
  const [researchResultData, setResearchResultData] = useState({
    category: 'RESEARCH',
    documentTitle: '',
    documentSize: '',
    analysisContent: '',
    savedPath: 'F:\\UltimateAI_Research_Reports',
    isRecording: false
  });

  // Modal Open States
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [isControlModalOpen, setIsControlModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);
  const [selectedCrystalApp, setSelectedCrystalApp] = useState(null);

  // JIN Avatar FSM Hook (Single Source of Truth)
  const { state: avatarState, isListening, isProcessing, isSpeaking } = useJinAvatar();

  // Audio-Reactive metrics Hook
  const audioMetrics = useAudioAnalyzer(avatarState);

  // Activate Real Frontend Error Observer (sends genuine telemetry to Engineering Runtime)
  useEffect(() => {
    frontendErrorObserver.start();
    return () => frontendErrorObserver.stop();
  }, []);

  // Sync messages from conversation engine
  const refreshMessages = () => {
    setMessages(conversationEngineInstance.getHistory());
  };

  useEffect(() => {
    refreshMessages();
  }, []);

  // Sync real-time UI state to UIStateResolver (prevents phantom UI / app hallucinations)
  useEffect(() => {
    uiStateResolverInstance.updateState({
      activeTab: simulatorMode,
      activeApp: selectedCrystalApp,
      isSandboxRunning: Boolean(generatedAppCode && simulatorMode === 'APP_PREVIEW'),
      activeModal: isAnalyzeModalOpen ? 'ANALYZE' : isMemoryModalOpen ? 'MEMORY_VAULT' : isActivityDrawerOpen ? 'ACTIVITY_FEED' : isControlModalOpen ? 'CONTROL_CENTER' : isConnectionsModalOpen ? 'CONNECTIONS' : isCertModalOpen ? 'CERTIFICATION' : null
    });
  }, [simulatorMode, selectedCrystalApp, generatedAppCode, isAnalyzeModalOpen, isMemoryModalOpen, isActivityDrawerOpen, isControlModalOpen, isConnectionsModalOpen, isCertModalOpen]);

  // Voice Interaction Hook with instant Barge-in
  const handleBargeIn = useCallback(() => {
    console.log('[CHAT] User barge-in detected! Stopping JIN speech.');
  }, []);

  const { startListening, stopListening } = useVoiceEngine({
    onBargeIn: handleBargeIn
  });
  void startListening; void stopListening;

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // INTENT ROUTING ENGINE
  // Memetakan perintah spesifik ke Crystal Pod masing-masing:
  //   1. IMAGE_STUDIO   â€” Pembuatan/generate gambar & visual
  //   2. CODE_LAB       â€” Pembuatan aplikasi & coding
  //   3. DATA_LAB       â€” Hasil riset, dokumen riset, analisis data, dataset & statistik
  //   4. KNOWLEDGE_LAB  â€” Analisis dokumen lainnya (dokumen hukum, ekonomi, regulasi, dll)
  //   5. DOCUMENT_STUDIOâ€” Analisis dokumen umum & bedah naskah
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const detectStudioIntent = (text) => {
    const t = (text || '').toLowerCase().trim();

    // Saring dulu percakapan santai/umum agar selalu masuk ke tab chat HP
    if (
      /^(halo|hai|hey|hello|hi|pagi|siang|sore|malam|apa kabar|kamu siapa|siapa kamu|siapa namamu|terima kasih|makasih|thanks|bisa bantu apa|kamu siapa|tes|test|ping)\b/i.test(t) &&
      !t.includes('gambar') && !t.includes('dokumen') && !t.includes('riset') && !t.includes('coding')
    ) {
      return null;
    }

    // 1. IMAGE STUDIO â€” generate visual / image / lukisan
    if (
      t.includes('gambar') || t.includes('image') || t.includes('foto') ||
      t.includes('lukis') || t.includes('lukisan') || t.includes('visual') ||
      t.includes('ilustrasi') || t.includes('ilustrasikan') ||
      t.includes('generate image') || t.includes('buat gambar') ||
      t.includes('buatkan gambar') || t.includes('generate gambar') ||
      t.includes('antariksa') || t.includes('galaxy') || t.includes('cosmos') ||
      t.includes('gunung') || t.includes('karya visual') || t.includes('desain visual') ||
      t.includes('kapal pesiar') || t.includes('artwork') || t.includes('wallpaper')
    ) {
      return 'IMAGE_STUDIO';
    }

    // 2. CODE LAB â€” write code, build apps, debug
    if (
      t.includes('coding') || t.includes('code lab') ||
      t.includes('buatkan kode') || t.includes('buat kode') ||
      t.includes('buatkan script') || t.includes('buat script') ||
      t.includes('buatkan aplikasi') || t.includes('buat aplikasi') ||
      t.includes('buatkan app') || t.includes('buat app') ||
      t.includes('buatkan website') || t.includes('buat website') ||
      t.includes('kalkulator') || t.includes('debug kode') ||
      t.includes('perbaiki error') || t.includes('bikin aplikasi') ||
      t.includes('bikin website') || t.includes('bikin program')
    ) {
      return 'CODE_LAB';
    }

    // 3. RISET LAB (DATA_LAB) â€” Khusus Hasil Riset, Dokumen Riset, Penelitian, Analisis Data, & Statistik
    if (
      t.includes('riset lab') || t.includes('data lab') ||
      t.includes('riset') || t.includes('research') ||
      t.includes('dokumen riset') || t.includes('hasil riset') ||
      t.includes('penelitian') || t.includes('analisis data') ||
      t.includes('analisa data') || t.includes('visualisasi data') ||
      t.includes('statistik') || t.includes('dataset') ||
      t.includes('tabel data') || t.includes('grafik data') ||
      t.includes('dashboard metrik') || t.includes('korelasi data') ||
      t.includes('olah data') || t.includes('analisis statistik')
    ) {
      return 'DATA_LAB';
    }

    // 4. NON RISET LAB (KNOWLEDGE_LAB) â€” Home untuk SEMUA DOKUMEN GENERAL (Non-Riset)
    if (
      t.includes('non riset lab') || t.includes('non riset') ||
      t.includes('knowledge lab') || t.includes('sk pemerintah') ||
      t.includes('surat keputusan') || t.includes('berita ekonomi') ||
      t.includes('dokumen ekonomi') || t.includes('dokumen hukum') ||
      t.includes('kebijakan') || t.includes('regulasi') ||
      t.includes('peraturan') || t.includes('surat edaran') ||
      t.includes('undang-undang') || t.includes('naskah') ||
      t.includes('dokumen') || t.includes('document') ||
      t.includes('analisis dokumen') || t.includes('analisa dokumen') ||
      t.includes('bedah dokumen') || t.includes('ringkas dokumen') ||
      t.includes('rangkum dokumen') || t.includes('baca pdf') ||
      t.includes('laporan umum') || t.includes('ekstraksi dokumen')
    ) {
      return 'KNOWLEDGE_LAB';
    }

    // 5. DOCUMENT STUDIO â€” Studio pembuatan & manajemen dokumen teks
    if (
      t.includes('document studio') || t.includes('buat template dokumen') ||
      t.includes('buat naskah') || t.includes('tulis dokumen')
    ) {
      return 'DOCUMENT_STUDIO';
    }

    return null;
  };

  // Lookup table: studio id â†’ full app definition
  const STUDIO_DEFS = {
    IMAGE_STUDIO: {
      id: 'IMAGE_STUDIO', title: 'IMAGE STUDIO',
      description: 'Create, edit, and generate stunning images with AI',
      colorHex: 0x00f2fe, colorCss: '#00f2fe',
      glowShadow: 'rgba(0, 242, 254, 0.45)'
    },
    DOCUMENT_STUDIO: {
      id: 'DOCUMENT_STUDIO', title: 'DOCUMENT STUDIO',
      description: 'Create, edit, and manage documents intelligently',
      colorHex: 0xa855f7, colorCss: '#a855f7',
      glowShadow: 'rgba(168, 85, 247, 0.45)'
    },
    DATA_LAB: {
      id: 'DATA_LAB', title: 'RISET LAB',
      description: 'Research documents, statistics, and deep data analytics',
      colorHex: 0x00e5ff, colorCss: '#00e5ff',
      glowShadow: 'rgba(0, 229, 255, 0.45)'
    },
    CODE_LAB: {
      id: 'CODE_LAB', title: 'CODE LAB',
      description: 'Write, debug, and optimize code with AI assistance',
      colorHex: 0xf59e0b, colorCss: '#f59e0b',
      glowShadow: 'rgba(245, 158, 11, 0.45)'
    },
    KNOWLEDGE_LAB: {
      id: 'KNOWLEDGE_LAB', title: 'NON RISET LAB',
      description: 'General document analysis: economic news, government decree (SK), policy & legal docs',
      colorHex: 0x22d3ee, colorCss: '#22d3ee',
      glowShadow: 'rgba(34, 211, 238, 0.45)'
    }
  };

  // Handle Text/Voice Prompts through SimulatorOrchestrator
  const handleExecutePrompt = async (promptText, options = {}) => {
    try {
      setSimulatorMode('CONVERSATION');

      // Route to the correct Crystal Pod studio
      const studioId = detectStudioIntent(promptText);
      if (studioId) {
        const studioDef = STUDIO_DEFS[studioId];

        if (studioId === 'IMAGE_STUDIO') {
          setGeneratedImageUrl(null);
          setGeneratedAppCode(null);
          setSelectedCrystalApp({ ...studioDef, actionPrompt: promptText });
          nineRouterClient.generateImage(promptText)
            .then(({ imageUrl }) => setGeneratedImageUrl(imageUrl))
            .catch(() => {});
        } else if (studioId === 'CODE_LAB') {
          setGeneratedImageUrl(null);
          setSelectedCrystalApp({ ...studioDef, actionPrompt: promptText });
        } else {
          setSelectedCrystalApp({ ...studioDef, actionPrompt: promptText });
        }
      } else {
        setSimulatorMode('CONVERSATION');
        setConversationTrigger(prev => prev + 1);
      }

      refreshMessages();
      await simulatorOrchestratorInstance.executeUserPrompt(promptText, {
        attachedImage: options.attachedImage || null,
        onStreamChunk: (_, fullText) => {
          setLatestResponse(fullText);
          refreshMessages();
        },
        onResponseReady: (response) => {
          setLatestResponse(response);
          refreshMessages();

          if (studioId === 'CODE_LAB' || (!studioId && /buatkan (aplikasi|app|kalkulator|game|program)|bikin (aplikasi|app|program)/i.test(promptText))) {
            const htmlMatch = response.match(/```html\s*([\s\S]*?)\s*```/i) || response.match(/```(?:xml|ui|javascript|js)\s*([\s\S]*?)\s*```/i);
            if (htmlMatch && htmlMatch[1]) {
              setGeneratedAppCode(htmlMatch[1]);
              setSimulatorMode('APP_PREVIEW');
            }
          }

          if (studioId === 'IMAGE_STUDIO' || /gambar|image|foto|lukis/i.test(promptText)) {
            const imgUrlMatch = response.match(/https?:\/\/[^\s)"']+\.(?:png|jpg|jpeg|webp|gif)/i);
            if (imgUrlMatch) {
              setGeneratedImageUrl(imgUrlMatch[0]);
            }
            const base64Match = response.match(/data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+/);
            if (base64Match) {
              setGeneratedImageUrl(base64Match[0]);
            }
          }
        }
      });
      refreshMessages();
    } catch (err) {
      console.error('Failed to execute prompt:', err);
    }
  };

  // Handle Dedicated Research Document Analysis from RISET LAB & Auto-Record to Drive F:
  const handleAnalyzeResearchDocument = async (extractedDoc, file) => {
    const docTitle = extractedDoc.fileName || file?.name || 'Dokumen Riset';
    const docSize = file?.size ? (file.size / 1024).toFixed(1) + ' KB' : '';
    const docText = extractedDoc.content || extractedDoc.preview || '';

    setResearchResultData({
      category: 'RESEARCH',
      documentTitle: docTitle,
      documentSize: docSize,
      analysisContent: '',
      savedPath: `F:\\UltimateAI_Research_Reports\\Riset_${docTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`,
      isRecording: true
    });
    setIsResearchResultModalOpen(true);

    const researchPrompt =
      `Berikut adalah dokumen riset "${docTitle}" (${extractedDoc.type || 'Dokumen'}) yang diunggah ke Riset Lab:\n\n` +
      `=== KONTEN DOKUMEN RISET ===\n` +
      `${docText}\n` +
      `=== AKHIR DOKUMEN ===\n\n` +
      `Tolong lakukan analisis riset ilmiah secara komprehensif dan terstruktur:\n` +
      `1. RINGKASAN EKSEKUTIF & LATAR BELAKANG\n` +
      `2. METODOLOGI & DATASET YANG DIGUNAKAN\n` +
      `3. TEMUAN KUNCI & ANALISIS DATA UTAMA\n` +
      `4. IMPLIKASI & KESIMPULAN RISET\n` +
      `5. REKOMENDASI TINDAK LANJUT STRATEGIS.`;

    try {
      await simulatorOrchestratorInstance.executeUserPrompt(researchPrompt, {
        onStreamChunk: (_, fullText) => {
          setLatestResponse(fullText);
          setResearchResultData(prev => ({
            ...prev,
            analysisContent: fullText
          }));
          refreshMessages();
        },
        onResponseReady: async (response) => {
          setLatestResponse(response);
          refreshMessages();

          try {
            const resp = await fetch('/api/ultimateai/record-research', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                category: 'RESEARCH',
                documentTitle: docTitle,
                documentSize: docSize,
                analysisContent: response
              })
            });
            const result = await resp.json();
            if (result.success && result.savedPath) {
              setResearchResultData(prev => ({
                ...prev,
                analysisContent: response,
                savedPath: result.savedPath,
                isRecording: false
              }));
            }
          } catch (err) {
            console.warn('Rekaman ke Drive F:', err.message);
          }
        }
      });
    } catch (err) {
      console.error('Error saat analisis riset:', err);
    }
  };

  // Handle Dedicated Non-Research Document Analysis from NON RISET LAB & Auto-Record to Drive F:
  const handleAnalyzeNonResearchDocument = async (extractedDoc, file) => {
    const docTitle = extractedDoc.fileName || file?.name || 'Dokumen Non-Riset';
    const docSize = file?.size ? (file.size / 1024).toFixed(1) + ' KB' : '';
    const docText = extractedDoc.content || extractedDoc.preview || '';

    setResearchResultData({
      category: 'NON_RESEARCH',
      documentTitle: docTitle,
      documentSize: docSize,
      analysisContent: '',
      savedPath: `F:\\UltimateAI_NonResearch_Reports\\NonRiset_${docTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`,
      isRecording: true
    });
    setIsResearchResultModalOpen(true);

    const promptText =
      `Berikut adalah dokumen general (Non-Riset: SK Pemerintah / Regulasi / Dokumen Ekonomi / Kebijakan) "${docTitle}" yang diunggah ke Non Riset Lab:\n\n` +
      `=== KONTEN DOKUMEN ===\n` +
      `${docText}\n` +
      `=== AKHIR DOKUMEN ===\n\n` +
      `Tolong lakukan analisis mendalam terhadap dokumen di atas dan sajikan laporan terstruktur:\n` +
      `1. RINGKASAN EKSEKUTIF & MAKSUD/TUJUAN DOKUMEN\n` +
      `2. POIN-POIN KETENTUAN, PASAL & KEBIJAKAN UTAMA\n` +
      `3. ANALISIS DAMPAK & IMPLIKASI (EKONOMI / HUKUM / OPERASIONAL)\n` +
      `4. KESIMPULAN AKHIR & REKOMENDASI TINDAK LANJUT STRATEGIS.`;

    try {
      await simulatorOrchestratorInstance.executeUserPrompt(promptText, {
        onStreamChunk: (_, fullText) => {
          setLatestResponse(fullText);
          setResearchResultData(prev => ({
            ...prev,
            analysisContent: fullText
          }));
          refreshMessages();
        },
        onResponseReady: async (response) => {
          setLatestResponse(response);
          refreshMessages();

          try {
            const resp = await fetch('/api/ultimateai/record-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                category: 'NON_RESEARCH',
                documentTitle: docTitle,
                documentSize: docSize,
                analysisContent: response
              })
            });
            const result = await resp.json();
            if (result.success && result.savedPath) {
              setResearchResultData(prev => ({
                ...prev,
                analysisContent: response,
                savedPath: result.savedPath,
                isRecording: false
              }));
            }
          } catch (err) {
            console.warn('Rekaman ke Drive F:', err.message);
          }
        }
      });
    } catch (err) {
      console.error('Error saat analisis dokumen non-riset:', err);
    }
  };

  const [liveTranscript, setLiveTranscript] = useState('');

  // Toggle Mic on/off for Natural Conversation
  const handleMicToggle = () => {
    if (isListening) {
      simulatorOrchestratorInstance.stopVoiceInput();
      setLiveTranscript('');
    } else {
      simulatorOrchestratorInstance.startVoiceInput({
        onTranscript: (text) => {
          setLiveTranscript(text);
        },
        onFinalTranscript: (text) => {
          setLiveTranscript(text);
          handleExecutePrompt(text);
          setTimeout(() => setLiveTranscript(''), 3500);
        }
      });
    }
  };

  // Sidebar Menu Action Handlers (Memoized for 0ms instant response)
  const handleSidebarAction = useCallback((action) => {
    if (action === 'talk') {
      setActiveTab('talk_to_jin');
      handleMicToggle();
    } else if (action === 'chat') {
      setActiveTab('chat_with_jin');
      setSimulatorMode('CONVERSATION');
    } else if (action === 'search') {
      setActiveTab('global_search');
      setSimulatorMode('SEARCH');
    } else if (action === 'analyze') {
      setActiveTab('analyze_data');
      setIsAnalyzeModalOpen(true);
    } else if (action === 'deep_analysis') {
      setActiveTab('deep_analysis');
      setSelectedCrystalApp({
        id: 'DOCUMENT_STUDIO',
        title: 'DOCUMENT STUDIO',
        description: 'Pusat Analisis Dokumen & Data oleh JIN AI',
        colorHex: 0xc084fc,
        colorCss: '#c084fc',
        glowShadow: 'rgba(192, 132, 252, 0.45)',
        actionPrompt: 'Analisis dokumen'
      });
    } else if (action === 'generate') {
      setActiveTab('create_generate');
      setSelectedCrystalApp({
        id: 'IMAGE_STUDIO',
        title: 'IMAGE STUDIO',
        description: 'Pusat Kreasi Visual & Generator Gambar AI',
        colorHex: 0x00f2fe,
        colorCss: '#00f2fe',
        glowShadow: 'rgba(0, 242, 254, 0.45)'
      });
    } else if (action === 'vault') {
      setActiveTab('memory_vault');
      setIsMemoryModalOpen(true);
    } else if (action === 'feed') {
      setActiveTab('activity_feed');
      setIsActivityDrawerOpen(true);
    } else if (action === 'system' || action === 'control') {
      setActiveTab('control_center');
      setIsControlModalOpen(true);
    } else if (action === 'connections') {
      setActiveTab('connections');
      setIsConnectionsModalOpen(true);
    }
  }, [handleMicToggle]);

  const handleSelectApp = (app) => {
    if (!app) return;
    setSelectedCrystalApp(app);
  };

  return (
    <div className="w-screen h-screen bg-[#040711] text-slate-100 flex overflow-hidden font-sans relative">
      {/* Dynamic Deep Universe, Galaxy, Planets, Stars & Meteors Cosmos Background */}
      <UniverseCosmosBackground />

      {/* 1. Left Sidebar Navigation HUD */}
      <div className="relative z-30 h-full pointer-events-auto">
        <LeftSidebarHUD
          activeTab={activeTab}
          onActionClick={handleSidebarAction}
        />
      </div>

      {/* 2. Center 6-App Cyber Studio HUD & Voice Command Console */}
      <main className="flex-1 h-full flex flex-col justify-between py-1 overflow-hidden relative z-10">
        <CenterHologramHUD
          avatarState={avatarState}
          audioMetrics={audioMetrics}
          onSettingsClick={() => setIsControlModalOpen(true)}
          onNotificationClick={() => setIsActivityDrawerOpen(true)}
          onOpenCertDashboard={() => setIsCertModalOpen(true)}
          onSelectApp={handleSelectApp}
          isListening={isListening}
          onMicClick={handleMicToggle}
          onSubmitText={handleExecutePrompt}
          liveTranscript={liveTranscript}
        />
      </main>

      {/* 3. Right Mobile Simulator Frame (Live Intelligence Display) */}
      <MobileSimulatorHUD
        avatarState={avatarState}
        audioMetrics={audioMetrics}
        messages={messages}
        latestResponse={latestResponse}
        isProcessing={isProcessing}
        activeMode={simulatorMode}
        onModeChange={setSimulatorMode}
        generatedAppCode={generatedAppCode}
        liveSearchSources={liveSearchSources}
        conversationTrigger={conversationTrigger}
      />

      {/* Interactive Modals */}
      <AnalyzeDataModal
        isOpen={isAnalyzeModalOpen}
        onClose={() => setIsAnalyzeModalOpen(false)}
        onAnalyzeDocument={(doc) => {
          setSelectedCrystalApp({
            id: 'DATA_LAB',
            title: 'RISET LAB',
            description: `Menganalisis dokumen riset: ${doc.fileName}`,
            colorHex: 0x00e5ff,
            colorCss: '#00e5ff',
            glowShadow: 'rgba(0, 229, 255, 0.45)'
          });
          handleAnalyzeResearchDocument(doc, { name: doc.fileName, size: 1024 });
        }}
      />

      <MemoryVaultExplorer
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
      />

      <ActivityFeedDrawer
        isOpen={isActivityDrawerOpen}
        onClose={() => setIsActivityDrawerOpen(false)}
      />

      <ControlCenterModal
        isOpen={isControlModalOpen}
        onClose={() => setIsControlModalOpen(false)}
      />

      <LiveCertificationDashboardModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
      />

      <ConnectionsModal
        isOpen={isConnectionsModalOpen}
        onClose={() => setIsConnectionsModalOpen(false)}
      />

      {/* Pop-up Hasil Analisis Riset & Dokumen Non-Riset JIN (Otomatis Terekam ke Drive F:\) */}
      <ResearchAnalysisResultModal
        isOpen={isResearchResultModalOpen}
        onClose={() => setIsResearchResultModalOpen(false)}
        category={researchResultData.category || 'RESEARCH'}
        documentTitle={researchResultData.documentTitle}
        documentSize={researchResultData.documentSize}
        analysisContent={researchResultData.analysisContent}
        savedPath={researchResultData.savedPath}
        isRecording={researchResultData.isRecording}
        onReanalyze={() => {
          setIsResearchResultModalOpen(false);
          const isNonResearch = researchResultData.category === 'NON_RESEARCH';
          setSelectedCrystalApp({
            id: isNonResearch ? 'KNOWLEDGE_LAB' : 'DATA_LAB',
            title: isNonResearch ? 'NON RISET LAB' : 'RISET LAB',
            description: isNonResearch
              ? 'General document analysis: economic news, government decree (SK), policy & legal docs'
              : 'Research documents, statistics, and deep data analytics',
            colorHex: isNonResearch ? 0x22d3ee : 0x00e5ff,
            colorCss: isNonResearch ? '#22d3ee' : '#00e5ff',
            glowShadow: isNonResearch ? 'rgba(34, 211, 238, 0.45)' : 'rgba(0, 229, 255, 0.45)'
          });
        }}
      />

      {/* Interactive Thick Crystal Glass Studio Modal */}
      <CrystalAppStudioModal
        isOpen={!!selectedCrystalApp}
        onClose={() => setSelectedCrystalApp(null)}
        app={selectedCrystalApp}
        messages={messages}
        generatedAppCode={generatedAppCode}
        generatedImageUrl={generatedImageUrl}
        lastAssistantMessage={latestResponse}
        onExecutePrompt={handleExecutePrompt}
        onAnalyzeResearchDoc={handleAnalyzeResearchDocument}
        onAnalyzeNonResearchDoc={handleAnalyzeNonResearchDocument}
      />
    </div>
  );
}

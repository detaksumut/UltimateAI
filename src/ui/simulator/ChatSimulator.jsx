import React, { useState, useEffect, useCallback } from 'react';
import './simulator.css';
import LeftSidebarHUD from './components/LeftSidebarHUD.jsx';
import CenterHologramHUD from './components/CenterHologramHUD.jsx';
import VoiceConsole from './components/VoiceConsole.jsx';
import BottomStatusToolbar from './components/BottomStatusToolbar.jsx';
import MobileSimulatorHUD from './components/MobileSimulatorHUD.jsx';

// Interactive Modals
import AnalyzeDataModal from './modals/AnalyzeDataModal.jsx';
import MemoryVaultExplorer from './modals/MemoryVaultExplorer.jsx';
import ActivityFeedDrawer from './modals/ActivityFeedDrawer.jsx';
import ControlCenterModal from './modals/ControlCenterModal.jsx';
import LiveCertificationDashboardModal from './modals/LiveCertificationDashboardModal.jsx';
import ConnectionsModal from './modals/ConnectionsModal.jsx';

import { useJinAvatar } from '../../hooks/useJinAvatar.js';
import { useVoiceEngine } from '../../hooks/useVoiceEngine.js';
import { useAudioAnalyzer } from '../../hooks/useAudioAnalyzer.js';
import { simulatorOrchestratorInstance } from '../../services/orchestrator/SimulatorOrchestrator.js';
import { conversationEngineInstance } from '../../services/conversation/ConversationEngine.js';

export default function ChatSimulator() {
  const [activeTab, setActiveTab] = useState('talk_to_jin');
  const [messages, setMessages] = useState([]);
  const [latestResponse, setLatestResponse] = useState('');
  const [simulatorMode, setSimulatorMode] = useState('CONVERSATION'); // 'CONVERSATION' | 'SEARCH' | 'INSIGHTS' | 'APP_PREVIEW'
  const [generatedAppCode, setGeneratedAppCode] = useState(null);
  const [liveSearchSources, setLiveSearchSources] = useState([]);

  // Modal Open States
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
  const [isControlModalOpen, setIsControlModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);

  // JIN Avatar FSM Hook (Single Source of Truth)
  const { state: avatarState, isListening, isProcessing, isSpeaking } = useJinAvatar();

  // Audio-Reactive metrics Hook
  const audioMetrics = useAudioAnalyzer(avatarState);

  // Sync messages from conversation engine
  const refreshMessages = () => {
    setMessages(conversationEngineInstance.getHistory());
  };

  useEffect(() => {
    refreshMessages();
  }, []);

  // Voice Interaction Hook with instant Barge-in
  const handleBargeIn = useCallback(() => {
    console.log('[CHAT] User barge-in detected! Stopping JIN speech.');
  }, []);

  const { startListening, stopListening } = useVoiceEngine({
    onBargeIn: handleBargeIn
  });

  // Handle Text/Voice Prompts through SimulatorOrchestrator
  const handleExecutePrompt = async (promptText) => {
    try {
      // Auto-detect intent and switch simulator display mode
      const lower = promptText.toLowerCase();
      if (lower.includes('cari') || lower.includes('search') || lower.includes('global')) {
        setSimulatorMode('SEARCH');
      } else if (lower.includes('buat') || lower.includes('aplikasi') || lower.includes('app') || lower.includes('build')) {
        setSimulatorMode('APP_PREVIEW');
      } else if (lower.includes('analisis') || lower.includes('risiko') || lower.includes('insight')) {
        setSimulatorMode('INSIGHTS');
      } else {
        setSimulatorMode('CONVERSATION');
      }

      refreshMessages();
      await simulatorOrchestratorInstance.executeUserPrompt(promptText, {
        onStreamChunk: (_, fullText) => {
          setLatestResponse(fullText);
          refreshMessages();
        },
        onResponseReady: (response) => {
          setLatestResponse(response);
          refreshMessages();
        }
      });
      refreshMessages();
    } catch (err) {
      console.error('Failed to execute prompt:', err);
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

  // Sidebar Menu Action Handlers
  const handleSidebarAction = (action) => {
    if (action === 'talk') {
      handleMicToggle();
    } else if (action === 'chat') {
      setSimulatorMode('CONVERSATION');
    } else if (action === 'search') {
      setSimulatorMode('SEARCH');
      handleExecutePrompt('Lakukan global search mengenai data tren riset AI global.');
    } else if (action === 'analyze') {
      setIsAnalyzeModalOpen(true);
    } else if (action === 'deep_analysis') {
      setSimulatorMode('INSIGHTS');
      handleExecutePrompt('Lakukan deep analysis multi-source reasoning pada dataset aktif.');
    } else if (action === 'generate') {
      setSimulatorMode('APP_PREVIEW');
      handleExecutePrompt('Buatkan purwarupa aplikasi monitoring riset interaktif.');
    } else if (action === 'vault') {
      setIsMemoryModalOpen(true);
    } else if (action === 'feed') {
      setIsActivityDrawerOpen(true);
    } else if (action === 'system' || action === 'control') {
      setIsControlModalOpen(true);
    } else if (action === 'connections') {
      setIsConnectionsModalOpen(true);
    }
  };

  return (
    <div className="w-screen h-screen bg-[#060a14] text-slate-100 flex overflow-hidden font-sans cyber-bg">
      {/* 1. Left Sidebar Navigation HUD */}
      <LeftSidebarHUD
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onActionClick={handleSidebarAction}
      />

      {/* 2. Center JIN Hologram HUD & Voice Command Console */}
      <main className="flex-1 h-full flex flex-col justify-between py-2 overflow-hidden relative">
        <CenterHologramHUD
          avatarState={avatarState}
          audioMetrics={audioMetrics}
          onSettingsClick={() => setIsControlModalOpen(true)}
          onNotificationClick={() => setIsActivityDrawerOpen(true)}
          onOpenCertDashboard={() => setIsCertModalOpen(true)}
        />

        <div className="w-full flex flex-col items-center gap-2 pb-2">
          <VoiceConsole
            avatarState={avatarState}
            isListening={isListening}
            onMicClick={handleMicToggle}
            onSubmitText={handleExecutePrompt}
            spectrum={audioMetrics.spectrum}
            liveTranscript={liveTranscript}
          />

          <BottomStatusToolbar
            onQuickCommand={() => handleExecutePrompt('Jelaskan kapabilitas orkestrasi 9Router saat ini.')}
            onVoiceSettings={() => setIsControlModalOpen(true)}
          />
        </div>
      </main>

      {/* 3. Right Mobile Simulator Frame (Live Intelligence Display) */}
      <MobileSimulatorHUD
        messages={messages}
        latestResponse={latestResponse}
        isProcessing={isProcessing}
        activeMode={simulatorMode}
        onModeChange={setSimulatorMode}
        generatedAppCode={generatedAppCode}
        liveSearchSources={liveSearchSources}
      />

      {/* Interactive Modals */}
      <AnalyzeDataModal
        isOpen={isAnalyzeModalOpen}
        onClose={() => setIsAnalyzeModalOpen(false)}
        onAnalyzeDocument={(doc) => {
          setSimulatorMode('INSIGHTS');
          handleExecutePrompt(`Analisis dokumen "${doc.fileName}" (${doc.type}) dan temukan temuan kunci serta potensi risikonya.`);
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
    </div>
  );
}

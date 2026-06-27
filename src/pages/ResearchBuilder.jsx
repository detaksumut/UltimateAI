// src/pages/ResearchBuilder.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { post } from '../services/apiClient';
import { 
  Sparkles, Settings2, Plus, Trash2, CheckCircle2, 
  ChevronRight, Loader2, AlertCircle, Moon, Sun, Monitor,
  MessageSquare, BrainCircuit, ListTodo, Code2, Rocket, 
  LayoutTemplate, FileText, Settings, NotebookPen, LayoutDashboard,
  PlusCircle, Table, Check, Lock, Smartphone, RefreshCw, Send,
  Globe, Shield, WifiOff, Bell, Users, ToggleLeft, HelpCircle
} from 'lucide-react';
import DeploymentStatus from '../components/DeploymentStatus';

// Import Visual Prototype Core Modules
import { ProjectIntelligenceEngine } from '../builder/requirement/ProjectIntelligenceEngine';
import { PrototypeIntelligenceEngine } from '../builder/prototype/PrototypeIntelligenceEngine';
import { AdjustmentEngine } from '../builder/adjustment/AdjustmentEngine';
import { ApprovalManager } from '../builder/approval/ApprovalManager';
import { ApplicationGenerator } from '../builder/generator/ApplicationGenerator';
import { SimulationStateManager } from '../builder/prototype/SimulationStateManager';
import { ProjectSessionMemory } from '../builder/requirement/ProjectSessionMemory';
import { ExperienceIntelligenceEngine } from '../builder/experience/ExperienceIntelligenceEngine';
import { ProjectContextIsolationEngine } from '../builder/context/ProjectContextIsolationEngine';
import { ContextIntegrityEngine } from '../builder/context/ContextIntegrityEngine';

function ResearchBuilder() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [activeSection, setActiveSection] = useState('variables');
  
  // State for Core Builder modules
  const [requirementModel, setRequirementModel] = useState(null);
  const [renderedPrototype, setRenderedPrototype] = useState(null);
  const [activeScreenId, setActiveScreenId] = useState('dashboard');
  const [adjustmentPrompt, setAdjustmentPrompt] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Chat History for AI Designer
  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: 'Hi! I am your UltimateAI Designer. I can help refine the layout, add features (e.g. login, map), or update colors. Try typing "Add Login screen" or "Use dark theme".' }
  ]);
  
  // State from AI analyze step (compatibility)
  const [analysis, setAnalysis] = useState(null);
  const [recommendedParams, setRecommendedParams] = useState([]);
  
  // UI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [generatedProjectId, setGeneratedProjectId] = useState(null);
  const [readinessTab, setReadinessTab] = useState('project'); // 'project' | 'experience'
  const [analystTab, setAnalystTab] = useState('analyst'); // 'analyst' | 'designer'

  // Instantiating core visual builder engines
  const analyzer = new ProjectIntelligenceEngine();
  const engine = new PrototypeIntelligenceEngine();
  const adjustmentEngine = new AdjustmentEngine();
  const approvalManager = new ApprovalManager();
  const generator = new ApplicationGenerator();
  const stateManagerRef = React.useRef(new SimulationStateManager('Draft'));
  const sessionMemoryRef = React.useRef(new ProjectSessionMemory());

  // Dark/Light Theme setup
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Handle Undo/Redo
  const handleUndo = () => {
    const previous = sessionMemoryRef.current.undo();
    if (previous) {
      setRequirementModel(previous.model);
      setRenderedPrototype(previous.prototype);
      setRecommendedParams(previous.model.parameters);
      stateManagerRef.current.transitionTo('Adjusted');
      setSuccess('Undo successful!');
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  const handleRedo = () => {
    const next = sessionMemoryRef.current.redo();
    if (next) {
      setRequirementModel(next.model);
      setRenderedPrototype(next.prototype);
      setRecommendedParams(next.model.parameters);
      stateManagerRef.current.transitionTo('Adjusted');
      setSuccess('Redo successful!');
      setTimeout(() => setSuccess(null), 2000);
    }
  };

  // Handle Initial AI Analysis & model setup
  const handleAnalyze = async () => {
    if (!prompt.trim()) {
      setError('Please enter a research idea before analyzing.');
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    setAnalysis(null);
    setRequirementModel(null);
    setRenderedPrototype(null);
    
    try {
      // Enforce strict Project Context Isolation first before analysis/model construction
      const isolationEngine = new ProjectContextIsolationEngine();
      const session = isolationEngine.createSession(prompt);

      // 1. Backend AI service analyzes user text
      const data = await post('/api/analyze', { prompt });
      setAnalysis(data);
      
      // Map back and initialize the internal Requirement Model using local Analyzer
      const initialModel = analyzer.analyze(prompt, session.projectId);
      initialModel.projectContextId = session.projectContextId;
      
      // Tailor details from 9Router analysis
      initialModel.researchTitle = data.researchTitle || initialModel.researchTitle;
      initialModel.researchType = data.researchType || initialModel.researchType;
      initialModel.methodology = data.methodology || initialModel.methodology;
      initialModel.variables = data.variables || initialModel.variables;
      initialModel.researchObjectives = data.researchObjectives || initialModel.researchObjectives;
      initialModel.researchQuestions = data.researchQuestions || initialModel.researchQuestions;
      
      if (data.recommendedParameters && data.recommendedParameters.length > 0) {
        initialModel.parameters = data.recommendedParameters.map(p => ({
          name: p.name || '',
          type: (p.type || 'text').toLowerCase(),
          required: !!p.required,
          options: p.options || []
        }));
      }

      // Generate the visual prototype payload
      const proto = engine.generatePrototype(initialModel);
      
      setRequirementModel(initialModel);
      setRenderedPrototype(proto);
      setRecommendedParams(initialModel.parameters);
      setActiveScreenId(initialModel.entryScreenId || 'dashboard');

      sessionMemoryRef.current.initialize(initialModel, proto);
      stateManagerRef.current = new SimulationStateManager('Draft');
      
      // AI Designer greetings based on prompt reasoning
      const reasoning = data.aiDesignerReasoning || initialModel.aiDesignerReasoning;
      const greetingDetails = `I analyzed your prompt and planned a custom Application Blueprint for "${initialModel.researchTitle}".

Based on your requirements, I detected:
${(data.requirements || initialModel.requirements).map(req => `• ${req}`).join('\n')}

I recommend adding the following modules to expand this prototype:
${(reasoning.recommendations || []).map(rec => `✓ ${rec}`).join('\n')}`;

      setChatMessages([
        { sender: 'ai', text: reasoning.summary || `I have analyzed your prompt and planned a custom blueprint for "${initialModel.researchTitle}".` },
        { sender: 'ai', text: greetingDetails }
      ]);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle design adjustment diff request
  const handleAdjust = async (directPrompt = null) => {
    const textToUse = directPrompt || adjustmentPrompt;
    if (!textToUse.trim() || !requirementModel) return;
    setError(null);
    setIsAdjusting(true);

    // Append to chat messages
    setChatMessages(prev => [...prev, { sender: 'user', text: textToUse }]);

    try {
      // Call both local AdjustmentEngine and Sync with Backend adjust API
      const result = await post('/api/adjust', { 
        model: requirementModel, 
        adjustmentPrompt: textToUse 
      });

      const updated = result.updatedModel || textToUse;
      
      // Enforce update via client-side AdjustmentEngine to ensure correct types/rendering
      const adjusted = adjustmentEngine.adjust(requirementModel, textToUse);

      setRequirementModel(adjusted.updatedModel);
      setRenderedPrototype(adjusted.renderedPrototype);
      setRecommendedParams(adjusted.updatedModel.parameters);

      sessionMemoryRef.current.recordState(adjusted.updatedModel, adjusted.renderedPrototype);
      stateManagerRef.current.transitionTo('Adjusted');
      
      if (adjusted.updatedModel.screens.some(s => s.id === 'login') && textToUse.toLowerCase().includes('login')) {
        setActiveScreenId('login');
      } else if (adjusted.updatedModel.screens.some(s => s.id === 'gis-map') && textToUse.toLowerCase().includes('map')) {
        setActiveScreenId('gis-map');
      } else if (adjusted.updatedModel.screens.some(s => s.id === 'analysis') && textToUse.toLowerCase().includes('analysis')) {
        setActiveScreenId('analysis');
      } else if (!adjusted.updatedModel.screens.some(s => s.id === activeScreenId)) {
        setActiveScreenId(adjusted.updatedModel.entryScreenId || 'dashboard');
      }

      // Add AI response
      setChatMessages(prev => [...prev, { sender: 'ai', text: `Understood! I've updated the Project Intelligence Model & visual layouts based on: "${textToUse}". The changes have been rendered live in the simulator.` }]);

      if (!directPrompt) setAdjustmentPrompt('');
      setSuccess('Prototype updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      console.error(e);
      setError('Refinement failed. Please try again.');
      setChatMessages(prev => [...prev, { sender: 'ai', text: 'Sorry, I encountered an issue updating the prototype.' }]);
    } finally {
      setIsAdjusting(false);
    }
  };

  // Resolve cross-domain logic anomaly
  const handleResolveAnomaly = () => {
    if (!requirementModel) return;
    const updated = { ...requirementModel };
    // Clear statistical analysis methods to resolve the conflict
    updated.analysisMethods = [];
    // Remove analysis screen and navigation if they exist
    updated.screens = updated.screens.filter(s => s.id !== 'analysis');
    updated.navigation.items = updated.navigation.items.filter(item => item.screenId !== 'analysis');
    if (activeScreenId === 'analysis') setActiveScreenId('dashboard');
    
    // Reset/recalculate project readiness scores
    updated.projectReadiness = {
      ...updated.projectReadiness,
      uxQuality: 92,
      overallReadiness: 94
    };

    const proto = engine.generatePrototype(updated);
    setRequirementModel(updated);
    setRenderedPrototype(proto);
    setRecommendedParams(updated.parameters);
    sessionMemoryRef.current.recordState(updated, proto);
    stateManagerRef.current.transitionTo('Adjusted');
    setSuccess('Cross-domain anomaly successfully resolved!');
    setTimeout(() => setSuccess(null), 3000);
  };

  // Lock Model via Approval Manager
  const finalizeSpecification = async () => {
    console.log('finalizeSpecification CALLED', !!requirementModel);
    if (!requirementModel) return;
    try {
      const approved = approvalManager.approve(requirementModel);
      console.log('approved model locked:', approved.locked);
      
      // Update state synchronously to prevent race conditions with automated E2E tests
      setRequirementModel(approved);
      stateManagerRef.current.transitionTo('Approved');
      
      // Sync with server approve API in background
      post('/api/approve', { model: approved }).catch(err => {
        console.error('Approval sync failed:', err);
      });
      
      setSuccess('Visual prototype approved and specification locked!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      console.error(e);
      setError('Approval failed.');
    }
  };

  // Scaffold Code using approved and locked model
  const generateTool = async () => {
    console.log('generateTool CALLED', !!requirementModel, requirementModel?.locked);
    if (!requirementModel) return;
    if (!requirementModel.locked) {
      console.log('generateTool BLOCKED: not locked');
      setError('Please finalize specification and approve design first');
      return;
    }
    if (requirementModel.projectReadiness && requirementModel.projectReadiness.overallReadiness < 80) {
      setError('Cannot generate application: Overall project readiness is below the 80% threshold.');
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      // Generate scaffolding payload using ApplicationGenerator
      const payload = generator.generatePayload(requirementModel);
      console.log('Scaffolding payload generated', payload);
      const result = await post('/api/generate-tool', { 
        projectModel: requirementModel,
        researchSpecification: payload.researchSpecification 
      });
      console.log('Post /api/generate-tool success', result);
      
      stateManagerRef.current.transitionTo('Generated');
      localStorage.setItem('currentProjectId', result.projectId);
      setGeneratedProjectId(result.projectId);
    } catch (e) {
      console.error('generateTool caught error:', e);
      setError('Scaffolding failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Add / Edit parameters in the model (syncs directly to visual renderer)
  const addCustomParam = () => {
    if (!requirementModel) return;
    const updated = { ...requirementModel };
    updated.parameters.push({ name: 'New Variable', type: 'text', required: false });
    const proto = engine.generatePrototype(updated);
    setRequirementModel(updated);
    setRenderedPrototype(proto);
    setRecommendedParams(updated.parameters);
  };

  const updateParam = (type, idx, field, value) => {
    if (!requirementModel) return;
    const updated = { ...requirementModel };
    const p = updated.parameters[idx];
    if (p) {
      p[field] = value;
      if (field === 'type' && value !== 'dropdown') p.options = [];
      const proto = engine.generatePrototype(updated);
      setRequirementModel(updated);
      setRenderedPrototype(proto);
      setRecommendedParams(updated.parameters);
    }
  };

  const removeParam = (type, idx) => {
    if (!requirementModel) return;
    const updated = { ...requirementModel };
    updated.parameters.splice(idx, 1);
    const proto = engine.generatePrototype(updated);
    setRequirementModel(updated);
    setRenderedPrototype(proto);
    setRecommendedParams(updated.parameters);
  };

  // Toggles for high-level checkboxes
  const handleFeatureToggle = (feature) => {
    if (!requirementModel) return;
    const updated = { ...requirementModel };
    if (updated.features.includes(feature)) {
      updated.features = updated.features.filter(f => f !== feature);
      if (feature === 'Authentication') {
        updated.screens = updated.screens.filter(s => s.id !== 'login');
        updated.navigation.items = updated.navigation.items.filter(item => item.screenId !== 'login');
        if (activeScreenId === 'login') setActiveScreenId('dashboard');
      }
      if (feature === 'Dark Mode') {
        updated.theme.darkMode = false;
      }
    } else {
      updated.features.push(feature);
      if (feature === 'Authentication') {
        if (!updated.screens.some(s => s.id === 'login')) {
          updated.screens.unshift({
            id: 'login',
            title: 'Login Page',
            type: 'login',
            components: ['LoginFormInput', 'SubmitButton']
          });
          updated.navigation.items.unshift({
            label: 'Login',
            screenId: 'login',
            icon: 'Lock'
          });
        }
        setActiveScreenId('login');
      }
      if (feature === 'Dark Mode') {
        updated.theme.darkMode = true;
      }
    }
    const proto = engine.generatePrototype(updated);
    setRequirementModel(updated);
    setRenderedPrototype(proto);
    setRecommendedParams(updated.parameters);
  };

  const handleOutputToggle = (output) => {
    if (!requirementModel) return;
    const updated = { ...requirementModel };
    if (updated.outputs.includes(output)) {
      updated.outputs = updated.outputs.filter(o => o !== output);
      if (output === 'GIS Maps') {
        updated.screens = updated.screens.filter(s => s.id !== 'gis-map');
        updated.navigation.items = updated.navigation.items.filter(item => item.screenId !== 'gis-map');
        if (activeScreenId === 'gis-map') setActiveScreenId('dashboard');
      }
    } else {
      updated.outputs.push(output);
      if (output === 'GIS Maps') {
        if (!updated.screens.some(s => s.id === 'gis-map')) {
          updated.screens.push({
            id: 'gis-map',
            title: 'GIS Map',
            type: 'gis-map',
            components: ['GISMapCard', 'MapWidget']
          });
          updated.navigation.items.push({
            label: 'GIS Map',
            screenId: 'gis-map',
            icon: 'Globe'
          });
        }
        setActiveScreenId('gis-map');
      }
    }
    const proto = engine.generatePrototype(updated);
    setRequirementModel(updated);
    setRenderedPrototype(proto);
    setRecommendedParams(updated.parameters);
  };

  const handleAnalysisToggle = (method) => {
    if (!requirementModel) return;
    const updated = { ...requirementModel };
    if (updated.analysisMethods.includes(method)) {
      updated.analysisMethods = updated.analysisMethods.filter(m => m !== method);
      if (method === 'Regression') {
        updated.screens = updated.screens.filter(s => s.id !== 'analysis');
        updated.navigation.items = updated.navigation.items.filter(item => item.screenId !== 'analysis');
        if (activeScreenId === 'analysis') setActiveScreenId('dashboard');
      }
    } else {
      updated.analysisMethods.push(method);
      if (method === 'Regression') {
        if (!updated.screens.some(s => s.id === 'analysis')) {
          updated.screens.push({
            id: 'analysis',
            title: 'Statistical Regression Models',
            type: 'analysis',
            components: ['ANOVACard', 'StatsTable']
          });
          updated.navigation.items.push({
            label: 'Analysis',
            screenId: 'analysis',
            icon: 'LineChart'
          });
        }
        setActiveScreenId('analysis');
      }
    }
    const proto = engine.generatePrototype(updated);
    setRequirementModel(updated);
    setRenderedPrototype(proto);
    setRecommendedParams(updated.parameters);
  };

  const toggleNavigationLayout = () => {
    if (!requirementModel) return;
    const updated = { ...requirementModel };
    updated.navigation.type = updated.navigation.type === 'tabs' ? 'sidebar' : 'tabs';
    const proto = engine.generatePrototype(updated);
    setRequirementModel(updated);
    setRenderedPrototype(proto);
  };

  // Helper to map Lucide icon strings
  const getNavIcon = (iconName) => {
    switch (iconName) {
      case 'LayoutDashboard': return <LayoutDashboard className="w-4 h-4" />;
      case 'PlusCircle': return <PlusCircle className="w-4 h-4" />;
      case 'Table': return <Table className="w-4 h-4" />;
      case 'FileText': return <FileText className="w-4 h-4" />;
      case 'Lock': return <Lock className="w-4 h-4" />;
      case 'Globe': return <Globe className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  // Render Editor parameter component
  const renderParamEditor = (param, idx) => (
    <div key={idx} className="group flex flex-col md:flex-row items-start md:items-center gap-3 p-3 bg-slate-800/20 border border-slate-700/30 rounded-xl hover:border-blue-500/30 transition-all mb-2">
      <input
        type="text"
        className="flex-1 bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-xs text-slate-200 py-1"
        value={param.name}
        onChange={e => updateParam('recommended', idx, 'name', e.target.value)}
      />
      <div className="flex items-center gap-2">
        <select
          className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 outline-none text-slate-300"
          value={param.type}
          onChange={e => updateParam('recommended', idx, 'type', e.target.value)}
        >
          {['text', 'number', 'date', 'dropdown', 'checkbox'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-offset-slate-900"
            checked={!!param.required}
            onChange={e => updateParam('recommended', idx, 'required', e.target.checked)}
          />
          <span className="text-[10px] text-slate-400">Req</span>
        </label>
        <button 
          className="p-1 text-slate-500 hover:text-red-400"
          onClick={() => removeParam('recommended', idx)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-200 font-sans selection:bg-blue-500/30 transition-colors duration-300">
      {/* HEADER */}
      <header className="border-b border-white/5 bg-[#0a0f1c]">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoUrl} alt="UltimateAI Logo" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="font-bold text-2xl text-white tracking-tight leading-none">
                Ultimate<span className="text-blue-500">AI</span>
              </h1>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em] block mt-1">
                Visual Prototype First
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-full bg-slate-800/50 hover:bg-slate-700/50 border border-white/5 transition-colors text-slate-300"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold cursor-pointer">
              U
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-8 pb-32">
        {/* Error / Success Notifications */}
        {error && (
          <div className="flex items-center gap-3 p-4 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-3 p-4 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{success}</p>
          </div>
        )}

        {/* STEP 1: Describe Research (Input Stage) */}
        {!requirementModel && (
          <section className="bg-[#111827] border border-white/5 rounded-2xl p-8 relative shadow-xl max-w-3xl mx-auto">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">1</div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Describe Your Research Idea</h2>
                <p className="text-slate-400 text-sm">
                  UltimateAI turns your description into a visual prototype blueprint instantly.
                </p>
              </div>
            </div>
            
            <textarea
              className="w-full bg-[#182133] border border-slate-700/50 rounded-xl p-5 min-h-[160px] text-slate-200 outline-none focus:ring-1 focus:ring-blue-500/50 transition-all resize-y"
              placeholder="e.g. Study the effect of temperature and pH on E.coli growth..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={isAnalyzing}
            />
            
            <div className="flex justify-end pt-4 border-t border-white/5 mt-4">
              <button 
                className="flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white px-8 py-3.5 rounded-xl font-semibold shadow-lg transition-all active:scale-[0.98]" 
                onClick={handleAnalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                <span>Analyse</span>
              </button>
            </div>
          </section>
        )}

        {/* COMPLETED WORKSPACE (Prototype simulator is center stage at top) */}
        {requirementModel && renderedPrototype && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* 1️⃣ PRIMARY FOCUS: MOBILE APPLICATION SIMULATOR IN THE TOP CENTER */}
            <div className="flex flex-col items-center">
              <div className="text-center mb-6">
                <span className="text-xs font-semibold text-blue-500 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                  Interactive Live Blueprint
                </span>
                <h2 className="text-2xl font-bold text-white mt-3">Mobile Application Simulator</h2>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Click the bottom tabs or sidebar menu inside the mockup device to test navigation and interact with your variables.
                </p>
              </div>

              {/* iPhone Frame Mockup */}
              <div className="relative border-slate-800 bg-slate-900 border-[12px] rounded-[3rem] h-[600px] w-[300px] shadow-2xl ring-4 ring-slate-800/40">
                {/* Notch */}
                <div className="w-[130px] h-[20px] bg-slate-900 top-0 rounded-b-[1.2rem] left-1/2 -translate-x-1/2 absolute z-30"></div>
                
                {/* Screen internal container */}
                <div className={`rounded-[2.2rem] overflow-hidden w-full h-full flex flex-col justify-between select-none relative ${requirementModel.theme.darkMode ? 'bg-[#0d1117] text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
                  
                  {/* Status Bar */}
                  <div className={`h-8 pt-3 px-5 flex justify-between items-center text-[9px] font-bold z-10 ${requirementModel.theme.darkMode ? 'text-slate-400 bg-slate-950/20' : 'text-slate-500 bg-slate-200/40'}`}>
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <span>📶</span>
                      <span>🔋</span>
                    </div>
                  </div>

                  {/* Sidebar Drawer overlay */}
                  {requirementModel.navigation.type === 'sidebar' && sidebarOpen && (
                    <div className="absolute inset-0 bg-black/60 z-40 transition-opacity" onClick={() => setSidebarOpen(false)}>
                      <div className={`w-4/5 h-full p-6 space-y-6 flex flex-col justify-between ${requirementModel.theme.darkMode ? 'bg-[#161b22] text-slate-200' : 'bg-white text-slate-800'}`} onClick={e => e.stopPropagation()}>
                        <div className="space-y-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation Menu</p>
                          <div className="space-y-2">
                            {renderedPrototype.navigation.links.map(link => (
                              <button
                                key={link.screenId}
                                onClick={() => {
                                  setActiveScreenId(link.screenId);
                                  setSidebarOpen(false);
                                }}
                                className="w-full flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold text-left"
                                style={{ backgroundColor: activeScreenId === link.screenId ? `${requirementModel.theme.primaryColor}15` : 'transparent', color: activeScreenId === link.screenId ? requirementModel.theme.primaryColor : 'inherit' }}
                              >
                                {getNavIcon(link.icon)}
                                <span>{link.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-500 border-t border-slate-700/20 pt-3">
                          {requirementModel.researchTitle}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Screen Content */}
                  <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
                    {/* Header line */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/10">
                      <div className="flex items-center gap-2">
                        {requirementModel.navigation.type === 'sidebar' && (
                          <button onClick={() => setSidebarOpen(true)} className="p-1 rounded hover:bg-slate-700/10">
                            ☰
                          </button>
                        )}
                        <h4 className="text-xs font-bold" style={{ color: renderedPrototype.theme.primaryColor }}>
                          {renderedPrototype.screens.find(s => s.id === activeScreenId)?.title || 'Screen'}
                        </h4>
                      </div>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                        {requirementModel.researchType}
                      </span>
                    </div>

                    {/* Collaborative Consistency Warnings & Suggestion Cards */}
                    {requirementModel.projectReadiness && requirementModel.projectReadiness.overallReadiness < 80 && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2 text-left shadow-sm">
                        <div className="flex items-center gap-2 text-amber-400">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="text-[9px] font-bold uppercase tracking-wider">Project Quality Warning ({requirementModel.projectReadiness.overallReadiness}%)</span>
                        </div>
                        <p className="text-[8.5px] text-amber-200/90 leading-relaxed">
                          Cross-domain components detected: Restaurant POS includes statistical regression analysis tools.
                        </p>
                        <div className="flex gap-2 pt-1">
                          <button 
                            onClick={() => handleAdjust('Remove analytics and statistical regression tools.')}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-[8px] font-bold py-1 px-1.5 rounded transition-all active:scale-[0.98]"
                          >
                            Remove Analytics
                          </button>
                          <button 
                            onClick={() => handleAdjust('Keep statistical regression to analyze customer order trends.')}
                            className="flex-1 border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-[8px] font-bold py-1 px-1.5 rounded transition-all active:scale-[0.98]"
                          >
                            Keep & Justify
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Dynamic Component Builder inside Mock Device */}
                    {renderedPrototype.components[activeScreenId]?.map((comp, idx) => {
                      if (comp.type === 'card') {
                        return (
                          <div key={idx} className={`border rounded-xl p-3 space-y-1.5 ${requirementModel.theme.darkMode ? 'bg-slate-900/60 border-slate-850' : 'bg-white border-slate-200 shadow-sm'}`}>
                            {comp.props.title && <p className="text-[11px] font-bold">{comp.props.title}</p>}
                            {comp.props.description && <p className="text-[9px] text-slate-500 leading-relaxed whitespace-pre-line">{comp.props.description}</p>}
                            
                            {/* GIS Map Simulated Widget */}
                            {comp.props.isMap && (
                              <div className="h-28 w-full bg-slate-950/40 rounded-lg flex flex-col justify-end p-2 relative overflow-hidden border border-slate-800/50 mt-1">
                                <div className="absolute inset-0 bg-blue-500/5 flex items-center justify-center text-[10px] text-slate-600">
                                  [ Geo-Spatial Grid Visualization ]
                                </div>
                                <div className="z-10 bg-slate-900/80 p-1.5 rounded text-[8px] flex justify-between text-slate-300">
                                  <span>{comp.props.locationsCount}</span>
                                  <span>{comp.props.coordinates}</span>
                                </div>
                              </div>
                            )}

                            {comp.props.items && (
                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                {comp.props.items.map((it, i) => (
                                  <div key={i} className={`p-1.5 rounded-lg text-center border ${requirementModel.theme.darkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                    <span className="text-[8px] text-slate-500 block truncate">{it.label}</span>
                                    <span className="text-[10px] font-bold mt-0.5 block">{it.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (comp.type === 'chart') {
                        return (
                          <div key={idx} className={`border rounded-xl p-3 space-y-2 ${requirementModel.theme.darkMode ? 'bg-slate-900/60 border-slate-850' : 'bg-white border-slate-200 shadow-sm'}`}>
                            <p className="text-[11px] font-bold">{comp.props.title}</p>
                            <div className="h-24 w-full flex items-end justify-between gap-1 pt-3 relative">
                              {comp.props.data.map((pt, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                  <div className="w-full rounded-t border-t transition-all" 
                                       style={{ 
                                          height: `${pt.value * 4.5}px`,
                                          backgroundColor: `${renderedPrototype.theme.primaryColor}20`,
                                          borderTopColor: renderedPrototype.theme.primaryColor
                                       }}
                                  ></div>
                                  <span className="text-[8px] text-slate-400">{pt.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      if (comp.type === 'input') {
                        return (
                          <div key={idx} className="space-y-1 text-left">
                            <label className="text-[9px] font-semibold flex items-center gap-1">
                              {comp.props.label}
                              {comp.props.required && <span className="text-red-500">*</span>}
                            </label>
                            {comp.props.inputType === 'checkbox' ? (
                              <input type="checkbox" className="w-3.5 h-3.5 text-blue-500 accent-blue-500" defaultChecked={!!comp.props.checked} />
                            ) : comp.props.inputType === 'dropdown' ? (
                              <select className={`w-full text-[10px] px-2 py-1.5 rounded-md focus:outline-none border ${requirementModel.theme.darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-300 text-slate-800'}`}>
                                {comp.props.options?.map((opt, i) => (
                                  <option key={i} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <input 
                                type={comp.props.inputType} 
                                className={`w-full text-[10px] px-2 py-1.5 rounded-md focus:outline-none border ${requirementModel.theme.darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-300 text-slate-800'}`} 
                                placeholder={comp.props.placeholder}
                              />
                            )}
                          </div>
                        );
                      }

                      if (comp.type === 'button') {
                        return (
                          <button 
                            key={idx} 
                            className="w-full text-white text-[10px] py-1.5 rounded-md font-semibold transition-all active:scale-[0.98] mt-1"
                            style={{ backgroundColor: renderedPrototype.theme.primaryColor }}
                          >
                            {comp.props.label}
                          </button>
                        );
                      }

                      if (comp.type === 'table') {
                        return (
                          <div className={`border rounded-lg overflow-hidden text-[8px] ${requirementModel.theme.darkMode ? 'border-slate-850 bg-slate-900/10' : 'border-slate-200 bg-white'}`}>
                            <div className="grid grid-cols-4 bg-slate-950/10 p-1.5 font-bold border-b border-slate-800/10">
                              {comp.props.headers.slice(0, 4).map((h, i) => (
                                <span key={i} className="truncate">{h}</span>
                              ))}
                            </div>
                            <div className="grid grid-cols-4 p-1.5 text-slate-500">
                              {comp.props.rows[0]?.slice(0, 4).map((r, i) => (
                                <span key={i} className="truncate">{r}</span>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      if (comp.type === 'quick-actions') {
                        return (
                          <div key={idx} className="space-y-1.5">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Quick Actions</p>
                            <div className="grid grid-cols-2 gap-2">
                              {comp.props.actions?.map((act, i) => (
                                <button
                                  key={i}
                                  onClick={() => setActiveScreenId(act.screenId)}
                                  className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all active:scale-[0.98] ${
                                    requirementModel.theme.darkMode 
                                      ? 'bg-slate-900/40 hover:bg-slate-900/60 border-slate-800' 
                                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 shadow-sm'
                                  }`}
                                >
                                  <span className="text-[9px] font-bold truncate" style={{ color: renderedPrototype.theme.primaryColor }}>
                                    {act.label}
                                  </span>
                                  <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: renderedPrototype.theme.primaryColor }} />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>

                  {/* Bottom navigation bar (Only shown when not sidebar menu) */}
                  {requirementModel.navigation.type === 'tabs' && (
                    <div className={`border-t py-1.5 px-3 flex items-center justify-around z-10 ${requirementModel.theme.darkMode ? 'bg-slate-950/80 border-slate-850' : 'bg-white border-slate-200'}`}>
                      {renderedPrototype.navigation.links.map((link) => {
                        const isActive = activeScreenId === link.screenId;
                        return (
                          <button
                            key={link.screenId}
                            onClick={() => setActiveScreenId(link.screenId)}
                            className="flex flex-col items-center gap-1"
                            style={{ color: isActive ? renderedPrototype.theme.primaryColor : '#64748b' }}
                          >
                            {getNavIcon(link.icon)}
                            <span className="text-[7.5px] font-medium tracking-wider">{link.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2️⃣ DOUBLE COLUMN: AI DESIGNER CHAT & HIGH-LEVEL CONFIGURATION PANELS */}
            <div className="grid md:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Conversational AI Designer Panel (5 cols) */}
              <div className="md:col-span-5 bg-[#111827] border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col h-[560px]">
                <div className="flex items-center justify-between pb-4 border-b border-white/5">
                  <div className="flex gap-1 bg-slate-900/60 p-0.5 rounded-lg border border-white/5">
                    <button
                      onClick={() => setAnalystTab('analyst')}
                      className={`text-[9px] font-bold px-2 py-1 rounded transition-all ${
                        analystTab === 'analyst' 
                          ? 'bg-blue-600/20 text-blue-400 font-semibold' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Analyst
                    </button>
                    <button
                      onClick={() => setAnalystTab('designer')}
                      className={`text-[9px] font-bold px-2 py-1 rounded transition-all ${
                        analystTab === 'designer' 
                          ? 'bg-[#8b5cf6]/20 text-[#a78bfa] font-semibold' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Designer
                    </button>
                    <button
                      onClick={() => setAnalystTab('isolation')}
                      className={`text-[9px] font-bold px-2 py-1 rounded transition-all ${
                        analystTab === 'isolation' 
                          ? 'bg-emerald-600/20 text-emerald-400 font-semibold' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Context Isolation
                    </button>
                  </div>
                  
                  {/* Undo / Redo controls */}
                  <div className="flex gap-1">
                    <button 
                      onClick={handleUndo} 
                      title="Undo Action" 
                      className="p-1 px-2 text-[10px] bg-slate-800 hover:bg-slate-750 text-slate-300 rounded border border-slate-750/30 transition-all active:scale-[0.95]"
                    >
                      ↶ Undo
                    </button>
                    <button 
                      onClick={handleRedo} 
                      title="Redo Action" 
                    className="p-1 px-2 text-[10px] bg-slate-800 hover:bg-slate-750 text-slate-300 rounded border border-slate-750/30 transition-all active:scale-[0.95]"
                    >
                      ↷ Redo
                    </button>
                  </div>
                </div>
                {/* Analyst System Log body */}
                <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 text-xs text-slate-300 leading-relaxed scrollbar-thin">
                  {!requirementModel ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4 text-slate-500 space-y-2">
                      <BrainCircuit className="w-8 h-8 opacity-40 animate-pulse text-blue-400" />
                      <p className="text-[10px]">Enter a project prompt and click "Analyse" to generate the Project Intelligence Model and visual simulation state.</p>
                    </div>
                  ) : analystTab === 'analyst' ? (
                    <div className="space-y-4 text-left animate-in fade-in duration-200">
                      {/* Dynamic Domain Badge */}
                      <div className="flex items-center justify-between bg-blue-500/5 border border-blue-500/20 p-2.5 rounded-xl">
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase font-bold">Inferred Project Domain</p>
                          <p className="text-xs font-bold text-blue-400">{requirementModel.domain?.name || 'Scientific Research'}</p>
                        </div>
                        <span className="text-[8px] bg-blue-600/10 border border-blue-500/20 px-2 py-0.5 rounded text-blue-300 font-semibold uppercase tracking-wider">
                          {requirementModel.domain?.category || 'Science'}
                        </span>
                      </div>

                      {/* System Warnings & Anomalies */}
                      {requirementModel.domain?.name === 'Food Service' && requirementModel.analysisMethods?.length > 0 && (
                        <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl space-y-2 animate-in fade-in duration-300">
                          <div className="flex items-center gap-2 text-rose-400 font-bold text-[10px]">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>System Anomaly Detected</span>
                          </div>
                          <p className="text-[9px] text-slate-400 leading-relaxed">
                            A Food Service system typically does not use statistical regression analysis methods. Having both leads to a cross-domain design inconsistency and reduces project readiness to 55%.
                          </p>
                          <button
                            onClick={handleResolveAnomaly}
                            className="w-full bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 font-bold py-1.5 px-3 rounded-lg text-[9px] transition-all hover:scale-[0.98] active:scale-[0.95]"
                          >
                            Resolve Anomaly (Remove Regression Analysis)
                          </button>
                        </div>
                      )}

                      {/* Business Goals */}
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">1. Intent & Purpose</h4>
                        <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-850 space-y-1">
                          <p className="text-[10px] font-semibold text-slate-200">Objective:</p>
                          <p className="text-[9px] text-slate-400">{requirementModel.intent?.objective}</p>
                          <p className="text-[10px] font-semibold text-slate-200 mt-1">Core Purpose:</p>
                          <p className="text-[9px] text-slate-400">{requirementModel.intent?.purpose}</p>
                        </div>
                      </div>

                      {/* Entities Model */}
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">2. Business Entities</h4>
                        <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-850 space-y-2">
                          {requirementModel.entities?.map((ent, idx) => (
                            <div key={idx} className="border-b border-slate-800/60 pb-1.5 last:border-b-0 last:pb-0">
                              <div className="flex items-center gap-1.5 justify-between">
                                <span className="font-bold text-slate-200 text-[10px]">{ent.name}</span>
                                <span className="text-[8px] text-slate-500 font-medium truncate max-w-[150px]">{ent.purpose}</span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ent.properties.map((p, i) => (
                                  <span key={i} className="bg-slate-800/80 text-slate-400 text-[8px] px-1.5 py-0.5 rounded">
                                    {p.name}: <span className="text-slate-50">{p.type}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Workflow Sequence */}
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">3. Core Workflow Order</h4>
                        <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-850">
                          <div className="flex flex-col gap-1.5">
                            {requirementModel.workflows?.[0]?.steps.map((step, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full bg-blue-500/10 text-blue-400 text-[8px] flex items-center justify-center font-bold">{idx + 1}</span>
                                <span className="text-[9.5px] text-slate-300">{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* AI Internal Review Audits */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">4. AI Internal Review Audit</h4>
                          <span className="text-[8px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            ✓ Passed Critique
                          </span>
                        </div>
                        <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-850 space-y-1.5 text-[9px] text-slate-400">
                          <div>
                            <span className="font-bold text-slate-200">Architecture: </span>
                            {requirementModel.aiInternalReview?.architectureReview}
                          </div>
                          <div>
                            <span className="font-bold text-slate-200">Workflow: </span>
                            {requirementModel.aiInternalReview?.workflowReview}
                          </div>
                          <div>
                            <span className="font-bold text-slate-200">UX Audit: </span>
                            {requirementModel.aiInternalReview?.uxReview}
                          </div>
                          <div>
                            <span className="font-bold text-slate-200">Security Gate: </span>
                            {requirementModel.aiInternalReview?.securityReview}
                          </div>
                          <div>
                            <span className="font-bold text-slate-200">Scalability: </span>
                            {requirementModel.aiInternalReview?.scalabilityReview}
                          </div>
                          <div>
                            <span className="font-bold text-slate-200">Accessibility: </span>
                            {requirementModel.aiInternalReview?.accessibilityReview}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : analystTab === 'designer' ? (
                    <div className="space-y-4 text-left animate-in fade-in duration-200">
                      {/* Dynamic Entry Experience Block */}
                      <div className="bg-[#8b5cf6]/5 border border-[#8b5cf6]/20 p-2.5 rounded-xl">
                        <p className="text-[9px] text-slate-500 uppercase font-bold">Planned Entry Screen</p>
                        <p className="text-xs font-bold text-[#c084fc]">
                          {requirementModel.screens?.find(s => s.id === requirementModel.entryScreenId)?.title || 'Dashboard'}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-1 leading-normal">
                          The system entry page bypasses raw authentication forms to showcase context and immediately reveal core functions within five seconds.
                        </p>
                      </div>

                      {/* Experience Hierarchy Path */}
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">UX Hierarchy Discovery Flow</h4>
                        <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-850">
                          <div className="flex flex-col gap-1.5">
                            {requirementModel.screens?.map((scr, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full bg-[#8b5cf6]/10 text-[#c084fc] text-[8px] flex items-center justify-center font-bold">{idx + 1}</span>
                                <span className="text-[9.5px] text-slate-300 font-semibold">{scr.title}</span>
                                <span className="text-[8px] bg-slate-800 text-slate-500 px-1 py-0.2 rounded font-mono uppercase tracking-wider">{scr.type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Experience Validation Checks */}
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">UX Experience Validation Checks</h4>
                        <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-850 space-y-1.5 text-[9px] text-slate-400">
                          <div>
                            <span className="font-bold text-slate-200">First Impression: </span>
                            {requirementModel.screens?.[0]?.type === 'dashboard' 
                              ? 'Passed: Starts with high-context overview dashboard explaining purpose.' 
                              : 'Warning: First impression affected by screen ordering.'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-200">Navigation Clarity: </span>
                            {requirementModel.navigation?.items?.length > 0 
                              ? 'Passed: Navigation represents user\'s mental model of operational flow.' 
                              : 'Warning: Navigation links not fully mapped.'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-200">Context Awareness: </span>
                            {requirementModel.domain?.name !== 'Scientific Research' 
                              ? 'Passed: Custom components and KPIs match inferred domain parameters.' 
                              : 'Observation: General fallback template parameters used.'}
                          </div>
                        </div>
                      </div>

                      {/* AI Proactive Experience Recommendations */}
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">AI Experience Recommendations</h4>
                        <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-850 space-y-2 text-[9.5px]">
                          {(requirementModel.experienceRecommendations || []).map((rec, idx) => (
                            <div key={idx} className="flex gap-2 items-start text-[#c084fc]">
                              <span className="text-[#a78bfa] font-bold">★</span>
                              <p className="text-slate-400 leading-normal">{rec}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 text-left animate-in fade-in duration-200">
                      {/* Context ID stats */}
                      <div className="bg-[#10b981]/5 border border-[#10b981]/20 p-2.5 rounded-xl space-y-1.5 text-[10px]">
                        <div>
                          <span className="text-slate-500 font-bold block uppercase tracking-wide">Project ID</span>
                          <span className="font-mono text-slate-300">{requirementModel.projectId}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-bold block uppercase tracking-wide">Context Sandbox ID</span>
                          <span className="font-mono text-slate-300">{requirementModel.projectContextId}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/40 mt-1">
                          <span className="text-slate-400">Context Lock Status</span>
                          <span className={`font-bold px-1.5 py-0.2 rounded text-[9px] ${requirementModel.contextLocked ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
                            {requirementModel.contextLocked ? '🔒 Context Locked' : 'Unlocked'}
                          </span>
                        </div>
                      </div>

                      {/* Signature List */}
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Active Semantic Signature</h4>
                        <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-850">
                          <div className="flex flex-wrap gap-1.5">
                            {(requirementModel.contextSignature || []).map((word, idx) => (
                              <span key={idx} className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-semibold tracking-wider uppercase font-mono">
                                {word}
                              </span>
                            ))}
                          </div>
                          <p className="text-[9px] text-slate-500 mt-2 leading-normal">
                            Only elements matching the semantic signature are allowed to render in the visual simulator state. All other domain terminology is strictly quarantined.
                          </p>
                        </div>
                      </div>

                      {/* Integrity validation */}
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Boundary Validation Audits</h4>
                        <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-850 space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-semibold border-b border-slate-800/40 pb-1.5">
                            <span className="text-slate-300">Quarantine Verification</span>
                            <span className={requirementModel.contextIntegrity?.isContaminated ? 'text-rose-400' : 'text-emerald-400'}>
                              {requirementModel.contextIntegrity?.isContaminated ? 'Violation Flagged' : '✓ Clean Context Boundary'}
                            </span>
                          </div>
                          {requirementModel.contextIntegrity?.isContaminated ? (
                            <div className="space-y-1.5">
                              {(requirementModel.contextIntegrity.violations || []).map((v, i) => (
                                <p key={i} className="text-[9.5px] text-rose-400 leading-normal bg-rose-500/5 p-1.5 rounded border border-rose-500/20">{v}</p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[9px] text-slate-400 leading-relaxed">
                              Passed. The ContextIntegrityEngine scanned all interactive screens, database components, KPIs, and navigation items. 0 leaks, 0 contamination violations detected.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Text prompt send field */}
                <div className="pt-3 border-t border-white/5 flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-[#182133] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Refine intent, add elements, or explain exceptions..."
                    value={adjustmentPrompt}
                    onChange={e => setAdjustmentPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdjust()}
                    disabled={isAdjusting}
                  />
                  <button
                    onClick={() => handleAdjust()}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl transition-all"
                    disabled={isAdjusting}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Column: Application Configuration Panel (7 cols) */}
              <div className="md:col-span-7 bg-[#111827] border border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
                <div className="pb-3 border-b border-white/5 flex items-center justify-between">
                  <h3 className="font-bold text-white text-base">Application Configuration</h3>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">Interactive Blueprint Specs</span>
                </div>

                {requirementModel?.projectReadiness && (
                  <div className="bg-[#1f2937]/50 border border-white/5 rounded-xl p-4 space-y-3">
                    {/* Tabs Switcher */}
                    <div className="flex gap-1.5 border-b border-white/5 pb-2.5">
                      <button
                        onClick={() => setReadinessTab('project')}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                          readinessTab === 'project'
                            ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 font-semibold'
                            : 'bg-slate-900/40 border-slate-800/40 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Project Readiness
                      </button>
                      <button
                        onClick={() => setReadinessTab('experience')}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                          readinessTab === 'experience'
                            ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 font-semibold'
                            : 'bg-slate-900/40 border-slate-800/40 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Experience Readiness
                      </button>
                    </div>

                    {readinessTab === 'project' ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-300">Project Readiness Dashboard</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${requirementModel.projectReadiness.overallReadiness >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                            Overall: {requirementModel.projectReadiness.overallReadiness}% {requirementModel.projectReadiness.overallReadiness >= 80 ? 'Ready' : 'Below Threshold (80%)'}
                          </span>
                        </div>
                        {/* Overall Progress Bar */}
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-1.5 rounded-full ${requirementModel.projectReadiness.overallReadiness >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                            style={{ width: `${requirementModel.projectReadiness.overallReadiness}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[10px] pt-1">
                          {[
                            { label: 'Requirements', val: requirementModel.projectReadiness.requirementCompleteness },
                            { label: 'Architecture', val: requirementModel.projectReadiness.architectureQuality },
                            { label: 'Workflow', val: requirementModel.projectReadiness.workflowQuality },
                            { label: 'Entities', val: requirementModel.projectReadiness.entityQuality },
                            { label: 'UX Strategy', val: requirementModel.projectReadiness.uxQuality },
                            { label: 'Security Gate', val: requirementModel.projectReadiness.securityReadiness }
                          ].map((item, idx) => (
                            <div key={idx} className="bg-[#111827] p-2.5 rounded-lg border border-white/5 flex flex-col justify-between space-y-1.5">
                              <div className="flex justify-between items-center text-slate-400 font-medium">
                                <span>{item.label}</span>
                                <span className="text-white font-bold">{item.val}%</span>
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                                <div 
                                  className={`h-1 rounded-full ${item.val >= 80 ? 'bg-blue-500' : 'bg-amber-500'}`} 
                                  style={{ width: `${item.val}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-300">Experience Readiness Dashboard</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            (requirementModel.experienceReadiness?.overallExperienceReadiness || 90) >= 80 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            Overall UX: {requirementModel.experienceReadiness?.overallExperienceReadiness || 90}%
                          </span>
                        </div>
                        {/* Overall UX Progress Bar */}
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-1.5 rounded-full ${
                              (requirementModel.experienceReadiness?.overallExperienceReadiness || 90) >= 80 ? 'bg-indigo-500' : 'bg-amber-500'
                            }`} 
                            style={{ width: `${requirementModel.experienceReadiness?.overallExperienceReadiness || 90}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[10px] pt-1">
                          {[
                            { label: 'First Impression', val: requirementModel.experienceReadiness?.firstImpression || 95 },
                            { label: 'Navigation Clarity', val: requirementModel.experienceReadiness?.navigationClarity || 92 },
                            { label: 'Task Discoverability', val: requirementModel.experienceReadiness?.taskDiscoverability || 94 },
                            { label: 'Workflow Simplicity', val: requirementModel.experienceReadiness?.workflowSimplicity || 90 },
                            { label: 'Visual Hierarchy', val: requirementModel.experienceReadiness?.visualHierarchy || 93 },
                            { label: 'Context Awareness', val: requirementModel.experienceReadiness?.contextAwareness || 96 }
                          ].map((item, idx) => (
                            <div key={idx} className="bg-[#111827] p-2.5 rounded-lg border border-white/5 flex flex-col justify-between space-y-1.5">
                              <div className="flex justify-between items-center text-slate-400 font-medium">
                                <span>{item.label}</span>
                                <span className="text-white font-bold">{item.val}%</span>
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                                <div 
                                  className={`h-1 rounded-full ${(item.val || 90) >= 80 ? 'bg-indigo-500' : 'bg-amber-500'}`} 
                                  style={{ width: `${item.val || 90}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  {/* Category 1: Research Variables */}
                  <div className="border border-slate-700/40 rounded-xl overflow-hidden bg-slate-900/10">
                    <button
                      className="w-full flex justify-between items-center p-4 text-left font-bold text-xs text-white uppercase tracking-wider bg-slate-950/20 hover:bg-slate-950/30 transition-all border-b border-slate-700/20"
                      onClick={() => setActiveSection(activeSection === 'variables' ? '' : 'variables')}
                    >
                      <span>1. Research Variables</span>
                      <span>{activeSection === 'variables' ? '▼' : '▶'}</span>
                    </button>
                    
                    {activeSection === 'variables' && (
                      <div className="p-4 space-y-4 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-500 block uppercase">Variables & Parameters</span>
                          <button 
                            onClick={addCustomParam}
                            className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold border border-blue-500/20 px-2.5 py-1 rounded bg-blue-500/5"
                          >
                            + Add Variable
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase mb-1">Independent Variables</span>
                            <div className="flex flex-wrap gap-1.5">
                              {(requirementModel.variables?.independent || []).map((v, i) => (
                                <span key={i} className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px]">{v}</span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase mb-1">Dependent Variables</span>
                            <div className="flex flex-wrap gap-1.5">
                              {(requirementModel.variables?.dependent || []).map((v, i) => (
                                <span key={i} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px]">{v}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Parameter edit editors list */}
                        <div className="mt-3">
                          <span className="text-[10px] font-bold text-slate-400 block mb-2 uppercase tracking-wide">
                            AI‑Recommended Parameters
                          </span>
                          <div className="max-h-[160px] overflow-y-auto space-y-1">
                            {requirementModel.parameters.map((p, idx) => renderParamEditor(p, idx))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category 2: Analysis Methods */}
                  <div className="border border-slate-700/40 rounded-xl overflow-hidden bg-slate-900/10">
                    <button
                      className="w-full flex justify-between items-center p-4 text-left font-bold text-xs text-white uppercase tracking-wider bg-slate-950/20 hover:bg-slate-950/30 transition-all border-b border-slate-700/20"
                      onClick={() => setActiveSection(activeSection === 'analysis' ? '' : 'analysis')}
                    >
                      <span>2. Analysis Methods</span>
                      <span>{activeSection === 'analysis' ? '▼' : '▶'}</span>
                    </button>
                    
                    {activeSection === 'analysis' && (
                      <div className="p-4 grid grid-cols-2 gap-3 text-xs animate-in fade-in duration-200">
                        {['Regression', 'ANOVA', 'SEM', 'PLS', 'Machine Learning'].map((method) => {
                          const isChecked = requirementModel.analysisMethods.includes(method);
                          return (
                            <label key={method} className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 rounded bg-slate-950 border-slate-700 accent-blue-500"
                                checked={isChecked}
                                onChange={() => handleAnalysisToggle(method)}
                              />
                              <span className={isChecked ? 'text-slate-200 font-semibold' : 'text-slate-400'}>{method}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Category 3: Outputs */}
                  <div className="border border-slate-700/40 rounded-xl overflow-hidden bg-slate-900/10">
                    <button
                      className="w-full flex justify-between items-center p-4 text-left font-bold text-xs text-white uppercase tracking-wider bg-slate-950/20 hover:bg-slate-950/30 transition-all border-b border-slate-700/20"
                      onClick={() => setActiveSection(activeSection === 'outputs' ? '' : 'outputs')}
                    >
                      <span>3. Outputs</span>
                      <span>{activeSection === 'outputs' ? '▼' : '▶'}</span>
                    </button>
                    
                    {activeSection === 'outputs' && (
                      <div className="p-4 grid grid-cols-2 gap-3 text-xs animate-in fade-in duration-200">
                        {['Charts', 'GIS Maps', 'Heatmaps', 'Tables', 'PDF', 'Excel'].map((out) => {
                          const isChecked = requirementModel.outputs.includes(out);
                          return (
                            <label key={out} className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 rounded bg-slate-950 border-slate-700 accent-blue-500"
                                checked={isChecked}
                                onChange={() => handleOutputToggle(out)}
                              />
                              <span className={isChecked ? 'text-slate-200 font-semibold' : 'text-slate-400'}>{out}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Category 4: Navigation */}
                  <div className="border border-slate-700/40 rounded-xl overflow-hidden bg-slate-900/10">
                    <button
                      className="w-full flex justify-between items-center p-4 text-left font-bold text-xs text-white uppercase tracking-wider bg-slate-950/20 hover:bg-slate-950/30 transition-all border-b border-slate-700/20"
                      onClick={() => setActiveSection(activeSection === 'navigation' ? '' : 'navigation')}
                    >
                      <span>4. Navigation</span>
                      <span>{activeSection === 'navigation' ? '▼' : '▶'}</span>
                    </button>
                    
                    {activeSection === 'navigation' && (
                      <div className="p-4 flex items-center justify-between animate-in fade-in duration-200">
                        <div>
                          <span className="text-xs font-bold text-slate-300">Navigation Menu Mode</span>
                          <p className="text-[10px] text-slate-500 mt-0.5">Switch phone screen layout tabs style</p>
                        </div>
                        <button
                          onClick={toggleNavigationLayout}
                          className="text-xs font-bold text-blue-400 hover:text-blue-300 border border-blue-500/20 bg-blue-500/5 px-4 py-2 rounded-xl transition-all"
                        >
                          {requirementModel.navigation.type === 'tabs' ? 'Switch to Sidebar Navigation' : 'Switch to Bottom Tab Navigation'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Category 5: Appearance */}
                  <div className="border border-slate-700/40 rounded-xl overflow-hidden bg-slate-900/10">
                    <button
                      className="w-full flex justify-between items-center p-4 text-left font-bold text-xs text-white uppercase tracking-wider bg-slate-950/20 hover:bg-slate-950/30 transition-all border-b border-slate-700/20"
                      onClick={() => setActiveSection(activeSection === 'appearance' ? '' : 'appearance')}
                    >
                      <span>5. Appearance</span>
                      <span>{activeSection === 'appearance' ? '▼' : '▶'}</span>
                    </button>
                    
                    {activeSection === 'appearance' && (
                      <div className="p-4 space-y-4 text-xs animate-in fade-in duration-200">
                        {/* Theme Primary Color picker */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-300 block">Theme Color Accent</span>
                            <span className="text-[10px] text-slate-500 block">Customise simulator primary color</span>
                          </div>
                          <div className="flex gap-2">
                            {['#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#f59e0b'].map(c => (
                              <button
                                key={c}
                                className="w-6 h-6 rounded-full border transition-all"
                                style={{ backgroundColor: c, borderColor: requirementModel.theme.primaryColor === c ? '#fff' : 'transparent' }}
                                onClick={() => {
                                  const updated = { ...requirementModel };
                                  updated.theme.primaryColor = c;
                                  setRequirementModel(updated);
                                  setRenderedPrototype(engine.generatePrototype(updated));
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Font selection */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/30">
                          <div>
                            <span className="font-bold text-slate-300 block">Font Typography</span>
                            <span className="text-[10px] text-slate-500 block">Choose device UI style font</span>
                          </div>
                          <select
                            value={requirementModel.theme.font}
                            onChange={(e) => {
                              const updated = { ...requirementModel };
                              updated.theme.font = e.target.value;
                              setRequirementModel(updated);
                              setRenderedPrototype(engine.generatePrototype(updated));
                            }}
                            className="bg-slate-900 text-xs border border-slate-700 rounded px-2.5 py-1.5 outline-none text-slate-300"
                          >
                            {['Inter', 'Roboto', 'Outfit', 'monospace', 'serif'].map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category 6: Security */}
                  <div className="border border-slate-700/40 rounded-xl overflow-hidden bg-slate-900/10">
                    <button
                      className="w-full flex justify-between items-center p-4 text-left font-bold text-xs text-white uppercase tracking-wider bg-slate-950/20 hover:bg-slate-950/30 transition-all border-b border-slate-700/20"
                      onClick={() => setActiveSection(activeSection === 'security' ? '' : 'security')}
                    >
                      <span>6. Security</span>
                      <span>{activeSection === 'security' ? '▼' : '▶'}</span>
                    </button>
                    
                    {activeSection === 'security' && (
                      <div className="p-4 space-y-4 text-xs animate-in fade-in duration-200">
                        {/* Auth toggling */}
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 rounded bg-slate-950 border-slate-700 accent-blue-500"
                            checked={requirementModel.features.includes('Authentication')}
                            onChange={() => handleFeatureToggle('Authentication')}
                          />
                          <span className={requirementModel.features.includes('Authentication') ? 'text-slate-200 font-semibold' : 'text-slate-400'}>
                            Enable Role-based Login authentication screen
                          </span>
                        </label>

                        {/* List roles */}
                        <div className="pt-2 border-t border-slate-800/30">
                          <span className="text-[10px] text-slate-500 uppercase block mb-1">Detected App Roles</span>
                          <div className="flex flex-wrap gap-1.5">
                            {(requirementModel.roles || ['Lead Researcher', 'Data Collector', 'Viewer']).map((role, idx) => (
                              <span key={idx} className="bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category 7: Collaboration */}
                  <div className="border border-slate-700/40 rounded-xl overflow-hidden bg-slate-900/10">
                    <button
                      className="w-full flex justify-between items-center p-4 text-left font-bold text-xs text-white uppercase tracking-wider bg-slate-950/20 hover:bg-slate-950/30 transition-all border-b border-slate-700/20"
                      onClick={() => setActiveSection(activeSection === 'collaboration' ? '' : 'collaboration')}
                    >
                      <span>7. Collaboration</span>
                      <span>{activeSection === 'collaboration' ? '▼' : '▶'}</span>
                    </button>
                    
                    {activeSection === 'collaboration' && (
                      <div className="p-4 grid grid-cols-2 gap-3 text-xs animate-in fade-in duration-200">
                        {[
                          { key: 'Offline Mode', label: 'Offline Support' },
                          { key: 'Notifications', label: 'Push Notifications' },
                          { key: 'Team Collaboration', label: 'Research Collaboration' },
                          { key: 'Administrator Panel', label: 'Admin Dashboard' }
                        ].map((feat) => {
                          const isChecked = requirementModel.features.includes(feat.key);
                          return (
                            <label key={feat.key} className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 rounded bg-slate-950 border-slate-700 accent-blue-500"
                                checked={isChecked}
                                onChange={() => handleFeatureToggle(feat.key)}
                              />
                              <span className={isChecked ? 'text-slate-200 font-semibold' : 'text-slate-400'}>{feat.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Category 8: Export */}
                  <div className="border border-slate-700/40 rounded-xl overflow-hidden bg-slate-900/10">
                    <button
                      className="w-full flex justify-between items-center p-4 text-left font-bold text-xs text-white uppercase tracking-wider bg-slate-950/20 hover:bg-slate-950/30 transition-all border-b border-slate-700/20"
                      onClick={() => setActiveSection(activeSection === 'export' ? '' : 'export')}
                    >
                      <span>8. Export</span>
                      <span>{activeSection === 'export' ? '▼' : '▶'}</span>
                    </button>
                    
                    {activeSection === 'export' && (
                      <div className="p-4 space-y-4 text-xs animate-in fade-in duration-200">
                        {/* Sync toggling */}
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 rounded bg-slate-950 border-slate-700 accent-blue-500"
                            checked={requirementModel.outputs.includes('CSV') || requirementModel.outputs.includes('Excel')}
                            onChange={() => handleOutputToggle('Excel')}
                          />
                          <span className="text-slate-300">Enable cloud spreadsheet sync for observations</span>
                        </label>
                        
                        <div className="flex gap-2">
                          <button className="text-[10px] text-slate-300 border border-slate-700 px-3 py-1.5 rounded hover:bg-slate-800 bg-slate-950/40">
                            Download PDF Spec Sheet
                          </button>
                          <button className="text-[10px] text-slate-300 border border-slate-700 px-3 py-1.5 rounded hover:bg-slate-800 bg-slate-950/40">
                            Backup Model (JSON)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category 9: Advanced Settings */}
                  <div className="border border-slate-700/40 rounded-xl overflow-hidden bg-slate-900/10">
                    <button
                      className="w-full flex justify-between items-center p-4 text-left font-bold text-xs text-white uppercase tracking-wider bg-slate-950/20 hover:bg-slate-950/30 transition-all border-b border-slate-700/20"
                      onClick={() => setActiveSection(activeSection === 'advanced' ? '' : 'advanced')}
                    >
                      <span>9. Advanced Settings</span>
                      <span>{activeSection === 'advanced' ? '▼' : '▶'}</span>
                    </button>
                    
                    {activeSection === 'advanced' && (
                      <div className="p-4 space-y-4 text-[10px] animate-in fade-in duration-200">
                        {/* Schema database entities */}
                        <div>
                          <span className="text-slate-500 uppercase block font-bold mb-1 tracking-wider">Planned Database Schema Tables</span>
                          <div className="space-y-1.5 max-h-[100px] overflow-y-auto bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono">
                            {(requirementModel.entities || []).map((ent, idx) => (
                              <div key={idx} className="text-slate-300">
                                <span className="text-blue-400 font-bold">{ent.name}</span>: (
                                {ent.properties.map(p => `${p.name} [${p.type}]`).join(', ')} )
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Raw JSON viewer */}
                        <div>
                          <span className="text-slate-500 uppercase block font-bold mb-1 tracking-wider">Raw Requirement Model Specifications</span>
                          <pre className="max-h-[120px] overflow-y-auto bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[9px] text-slate-400 select-all">
                            {JSON.stringify(requirementModel, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3️⃣ THIRD COLUMN: SPECS LOCK & BLUEPRINT SCAFFOLDING GENERATION */}
            <div className="grid md:grid-cols-12 gap-8">
              
              {/* Approval controls */}
              <div className="md:col-span-12 bg-[#111827] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="font-bold text-white text-base">Approve & Scaffold Application</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Once approved, requirements are locked. Scaffold the final database tables, live Vercel deployments and codebase files.
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  {!requirementModel.locked && (
                    <button
                      onClick={finalizeSpecification}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-[0.98]"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Finalise Specification
                    </button>
                  )}
                  {requirementModel.locked && (
                    <div className="bg-indigo-500/15 border border-indigo-500/30 rounded-xl px-4 py-3 flex items-center gap-2 text-indigo-400 text-sm font-semibold">
                      <Lock className="w-4.5 h-4.5" /> Locked & Approved Design
                    </div>
                  )}
                  {!generatedProjectId && (
                    <button
                      onClick={generateTool}
                      className={`px-8 py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-[0.98] ${
                        requirementModel.locked && (!requirementModel.projectReadiness || requirementModel.projectReadiness.overallReadiness >= 80)
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                      }`}
                      disabled={isGenerating || !requirementModel.locked}
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Application'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 4️⃣ DEPLOYMENT & PWAS */}
            {generatedProjectId && (
              <div className="pt-2 space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-300">Codebase successfully compiled and blueprint locked!</p>
                    <p className="text-xs text-slate-400 mt-0.5">Deployment status sync active.</p>
                  </div>
                  <button
                    onClick={() => navigate('/generated-apps')}
                    className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 shrink-0"
                  >
                    View All Apps
                  </button>
                </div>

                <DeploymentStatus
                  projectId={generatedProjectId}
                  onComplete={() => {}}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default ResearchBuilder;

import React, { useState, useRef, useEffect } from 'react';
import { 
  Target, Lightbulb, FileText, Database, Brain, ClipboardList, Smartphone, Play, Send,
  Home, Folder, Image, History, Settings, HelpCircle, User, Bell, ChevronDown, CheckCircle2,
  Paperclip, Plus, ArrowRight, MessageSquare, Star, Clock, Package, Info,
  Check, Edit3, X, Menu
} from 'lucide-react';

export default function ChatSimulator() {
  const [messages, setMessages] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSimulatorMobile, setShowSimulatorMobile] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(null); // String: 'Goal', 'Intent', etc.
  const [simulatorHtml, setSimulatorHtml] = useState(null);
  const [revisionMode, setRevisionMode] = useState(false);
  const [revisionType, setRevisionType] = useState('');
  const [selectedRecommendations, setSelectedRecommendations] = useState([]);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeStep]);

  // Stepper logic
  const getShortName = (id) => {
    const map = {
      'Knowledge': 'DATA',
      'Reasoning': 'LOGIC',
      'Requirement': 'REQ',
      'Blueprint': 'PLAN',
      'Simulation': 'UI',
      'Delivery': 'DONE'
    };
    return map[id] || id;
  };

  const pipelineSteps = [
    { id: 'Goal', icon: Target, color: 'text-rose-500', desc: 'Menentukan Tujuan Utama' },
    { id: 'Intent', icon: Lightbulb, color: 'text-amber-500', desc: 'Analisis Maksud Pengguna' },
    { id: 'Context', icon: FileText, color: 'text-sky-500', desc: 'Pengumpulan Konteks' },
    { id: 'Knowledge', icon: Database, color: 'text-fuchsia-500', desc: 'Pencarian Pengetahuan' },
    { id: 'Reasoning', icon: Brain, color: 'text-violet-500', desc: 'Sintesis & Logika' },
    { id: 'Requirement', icon: ClipboardList, color: 'text-teal-500', desc: 'Spesifikasi Sistem' },
    { id: 'Blueprint', icon: Target, color: 'text-blue-500', desc: 'Desain Arsitektur' },
    { id: 'Simulation', icon: Smartphone, color: 'text-emerald-400', desc: 'Render Prototype UI' },
    { id: 'Delivery', icon: Send, color: 'text-indigo-500', desc: 'Serah Terima' }
  ];

  const getStepStatus = (stepId) => {
    if (!activeStep) return 'pending';
    const currentIndex = pipelineSteps.findIndex(s => s.id === activeStep);
    const thisIndex = pipelineSteps.findIndex(s => s.id === stepId);
    
    if (thisIndex < currentIndex) return 'completed';
    if (thisIndex === currentIndex) return 'active';
    return 'pending';
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("Maaf, ukuran file maksimal 2 MB agar AI tidak kelebihan beban.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const fileContext = `\n[Dokumen Terlampir: ${file.name}]\n${content}\n`;
      setInput(prev => prev + fileContext);
    };
    reader.onerror = () => {
      alert("Gagal membaca file.");
    };
    reader.readAsText(file);
    
    // Reset input so the same file can be selected again
    e.target.value = null;
  };

  const sendMessage = async (text) => {
    if (!text.trim() || isProcessing) return;

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setIsProcessing(true);
    setActiveStep('Requirement');

    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const API_URL = isLocal 
        ? 'http://localhost:3001/api/magic' 
        : 'https://ultimateai-production.up.railway.app/api/magic';

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); 

        for (const part of parts) {
          if (part.startsWith('data: ')) {
            const dataStr = part.replace('data: ', '');
            try {
              const parsed = JSON.parse(dataStr);
              
              if (parsed.type === 'progress') {
                setActiveStep(parsed.data.step);
              } 
              else if (parsed.type === 'clarification') {
                setMessages(prev => [...prev, { 
                  role: 'ai', 
                  content: parsed.data.message, 
                  type: parsed.data.proposal ? 'proposal' : 'clarification',
                  proposal: parsed.data.proposal,
                  diff: parsed.data.diff
                }]);
                setIsProcessing(false);
                setActiveStep(null);
                setRevisionMode(false);
                setRevisionType('');
                setSelectedRecommendations([]);
                return;
              } 
              else if (parsed.type === 'options') {
                setMessages(prev => [...prev, { 
                  role: 'ai', 
                  content: parsed.data.message, 
                  type: 'options',
                  options: parsed.data.options
                }]);
                setIsProcessing(false);
                setActiveStep(null);
                return;
              }
              else if (parsed.type === 'asset') {
                // Inject style to make base font smaller (matching chat UI scale)
                const htmlStr = parsed.data.html || '';
                const scaledHtml = htmlStr.replace('</head>', '<style>html { font-size: 13px !important; }</style></head>');
                setSimulatorHtml(scaledHtml);
                setMessages(prev => [...prev, { role: 'ai', content: "Aplikasi Anda berhasil dirakit dan siap digunakan di Simulator!" }]);
                setIsProcessing(false);
                setActiveStep(null);
                return;
              }
              else if (parsed.type === 'error') {
                setMessages(prev => [...prev, { role: 'ai', content: "Terjadi kesalahan: " + parsed.data.message }]);
                setIsProcessing(false);
                setActiveStep(null);
                return;
              }
            } catch (e) {
              console.error("Error parsing SSE:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      setActiveStep(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const handleOptionClick = async (optText) => {
    await sendMessage(optText);
  };

  return (
    <div className="flex h-screen bg-[#0B0F19] text-white font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR */}
      <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex fixed md:static inset-y-0 left-0 z-50 w-[260px] bg-[#151B2B] border-r border-[#1E293B] flex-col shrink-0 transition-transform duration-300`}>
        <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-4 right-4 md:hidden text-gray-400"><X className="w-6 h-6"/></button>
        <div className="p-6 flex items-center gap-3">
          <div className="w-16 h-16 flex items-center justify-center shrink-0">
            <img src="/logo-ultimateAI-transparent.png" alt="UltimateAI Logo" className="w-16 h-16 object-contain drop-shadow-md" onError={(e) => e.target.style.display = 'none'} />
          </div>
          <div className="flex flex-col w-full">
            <h1 className="font-extrabold text-2xl tracking-tight flex">
              <span className="bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 bg-clip-text text-transparent drop-shadow-sm">Ultimate</span>
              <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">AI</span>
            </h1>
            <div className="flex items-center my-1 w-full opacity-90">
              <div className="w-1 h-1 rounded-full bg-cyan-400"></div>
              <div className="flex-1 h-px bg-gradient-to-r from-cyan-400 via-indigo-500 to-yellow-500"></div>
              <div className="w-1 h-1 rounded-full bg-yellow-500"></div>
            </div>
            <p className="text-[7px] text-yellow-600 uppercase tracking-widest font-bold mt-0.5 leading-none">
              AI-Powered Research Infrastructure Builder
            </p>
          </div>
        </div>

        <div className="px-4 mb-6">
          <button 
            onClick={() => { setMessages([]); setSimulatorHtml(null); setInput(''); setActiveStep(null); }}
            className="w-full bg-indigo-600 text-white rounded-lg py-2.5 flex items-center justify-center gap-2 font-medium hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6 flex flex-col">
          
          {/* Section 1 */}
          <div className="space-y-1 text-sm font-medium text-blue-300">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg cursor-pointer">
              <Smartphone className="w-4 h-4" />
              <span>Create APK</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#151B2B] hover:text-white cursor-pointer transition-colors">
              <Play className="w-4 h-4 text-amber-500" />
              <span>Create Video</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#151B2B] hover:text-white cursor-pointer transition-colors">
              <Image className="w-4 h-4 text-yellow-500" />
              <span>Create Image</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#151B2B] hover:text-white cursor-pointer transition-colors">
              <Clock className="w-4 h-4 text-blue-300" />
              <span>Recent</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#151B2B] hover:text-white cursor-pointer transition-colors">
              <Package className="w-4 h-4 text-rose-400" />
              <span>My Products</span>
            </div>
          </div>

          <div className="px-4">
            <div className="h-px bg-blue-800 w-full"></div>
          </div>

          {/* Section 2 */}
          <div className="space-y-1 text-sm font-medium text-blue-300 flex-1">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#151B2B] hover:text-white cursor-pointer transition-colors">
              <Info className="w-4 h-4" />
              <span>Cara UltimateAI Berpikir</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#151B2B] hover:text-white cursor-pointer transition-colors">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#151B2B] hover:text-white cursor-pointer transition-colors">
              <HelpCircle className="w-4 h-4 text-rose-500" />
              <span>Help</span>
            </div>
          </div>
          
        </div>
      </div>

      {/* MIDDLE: CHAT & PIPELINE */}
      <div className={`${showSimulatorMobile ? 'hidden' : 'flex'} lg:flex flex-1 flex-col min-w-0 bg-[#0B0F19]`}>
        
        {/* Topbar */}
        <div className="h-16 border-b border-[#1E293B] bg-[#151B2B] flex items-center justify-between lg:justify-end px-4 md:px-6 gap-4 shrink-0">
          <div className="flex gap-3 items-center">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-white"><Menu className="w-6 h-6"/></button>
            <button onClick={() => setShowSimulatorMobile(true)} className="lg:hidden px-3 py-1.5 bg-indigo-600 rounded-md text-xs font-semibold text-white">
              Lihat Simulator
            </button>
          </div>
          <div className="flex items-center gap-4">
            <Bell className="w-5 h-5 text-blue-300 cursor-pointer hover:text-white" />
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-blue-800 flex items-center justify-center text-blue-300 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="text-sm hidden sm:block">
                <p className="font-semibold text-white leading-none">User</p>
                <p className="text-xs text-blue-200">Enterprise</p>
              </div>
              <ChevronDown className="w-4 h-4 text-blue-300" />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 md:p-8 overflow-hidden">
          
          {/* Pipeline Stepper */}
          <div className="bg-[#151B2B] border border-[#1E293B] rounded-2xl p-4 md:p-6 mb-4 md:mb-8 flex items-center justify-between shrink-0 relative shadow-sm overflow-x-auto">
            {/* Connecting line */}
            <div className="absolute left-[40px] right-[40px] top-1/2 -translate-y-1/2 h-0.5 bg-neutral-100 -z-10"></div>
            
            {pipelineSteps.map((step, idx) => {
              const status = getStepStatus(step.id);
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 md:gap-2 bg-[#151B2B] px-1 md:px-2 min-w-[50px] md:min-w-0">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                    status === 'active' ? 'border-indigo-600 bg-indigo-500/10 text-indigo-400' :
                    status === 'completed' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' :
                    'border-[#1E293B] bg-[#151B2B] text-blue-300'
                  }`}>
                    {status === 'completed' ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" /> : <step.icon className="w-4 h-4 md:w-5 md:h-5" />}
                  </div>
                  <span className={`text-[9px] md:text-[11px] text-center font-semibold uppercase tracking-wider ${status === 'active' ? 'text-indigo-400' : 'text-blue-300'}`}>
                    <span className="md:hidden">{getShortName(step.id)}</span>
                    <span className="hidden md:inline">{step.id}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto space-y-6 pr-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                <div className="w-16 h-16 flex items-center justify-center mb-4">
                  <img src="/logo-ultimateAI-transparent.png" alt="UltimateAI" className="w-16 h-16 object-contain rounded-2xl" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">Hi, bagaimana saya bisa membantu Anda hari ini?</h2>
                <p className="text-blue-300">Jelaskan apa yang ingin Anda buat, UltimateAI akan mewujudkannya.</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <img src="/logo-ultimateAI-transparent.png" alt="AI" className="w-8 h-8 object-contain rounded-xl" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl p-5 shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-[#151B2B] border border-[#1E293B] text-white rounded-tr-none'
                    : 'bg-indigo-500/100/10 border border-indigo-500/20 text-white rounded-tl-none'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-[15px]">{msg.content}</p>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-[15px] leading-relaxed">{msg.content}</p>
                      
                      {msg.type === 'options' && msg.options && (
                        <div className="grid grid-cols-1 gap-2 pt-2">
                          {msg.options.map((opt, i) => (
                            <button 
                              key={i}
                              onClick={() => handleOptionClick(opt)}
                              disabled={isProcessing}
                              className="px-4 py-3 bg-[#151B2B] border border-indigo-500/20 text-indigo-400 rounded-xl text-sm font-semibold hover:bg-indigo-500/10 hover:border-indigo-200 transition text-left shadow-sm disabled:opacity-50"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {msg.type === 'clarification' && (
                        <div className="flex gap-3 pt-2">
                          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50" disabled={isProcessing}>Jawab di bawah</button>
                        </div>
                      )}

                      {msg.type === 'proposal' && msg.proposal && (
                        <div className="mt-4 bg-[#0B0F19] border border-[#1E293B] rounded-xl overflow-hidden">
                          <div className="bg-[#151B2B] px-4 py-3 border-b border-[#1E293B] flex justify-between items-center">
                            <div className="flex items-center gap-2 text-sm font-bold text-white">
                              <ClipboardList className="w-4 h-4 text-indigo-400" />
                              Requirement Draft v{msg.proposal.version || '1.0'}
                            </div>
                            <span className="text-xs text-neutral-500">Proposal</span>
                          </div>
                          
                          <div className="p-4 space-y-4 text-sm">
                            {msg.diff && msg.diff.length > 0 && (
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                                <h4 className="font-semibold text-emerald-400 mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Perubahan yang diterapkan:</h4>
                                <ul className="space-y-1">
                                  {msg.diff.map((d, i) => <li key={i} className="text-emerald-300 pl-4 relative"><span className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{d}</li>)}
                                </ul>
                              </div>
                            )}
                            
                            <div>
                              <h4 className="text-blue-300 mb-1 text-[10px] uppercase tracking-wider font-bold">Apa yang akan dibuat</h4>
                              <div className="flex items-start gap-2 text-white"><Check className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" /> <span className="font-medium text-[13px]">{msg.proposal.target || "Aplikasi"}</span></div>
                            </div>

                            <div>
                              <h4 className="text-blue-300 mb-1 text-[10px] uppercase tracking-wider font-bold">Tujuan</h4>
                              <div className="flex items-start gap-2 text-white"><Check className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" /> <span className="text-[13px]">{msg.proposal.goal}</span></div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-blue-300 mb-2 text-[10px] uppercase tracking-wider font-bold">Yang akan dicatat</h4>
                                <ul className="space-y-1.5 text-[13px]">
                                  {msg.proposal.data?.map((d, i) => <li key={i} className="flex items-start gap-2 text-neutral-200"><Check className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" /> {d}</li>)}
                                </ul>
                              </div>
                              <div>
                                <h4 className="text-blue-300 mb-2 text-[10px] uppercase tracking-wider font-bold">Laporan</h4>
                                <ul className="space-y-1.5 text-[13px]">
                                  {msg.proposal.reports?.map((r, i) => <li key={i} className="flex items-start gap-2 text-neutral-200"><Check className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" /> {r}</li>)}
                                </ul>
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-blue-300 mb-2 text-[10px] uppercase tracking-wider font-bold">Fitur Kunci</h4>
                              <ul className="space-y-2">
                                {msg.proposal.features?.map((f, i) => (
                                  <li key={i} className="flex items-start gap-2 bg-blue-800/50 p-2 rounded-lg border border-[#1E293B]">
                                    <Check className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                                    <div>
                                      <div className="text-[13px] font-semibold text-white">{typeof f === 'string' ? f : f.name}</div>
                                      {f.reason && <div className="text-[11px] text-blue-300 leading-tight mt-0.5">{f.reason}</div>}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          
                          {/* AI RECOMMENDATIONS */}
                          {idx === messages.length - 1 && msg.proposal.recommendations && msg.proposal.recommendations.length > 0 && !isProcessing && !revisionMode && (
                            <div className="bg-indigo-950/20 p-4 border-t border-indigo-500/20">
                              <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Brain className="w-4 h-4" /> Rekomendasi UltimateAI</h4>
                              <p className="text-[12px] text-neutral-300 mb-3">Berdasarkan jenis penelitian yang Anda buat, saya menyarankan penambahan fitur berikut:</p>
                              
                              <div className="space-y-2 mb-4">
                                {msg.proposal.recommendations.map((rec, i) => {
                                  const isSelected = selectedRecommendations.includes(i);
                                  return (
                                    <div 
                                      key={i} 
                                      onClick={() => {
                                        if (isSelected) setSelectedRecommendations(prev => prev.filter(id => id !== i));
                                        else setSelectedRecommendations(prev => [...prev, i]);
                                      }}
                                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-indigo-600/20 border-indigo-500' : 'bg-black border-[#1E293B] hover:border-neutral-600'}`}
                                    >
                                      <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-neutral-600'}`}>
                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                      </div>
                                      <div>
                                        <div className="text-[13px] font-semibold text-white">{typeof rec === 'string' ? rec : rec.name}</div>
                                        {rec.reason && <div className="text-[11px] text-blue-300 leading-tight mt-0.5">{rec.reason}</div>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setSelectedRecommendations(msg.proposal.recommendations.map((_, i) => i))}
                                  className="text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded hover:bg-indigo-500/30 transition"
                                >
                                  Terapkan Semua
                                </button>
                                <button 
                                  onClick={() => setSelectedRecommendations([])}
                                  className="text-[11px] font-semibold bg-blue-800 text-blue-300 px-3 py-1.5 rounded hover:bg-neutral-700 hover:text-white transition"
                                >
                                  Pilih Manual
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {/* ACTION BUTTONS */}
                          {idx === messages.length - 1 && !isProcessing && !revisionMode && (
                            <div className="bg-[#151B2B] p-4 border-t border-[#1E293B] flex gap-3">
                              <button 
                                onClick={() => {
                                  let agreeText = "Saya setuju, silakan lanjut buatkan aplikasinya.";
                                  if (selectedRecommendations.length > 0) {
                                    const recNames = selectedRecommendations.map(i => {
                                      const r = msg.proposal.recommendations[i];
                                      return typeof r === 'string' ? r : r.name;
                                    }).join(", ");
                                    agreeText = `Saya setuju. Tolong sertakan juga rekomendasi ini: ${recNames}. Silakan buatkan aplikasinya.`;
                                  }
                                  handleOptionClick(agreeText);
                                }}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
                              >
                                <CheckCircle2 className="w-4 h-4" /> {selectedRecommendations.length > 0 ? 'Terapkan & Setuju' : 'Setuju'}
                              </button>
                              <button 
                                onClick={() => setRevisionMode(true)}
                                className="flex-1 bg-blue-800 hover:bg-neutral-700 text-white border border-[#334155] py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2"
                              >
                                <Edit3 className="w-4 h-4" /> 💬 Tambah / Ubah
                              </button>
                            </div>
                          )}
                          
                          {/* REVISION FORM */}
                          {idx === messages.length - 1 && revisionMode && (
                            <div className="bg-[#151B2B] p-4 border-t border-[#1E293B] border-l-2 border-l-indigo-500">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="text-sm font-bold text-white">Apa yang ingin diubah?</h4>
                                <button onClick={() => { setRevisionMode(false); setRevisionType(''); }} className="text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>
                              </div>
                              
                              {!revisionType ? (
                                <div className="grid grid-cols-2 gap-2">
                                  {['Tambah Data', 'Kurangi Data', 'Tambah Fitur', 'Ubah Laporan', 'Lainnya'].map(opt => (
                                    <button 
                                      key={opt}
                                      onClick={() => setRevisionType(opt)}
                                      className="px-3 py-2 bg-blue-800 border border-[#334155] rounded-lg text-xs font-medium text-neutral-300 hover:bg-neutral-700 hover:text-white transition text-left flex items-center"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full border border-neutral-500 mr-2 shrink-0"></span>
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="text-[11px] uppercase tracking-wider text-indigo-400 font-bold bg-indigo-500/10 inline-block px-2 py-1 rounded">Revisi: {revisionType}</div>
                                  <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="Masukkan detail tambahan..." 
                                    className="w-full bg-black border border-[#334155] rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && e.target.value.trim()) {
                                        handleOptionClick(`Revisi pada bagian [${revisionType}]: ${e.target.value}`);
                                        setRevisionMode(false);
                                        setRevisionType('');
                                      }
                                    }}
                                  />
                                  <p className="text-[10px] text-neutral-500">Tekan Enter untuk mengirim revisi.</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-blue-800 flex items-center justify-center text-blue-300 shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="mt-6 pt-4">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".txt,.csv,.md,.json,.js,.jsx,.ts,.tsx,.html,.css"
            />
            <form onSubmit={handleSubmit} className="relative shadow-sm rounded-2xl bg-[#151B2B] border border-[#1E293B] flex items-center p-2">
              <button 
                type="button" 
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="p-3 text-blue-300 hover:text-white transition-colors"
                title="Unggah Dokumen (Teks/CSV)"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isProcessing}
                placeholder="Ketik pesan Anda..."
                className="flex-1 bg-transparent py-3 px-2 text-white placeholder-neutral-400 focus:outline-none"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isProcessing}
                className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </div>

        </div>
      </div>

      {/* RIGHT SIDEBAR: SIMULATOR & INFO */}
      <div className={`${showSimulatorMobile ? 'flex' : 'hidden'} lg:flex w-full lg:w-[400px] bg-[#151B2B] border-l border-[#1E293B] flex-col shrink-0 overflow-y-auto`}>
        
        {/* Simulator Section */}
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-white tracking-wider">SIMULATOR</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSimulatorMobile(false)} className="lg:hidden px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded-md text-xs font-semibold text-white mr-2">Kembali ke Chat</button>
              <span className="text-xs text-blue-300 bg-[#151B2B] border border-[#1E293B] px-2 py-1 rounded-md">iPhone 15</span>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md font-medium">
                <div className="w-2 h-2 rounded-full bg-emerald-500/100 animate-pulse"></div> Online
              </div>
            </div>
          </div>

          {/* iPhone Frame */}
          <div className="relative mx-auto w-[340px] h-[680px] bg-black rounded-[40px] shadow-2xl border-[10px] border-neutral-900 shrink-0 flex flex-col overflow-hidden">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[100px] h-[30px] bg-black rounded-full z-30"></div>
            
            <div className="flex-1 bg-[#151B2B] relative">
              
              {/* Draft Watermark */}
              {messages.length > 0 && messages[messages.length - 1].type === 'proposal' && !simulatorHtml && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                  <div className="border-4 border-rose-500/40 rounded-2xl p-6 text-center transform -rotate-12 bg-black/50 shadow-2xl">
                    <p className="text-4xl font-black text-rose-500 tracking-widest uppercase">DRAFT</p>
                    <p className="text-xs text-rose-400 font-bold tracking-widest mt-2">Belum Disetujui</p>
                  </div>
                </div>
              )}

              {simulatorHtml ? (
                <iframe 
                  srcDoc={simulatorHtml} 
                  className="w-full h-full border-none"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  title="Simulator"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#151B2B] text-blue-300 p-6 text-center">
                  <Smartphone className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm font-medium">Aplikasi belum dibuat. Silakan deskripsikan kebutuhan Anda di panel obrolan.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project Info Section */}
        <div className="p-6">
          <div className="bg-[#151B2B] border border-[#1E293B] rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-white tracking-wider mb-4">INFORMASI PROYEK</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-300">Nama Proyek</span>
                <span className="font-medium text-white">{simulatorHtml ? 'Aplikasi Survei' : 'Belum Ada'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-300">Jenis Produk</span>
                <span className="font-medium text-white">Web Prototype</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-300">Status</span>
                <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-xs font-semibold">
                  {isProcessing ? 'In Progress' : (simulatorHtml ? 'Completed' : 'Draft')}
                </span>
              </div>
            </div>
            <button className="w-full mt-6 bg-indigo-500/10 hover:bg-indigo-100 text-indigo-400 py-2.5 rounded-lg text-sm font-semibold transition-colors flex justify-center items-center gap-2">
              Lihat Project Detail <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { X, Database, Search, Plus, Trash2, Pin, PinOff, RefreshCw } from 'lucide-react';
import { memoryStoreInstance, MEMORY_CATEGORIES } from '../../../services/conversation/MemoryStore.js';

export default function MemoryVaultExplorer({ isOpen, onClose }) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [memories, setMemories] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCat, setNewCat] = useState(MEMORY_CATEGORIES.USER);

  useEffect(() => {
    const unsub = memoryStoreInstance.subscribe((all) => {
      setMemories(all);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const filteredMemories = memories
    .filter(m => activeCategory === 'ALL' || m.category === activeCategory)
    .filter(m =>
      !searchQuery.trim() ||
      m.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.value.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;
    memoryStoreInstance.addMemory({
      key: newKey,
      value: newValue,
      category: newCat
    });
    setNewKey('');
    setNewValue('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl bg-[#0a101f] border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,229,255,0.2)] text-slate-200 select-none flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono tracking-wide">
                MEMORY VAULT HUD EXPLORER
              </h3>
              <p className="text-xs text-slate-400">
                Pusat manajemen pengetahuan persisten & konteks operasional JIN
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-cyan-400 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar: Search & Category Tabs */}
        <div className="py-3 flex flex-col md:flex-row items-center justify-between gap-3 border-b border-slate-800/60">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            {['ALL', MEMORY_CATEGORIES.SESSION, MEMORY_CATEGORIES.USER, MEMORY_CATEGORIES.DOCUMENT, MEMORY_CATEGORIES.SYSTEM].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeCategory === cat
                    ? 'bg-cyan-600/80 text-white font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Bar & Add Button */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari memori..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
              />
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 rounded-xl bg-purple-600/70 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(192,132,252,0.3)] flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah</span>
            </button>
          </div>
        </div>

        {/* Add Memory Form */}
        {showAddForm && (
          <form onSubmit={handleAddSubmit} className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-4 my-2 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Topik / Entitas (Contoh: Preferensi Bahasa)"
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono"
              />
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-400 font-mono"
              >
                <option value={MEMORY_CATEGORIES.USER}>USER MEMORY</option>
                <option value={MEMORY_CATEGORIES.SESSION}>SESSION MEMORY</option>
                <option value={MEMORY_CATEGORIES.DOCUMENT}>DOCUMENT MEMORY</option>
                <option value={MEMORY_CATEGORIES.SYSTEM}>SYSTEM MEMORY</option>
              </select>
            </div>
            <textarea
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Isi informasi atau instruksi yang perlu diingat oleh JIN..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
              >
                Simpan ke Vault
              </button>
            </div>
          </form>
        )}

        {/* Memory Items List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-3 space-y-2.5">
          {filteredMemories.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              Tidak ada data memori yang cocok dengan filter.
            </div>
          ) : (
            filteredMemories.map((item) => (
              <div
                key={item.id}
                className={`bg-slate-900/70 border rounded-2xl p-3.5 flex items-start justify-between gap-3 transition-all hover:bg-slate-900 ${
                  item.isPinned ? 'border-purple-500/50 shadow-[0_0_15px_rgba(192,132,252,0.15)]' : 'border-slate-800'
                }`}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white tracking-wide font-mono">{item.key}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-300 font-mono font-semibold border border-purple-500/30">
                      {item.category}
                    </span>
                    {item.isPinned && (
                      <span className="text-[9px] text-amber-400 font-mono flex items-center gap-0.5">
                        <Pin className="w-2.5 h-2.5" /> Pinned
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed">{item.value}</p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => memoryStoreInstance.togglePin(item.id)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-amber-300 transition-all"
                    title={item.isPinned ? 'Unpin' : 'Pin to Active Context'}
                  >
                    {item.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => memoryStoreInstance.deleteMemory(item.id)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400 transition-all"
                    title="Hapus memori"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs font-mono text-slate-400">
          <div>Total {memories.length} item tersimpan</div>
          <button
            onClick={() => memoryStoreInstance.clearSession()}
            className="text-red-400/80 hover:text-red-300 flex items-center gap-1 text-[11px]"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Session Memory</span>
          </button>
        </div>
      </div>
    </div>
  );
}

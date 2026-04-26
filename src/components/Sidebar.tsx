import React from 'react';
import { BookOpen, BookText, Bot, LayoutDashboard, Settings } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  pieceSet: string;
  setPieceSet: (set: string) => void;
}

export function Sidebar({ currentView, setCurrentView, pieceSet, setPieceSet }: SidebarProps) {
  const navItems = [
    { id: 'home', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'lessons', label: 'Lessons', icon: <BookOpen size={20} /> },
    { id: 'tutor', label: 'AI Tutor', icon: <Bot size={20} /> },
  ];

  return (
    <div className="w-64 backdrop-blur-xl bg-white/5 flex flex-col h-full border-r border-white/10 relative z-20">
      <div className="p-6 border-b border-white/10 flex items-center justify-start h-16">
        <h1 className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center font-bold text-xl text-white">♞</div>
          <span className="text-xl font-bold tracking-tight text-white">CHESSMASTER <span className="text-indigo-400 italic">PRO</span></span>
        </h1>
      </div>
      
      <nav className="flex-1 py-6 px-4 space-y-2 relative z-30 text-white">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              currentView === item.id 
                ? 'bg-white/10 border border-white/20 text-white shadow-lg' 
                : 'hover:bg-white/5 text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {item.icon}
            <span className="font-bold text-sm tracking-wide">{item.label}</span>
          </button>
        ))}
      </nav>
      
      <div className="p-6 border-t border-white/10 relative z-30">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block flex items-center gap-2">
          <Settings size={14} /> Options
        </label>
        <div className="space-y-2">
          <div className="text-xs text-slate-400 font-medium ml-1">Piece Set</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'fresca', name: 'Fresca' },
              { id: 'cburnett', name: 'Classic' },
              { id: 'alpha', name: 'Alpha' },
              { id: 'merida', name: 'Merida' },
              { id: 'california', name: 'Calif.' },
              { id: 'staunty', name: 'Staunty' },
            ].map((set) => (
              <button
                key={set.id}
                onClick={() => setPieceSet(set.id)}
                title={set.name}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 relative overflow-hidden group ${
                  pieceSet === set.id 
                    ? 'bg-indigo-600/40 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105 z-10' 
                    : 'bg-black/40 border-white/10 hover:bg-white/10 hover:border-white/30'
                }`}
              >
                {pieceSet === set.id && (
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent pointer-events-none" />
                )}
                <img 
                  src={`https://lichess1.org/assets/piece/${set.id}/wN.svg`} 
                  alt={set.name} 
                  className={`w-8 h-8 mb-1 transition-all duration-300 ${pieceSet === set.id ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] opacity-100 scale-110' : 'opacity-70 scale-95 group-hover:scale-100 group-hover:opacity-100'}`} 
                />
                <span className={`text-[10px] font-extrabold uppercase tracking-widest mt-1 transition-colors ${pieceSet === set.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                  {set.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

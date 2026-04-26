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
        <div className="space-y-1">
          <div className="text-xs text-slate-400 font-medium ml-1 mb-1">Piece Set</div>
          <select 
            value={pieceSet} 
            onChange={(e) => setPieceSet(e.target.value)}
            className="w-full bg-black/20 border border-white/10 text-white rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:bg-black/40 text-sm font-medium transition-colors cursor-pointer appearance-none"
          >
            <option value="fresca" className="bg-slate-800">Fresca (3D)</option>
            <option value="cburnett" className="bg-slate-800">Classic (cburnett)</option>
            <option value="alpha" className="bg-slate-800">Alpha</option>
            <option value="merida" className="bg-slate-800">Merida</option>
            <option value="california" className="bg-slate-800">California</option>
            <option value="staunty" className="bg-slate-800">Staunty</option>
          </select>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { BookOpen, BookText, Bot, LayoutDashboard, Settings } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
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
      
      <div className="p-4 border-t border-white/10 text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:text-white transition-colors relative z-30">
        <Settings size={16} />
        <span>Settings</span>
      </div>
    </div>
  );
}

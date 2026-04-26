import React from 'react';
import { BookOpen, Brain, Target, ArrowRight } from 'lucide-react';

interface HomeDashboardProps {
  setCurrentView: (view: string) => void;
}

export function HomeDashboard({ setCurrentView }: HomeDashboardProps) {
  return (
    <div className="max-w-5xl mx-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-30">
      <header className="mb-12">
        <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">Welcome to ChessMaster Academy</h1>
        <p className="text-lg text-slate-300 max-w-2xl">
          Master the game of kings step-by-step. Go through interactive lessons to learn the basics, or practice in the sandbox with our Gemini AI Tutor.
        </p>
      </header>
      
      <div className="grid md:grid-cols-2 gap-6 relative">
        <div 
          onClick={() => setCurrentView('lessons')}
          className="group relative backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer overflow-hidden text-white"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none" />
          <div className="relative">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
              <BookOpen size={28} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Interactive Lessons</h2>
            <p className="text-slate-400 mb-6 font-medium leading-relaxed">
              Learn how the pieces move, fundamental tactics, and checkmating patterns with bite-sized, interactive challenges.
            </p>
            <div className="flex items-center text-indigo-400 font-bold text-sm uppercase tracking-widest group-hover:translate-x-1 transition-transform">
              Start Learning <ArrowRight size={18} className="ml-2" />
            </div>
          </div>
        </div>

        <div 
          onClick={() => setCurrentView('tutor')}
          className="group relative backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer overflow-hidden text-white"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none" />
          <div className="relative">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
              <Brain size={28} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">AI Tutor Play</h2>
            <p className="text-slate-400 mb-6 font-medium leading-relaxed">
              Play a free-form game analyzing different lines. Ask the Gemini-powered AI Tutor to evaluate the board or suggest the best moves.
            </p>
            <div className="flex items-center text-purple-400 font-bold text-sm uppercase tracking-widest group-hover:translate-x-1 transition-transform">
              Launch Sandbox <ArrowRight size={18} className="ml-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { HomeDashboard } from './components/HomeDashboard';
import { LessonMode } from './components/LessonMode';
import { AITutorMode } from './components/AITutorMode';

export default function App() {
  const [currentView, setCurrentView] = useState('home');

  return (
    <div className="relative flex h-screen bg-[#0f172a] text-white font-sans overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-transparent to-blue-900/40 pointer-events-none z-0"></div>
      <div className="absolute top-[-100px] left-[-100px] w-80 h-80 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      
      {/* Main Layout */}
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      
      <main className="flex-1 overflow-y-auto relative z-10">
        {currentView === 'home' && <HomeDashboard setCurrentView={setCurrentView} />}
        {currentView === 'lessons' && <LessonMode />}
        {currentView === 'tutor' && <AITutorMode />}
      </main>
    </div>
  );
}

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { getChessAdvice } from '../lib/gemini';
import { Bot, Send, User, Loader2, PlaySquare, RefreshCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { 
  customBoardStyle, 
  customDarkSquareStyle, 
  customLightSquareStyle, 
  customDropSquareStyle, 
  piecesConfig 
} from '../lib/boardStyle';

interface ChatMessage {
  role: 'user' | 'tutor';
  content: string;
}

export function AITutorMode() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const customPieces = useMemo(() => piecesConfig(), []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chat]);

  function onDrop(sourceSquare: string, targetSquare: string) {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (move === null) return false;
      setFen(game.fen());
      
      // Optionally auto-prompt AI here, but let's leave it to manual questions for better UX
      return true;
    } catch (e) {
      return false;
    }
  }

  function resetBoard() {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setChat([]);
  }

  async function handleSend() {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput("");
    setChat(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    const advice = await getChessAdvice(fen, userMessage);
    
    setChat(prev => [...prev, { role: 'tutor', content: advice }]);
    setIsTyping(false);
  }

  async function handleQuickAction(action: 'evaluate' | 'suggest') {
    if (isTyping) return;
    
    const question = action === 'evaluate' 
      ? "Can you evaluate the current position? Who is better and why?"
      : "What is the best move in this position and why?";
      
    setInput(question);
    
    // We can simulate an instant send rather than just populating input
    setChat(prev => [...prev, { role: 'user', content: question }]);
    setIsTyping(true);
    
    const advice = await getChessAdvice(fen, question);
    
    setChat(prev => [...prev, { role: 'tutor', content: advice }]);
    setIsTyping(false);
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col xl:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-4rem)] relative z-30">
      {/* Board Column */}
      <div className="flex-1 max-w-[600px] mx-auto w-full flex flex-col gap-6">
        <div className="backdrop-blur-md bg-white/5 p-4 md:p-6 rounded-3xl border border-white/10 shadow-2xl flex-1 flex flex-col justify-center">
          <Chessboard 
            position={fen} 
            onPieceDrop={onDrop}
            animationDuration={300}
            customBoardStyle={customBoardStyle}
            customDarkSquareStyle={customDarkSquareStyle}
            customLightSquareStyle={customLightSquareStyle}
            customDropSquareStyle={customDropSquareStyle}
            customPieces={customPieces}
          />
        </div>
        <div className="flex justify-between items-center backdrop-blur-md bg-white/5 px-6 py-4 rounded-2xl border border-white/10 shadow-lg">
           <span className="font-mono text-sm text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap mr-4">FEN: {fen}</span>
           <button 
             onClick={resetBoard}
             className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-xl transition-colors shrink-0"
           >
             <RefreshCcw size={16} /> Reset
           </button>
        </div>
      </div>

      {/* Chat Column */}
      <div className="flex-1 flex flex-col backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl shadow-2xl overflow-hidden h-[600px] xl:h-auto">
        <div className="bg-white/5 border-b border-white/10 p-4 flex items-center justify-between shadow-sm z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Bot size={24} className="text-indigo-400" />
            <h2 className="font-bold text-lg text-white">AI Tutor</h2>
          </div>
          <div className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-full uppercase tracking-widest border border-indigo-500/20">
            Gemini Powered
          </div>
        </div>

        {/* Chat Messages */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-transparent">
          {chat.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
              <Bot size={48} className="text-slate-500 mb-4 opacity-50" />
              <p className="text-lg font-bold text-slate-300 mb-2">I'm your AI Chess Tutor</p>
              <p className="max-w-xs text-sm text-slate-400 font-medium">
                Make a move on the board, and ask me to evaluate the position or suggest a move!
              </p>
            </div>
          ) : (
            chat.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300' : 'bg-white/10 border border-white/20 text-white'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`max-w-[85%] px-5 py-4 ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600/80 backdrop-blur-md text-white rounded-2xl rounded-tr-none shadow-lg border border-indigo-500/50' 
                    : 'backdrop-blur-md bg-white/5 border border-white/10 text-slate-200 rounded-2xl rounded-tl-none shadow-lg prose prose-sm prose-invert prose-p:leading-relaxed prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10'
                }`}>
                  {msg.role === 'tutor' ? (
                     <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                     <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {isTyping && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl rounded-tl-none px-5 py-4 shadow-lg flex items-center gap-2 text-slate-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm font-medium">Analyzing position...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white/5 backdrop-blur-md border-t border-white/10">
          {/* Quick Actions */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
            <button 
              onClick={() => handleQuickAction('evaluate')}
              disabled={isTyping}
              className="whitespace-nowrap flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase tracking-widest rounded-xl px-4 py-2 transition-colors disabled:opacity-50"
            >
              Evaluate Position
            </button>
            <button 
              onClick={() => handleQuickAction('suggest')}
              disabled={isTyping}
              className="whitespace-nowrap flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase tracking-widest rounded-xl px-4 py-2 transition-colors disabled:opacity-50"
            >
              Suggest Best Move
            </button>
          </div>

          <div className="relative flex items-center">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about the position..."
              disabled={isTyping}
              className="w-full pl-4 pr-12 py-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 transition-all disabled:opacity-50 placeholder-slate-500 font-medium text-white"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700/50 text-white rounded-lg transition-colors border border-indigo-500/50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

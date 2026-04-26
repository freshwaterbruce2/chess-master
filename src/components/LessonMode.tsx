import React, { useState, useEffect, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { LESSONS } from '../lib/lessons';
import { CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { 
  customBoardStyle, 
  customDarkSquareStyle, 
  customLightSquareStyle, 
  customDropSquareStyle, 
  piecesConfig 
} from '../lib/boardStyle';

export function LessonMode() {
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [game, setGame] = useState(new Chess(LESSONS[0].initialFen));
  const [fen, setFen] = useState(LESSONS[0].initialFen);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const lesson = LESSONS[currentLessonIndex];
  
  // Memoize custom pieces so we don't recreate them every render
  const customPieces = useMemo(() => piecesConfig(), []);

  useEffect(() => {
    const newGame = new Chess(lesson.initialFen);
    setGame(newGame);
    setFen(newGame.fen());
    setIsSuccess(false);
    setErrorMsg("");
  }, [currentLessonIndex, lesson]);

  function makeMove(move: { from: string; to: string; promotion?: string }) {
    if (isSuccess) return false;
    
    try {
      const moveResult = game.move(move);
      
      if (moveResult === null) return false;

      setFen(game.fen());

      if (lesson.targetMove) {
        if (moveResult.san === lesson.targetMove) {
          setIsSuccess(true);
          setErrorMsg("");
        } else {
          setErrorMsg(`Good try, but "${moveResult.san}" isn't the move we are looking for. Try again!`);
          setTimeout(() => {
            game.undo();
            setFen(game.fen());
            setErrorMsg("");
          }, 1500);
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function onDrop(sourceSquare: string, targetSquare: string) {
    const move = makeMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q', // always promote to a queen for simplicity
    });
    return move;
  }

  function nextLesson() {
    if (currentLessonIndex < LESSONS.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    }
  }

  function retryLesson() {
    const newGame = new Chess(lesson.initialFen);
    setGame(newGame);
    setFen(newGame.fen());
    setIsSuccess(false);
    setErrorMsg("");
  }

  return (
    <div className="max-w-6xl mx-auto p-8 flex flex-col lg:flex-row gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-30">
      <div className="flex-1 max-w-[600px] backdrop-blur-md bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
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
      
      <div className="flex-1 flex flex-col justify-center">
        <div className="inline-flex items-center text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 bg-indigo-500/20 px-3 py-1.5 rounded-full w-max border border-indigo-500/20">
          Lesson {currentLessonIndex + 1} of {LESSONS.length}
        </div>
        <h2 className="text-3xl font-bold text-white mb-6 tracking-tight">{lesson.title}</h2>
        <div className="prose prose-slate prose-invert text-lg mb-8 leading-relaxed text-slate-300 font-medium">
          <p>{lesson.description}</p>
        </div>

        {errorMsg && (
          <div className="p-4 mb-6 backdrop-blur-md bg-amber-500/10 text-amber-200 border border-amber-500/20 rounded-2xl animate-in slide-in-from-top-2 font-medium">
            {errorMsg}
          </div>
        )}

        {isSuccess ? (
          <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl animate-in slide-in-from-bottom-2 fade-in shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-400 font-bold text-xl mb-3">
              <CheckCircle2 size={24} />
              Lesson Completed!
            </div>
            <p className="text-emerald-200/80 mb-6 font-medium leading-relaxed">
              {lesson.successMessage}
            </p>
            {currentLessonIndex < LESSONS.length - 1 && (
              <button 
                onClick={nextLesson}
                className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-wide rounded-xl shadow-lg border border-emerald-400/20 transition-colors"
              >
                Next Lesson <ChevronRight size={18} />
              </button>
            )}
          </div>
        ) : (
          <button 
            onClick={retryLesson}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 font-bold uppercase tracking-widest rounded-xl shadow-lg transition-colors w-max text-xs"
          >
            <RefreshCw size={16} /> Restart Position
          </button>
        )}
      </div>
    </div>
  );
}

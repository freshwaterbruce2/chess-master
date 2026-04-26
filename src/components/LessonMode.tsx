import React, { useState, useEffect, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { LESSONS } from '../lib/lessons';
import { CheckCircle2, ChevronRight, RefreshCw, RefreshCcw } from 'lucide-react';
import { 
  customBoardStyle, 
  customDarkSquareStyle, 
  customLightSquareStyle, 
  customDropSquareStyle, 
  piecesConfig 
} from '../lib/boardStyle';

export function LessonMode({ pieceSet }: { pieceSet: string }) {
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [game, setGame] = useState(new Chess(LESSONS[0].initialFen));
  const [fen, setFen] = useState(LESSONS[0].initialFen);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [promotionMove, setPromotionMove] = useState<{from: string, to: string} | null>(null);

  const lesson = LESSONS[currentLessonIndex];
  
  // Memoize custom pieces so we don't recreate them every render
  const customPieces = useMemo(() => piecesConfig(pieceSet), [pieceSet]);

  useEffect(() => {
    const newGame = new Chess(lesson.initialFen);
    setGame(newGame);
    setFen(newGame.fen());
    setIsSuccess(false);
    setErrorMsg("");
    setMoveFrom(null);
    setOptionSquares({});
  }, [currentLessonIndex, lesson]);

  function getMoveOptions(square: string) {
    const moves = game.moves({ square: square as any, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: Record<string, React.CSSProperties> = {};
    moves.map((move: any) => {
      newSquares[move.to] = {
        background:
          game.get(move.to as any) && game.get(move.to as any)?.color !== game.get(square as any)?.color
            ? 'radial-gradient(transparent 0%, transparent 60%, rgba(0,0,0,0.4) 61%, rgba(0,0,0,0.4) 80%, transparent 81%)'
            : 'radial-gradient(circle, rgba(0,0,0,.4) 22%, transparent 23%)',
        borderRadius: '50%',
      };
      return move;
    });
    newSquares[square] = {
      background: 'rgba(255, 215, 0, 0.4)', // Highlight selected square
    };
    setOptionSquares(newSquares);
    return true;
  }

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

  function onSquareClick(square: string) {
    if (isSuccess) return;

    if (!moveFrom) {
      const hasOptions = getMoveOptions(square);
      if (hasOptions) setMoveFrom(square);
      return;
    }

    const success = makeMove({
      from: moveFrom,
      to: square,
      promotion: 'q',
    });

    if (success) {
      setMoveFrom(null);
      setOptionSquares({});
    } else {
      const hasOptions = getMoveOptions(square);
      setMoveFrom(hasOptions ? square : null);
    }
  }

  function onDrop(sourceSquare: string, targetSquare: string, piece: string) {
    setMoveFrom(null);
    setOptionSquares({});

    const isPromotion = 
      (piece && piece[1] === 'P' && sourceSquare[1] === '7' && targetSquare[1] === '8') ||
      (piece && piece[1] === 'P' && sourceSquare[1] === '2' && targetSquare[1] === '1');

    if (isPromotion) {
      setPromotionMove({ from: sourceSquare, to: targetSquare });
      return true; 
    }

    const move = makeMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q', // always promote to a queen for simplicity
    });
    return move;
  }

  function onPromotionPieceSelect(pieceType: string | undefined) {
    if (pieceType && promotionMove) {
      makeMove({
        from: promotionMove.from,
        to: promotionMove.to,
        promotion: pieceType[1].toLowerCase() ?? 'q'
      });
    }
    setPromotionMove(null);
    setMoveFrom(null);
    setOptionSquares({});
    return true;
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
    setMoveFrom(null);
    setOptionSquares({});
    setPromotionMove(null);
  }

  return (
    <div className="max-w-6xl mx-auto p-8 flex flex-col lg:flex-row gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-30">
      <div className="flex-1 max-w-[600px] flex flex-col gap-6">
        <div className="flex justify-between items-center px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md">
           <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Piece Set:</span>
           <span className="text-xs font-bold text-indigo-400 bg-indigo-500/20 px-3 py-1 rounded-lg uppercase tracking-wider">{pieceSet}</span>
        </div>
        <div className="backdrop-blur-md bg-white/5 p-6 rounded-3xl border border-white/10 shadow-2xl">
          <Chessboard 
            key={pieceSet}
          position={fen} 
          onPieceDrop={onDrop}
          onSquareClick={onSquareClick}
          promotionToSquare={promotionMove?.to ?? null}
          showPromotionDialog={!!promotionMove}
          onPromotionPieceSelect={onPromotionPieceSelect}
          onPieceDragBegin={(_, sourceSquare) => {
            getMoveOptions(sourceSquare);
            setMoveFrom(sourceSquare);
          }}
          animationDuration={350}
          customSquareStyles={optionSquares}
          customBoardStyle={customBoardStyle}
          customDarkSquareStyle={customDarkSquareStyle}
          customLightSquareStyle={customLightSquareStyle}
          customDropSquareStyle={customDropSquareStyle}
          customPieces={customPieces}
        />
        </div>
        
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4 px-6 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-4 w-full sm:w-auto overflow-hidden">
            <div className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm border ${
              game.turn() === 'w' 
                ? 'bg-[#f0d9b5] text-slate-900 border-[#b58863]/50' 
                : 'bg-[#1e293b] text-[#f0d9b5] border-[#b58863]/50'
            }`}>
               <span className="text-xs font-bold uppercase tracking-wider">
                 {game.turn() === 'w' ? "♙ White's Move" : "♟ Black's Move"}
               </span>
            </div>
          </div>
          <button 
             onClick={retryLesson}
             className="flex items-center gap-2 hover:bg-white/10 text-slate-400 hover:text-white font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-xl transition-colors shrink-0"
           >
             <RefreshCcw size={16} /> Reset
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-6">
          <div className="flex justify-between text-xs mb-2 text-slate-400 font-bold uppercase tracking-widest">
            <span>Lesson Progress</span>
            <span>{Math.round(((currentLessonIndex + 1) / LESSONS.length) * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-indigo-500 transition-all duration-500 ease-out" 
              style={{ width: `${((currentLessonIndex + 1) / LESSONS.length) * 100}%` }}
            ></div>
          </div>
        </div>

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

        {isSuccess && (
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
        )}
      </div>
    </div>
  );
}

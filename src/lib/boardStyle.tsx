import React from 'react';

export const customBoardStyle = {
  borderRadius: '4px',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 2px #1e293b, 0 0 0 6px #0f172a, inset 0 0 4px rgba(0, 0, 0, 0.5)',
  backgroundColor: '#0f172a',
};

// Deep contrast dark squares - Neo Wood
export const customDarkSquareStyle = {
  backgroundColor: '#b58863', 
  boxShadow: 'inset 0 0 8px rgba(0,0,0,0.4)',
};

// Crisp contrast light squares 
export const customLightSquareStyle = {
  backgroundColor: '#f0d9b5', 
  boxShadow: 'inset 0 0 4px rgba(0,0,0,0.1)',
};

export const customDropSquareStyle = {
  boxShadow: 'inset 0 0 1px 4px #4ade80, inset 0 0 25px rgba(74, 222, 128, 0.7)',
  backgroundColor: 'rgba(74, 222, 128, 0.2)'
};

export const piecesConfig = () => {
  const pieces = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];
  const returnPieces: Record<string, React.FC<{ squareWidth: number }>> = {};
  
  pieces.forEach((p) => {
    returnPieces[p] = ({ squareWidth }) => (
      <div
        style={{
          width: squareWidth,
          height: squareWidth,
          // Switching to frescha for very high resolution 3d looking pieces 
          backgroundImage: `url(https://lichess1.org/assets/piece/fresca/${p}.svg)`,
          backgroundSize: "100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          transform: "scale(0.95)",
          // Refined shadow
          filter: p.startsWith('w')
            ? "drop-shadow(0 4px 3px rgba(0,0,0,0.4))"
            : "drop-shadow(0 4px 3px rgba(0,0,0,0.6))",
          position: "relative",
          top: "-1px" 
        }}
      />
    );
  });
  
  return returnPieces;
};

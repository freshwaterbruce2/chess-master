export interface Lesson {
  id: string;
  title: string;
  description: string;
  initialFen: string;
  targetMove?: string;
  successMessage?: string;
}

export const LESSONS: Lesson[] = [
  {
    id: "board-setup",
    title: "1. The Starting Position",
    description: "Welcome to chess! This is the starting position. The white pieces always move first. To start the game, try moving the pawn in front of your King forward two squares to control the center. (Move the pawn from e2 to e4).",
    initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    targetMove: "e4",
    successMessage: "Great job! This is one of the most popular opening moves. It commands the center and opens lines for your Queen and Bishop.",
  },
  {
    id: "knight-move",
    title: "2. The Knight Jump",
    description: "Knights move in an 'L' shape (two squares in one direction, and one square perpendicular). They are the only pieces that can jump over others! Try moving the White Knight on g1 to f3.",
    initialFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1",
    targetMove: "Nf3",
    successMessage: "Excellent! Developing your knights early is a very important chess principle.",
  },
  {
    id: "checkmate-in-one",
    title: "3. Checkmate in One",
    description: "The goal of chess is to checkmate the enemy King. This means the King is under attack (Check) and has no way to escape. In this classic 'Scholar's Mate' position, White's Queen and Bishop team up. Move your Queen to f7 to deliver Checkmate!",
    initialFen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
    targetMove: "Qxf7#",
    successMessage: "Checkmate! You win! Notice how the Black King cannot take the Queen because the White Bishop is protecting it.",
  }
];

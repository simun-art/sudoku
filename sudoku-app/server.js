const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { generatePuzzle, boardsMatch, findConflicts, DIFFICULTY_CLUES } = require('./sudoku');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory game store. Fine for a single local instance; resets on restart.
const games = new Map();

function publicGame(game) {
  return {
    gameId: game.id,
    puzzle: game.puzzle,
    givenMask: game.givenMask,
    difficulty: game.difficulty,
    clues: game.clues
  };
}

app.post('/api/games', (req, res) => {
  const difficulty = Object.keys(DIFFICULTY_CLUES).includes(req.body?.difficulty)
    ? req.body.difficulty
    : 'medium';

  const { puzzle, solution, clues } = generatePuzzle(difficulty);
  const id = crypto.randomUUID();
  const givenMask = puzzle.map((v) => v !== 0);

  const game = { id, puzzle, solution, givenMask, difficulty, clues, hintsUsed: 0 };
  games.set(id, game);

  res.json(publicGame(game));
});

app.get('/api/games/:id', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(publicGame(game));
});

app.post('/api/games/:id/check', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const board = req.body?.board;
  if (!Array.isArray(board) || board.length !== 81) {
    return res.status(400).json({ error: 'Board must be an array of 81 cells' });
  }

  const conflicts = findConflicts(board);
  const filled = board.every((v) => v !== 0);
  const solved = filled && conflicts.length === 0 && boardsMatch(board, game.solution);

  res.json({ conflicts, solved });
});

app.post('/api/games/:id/hint', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { row, col } = req.body || {};
  if (
    typeof row !== 'number' ||
    typeof col !== 'number' ||
    row < 0 || row > 8 || col < 0 || col > 8
  ) {
    return res.status(400).json({ error: 'row and col must be 0-8' });
  }

  const i = row * 9 + col;
  game.hintsUsed++;
  res.json({ value: game.solution[i], hintsUsed: game.hintsUsed });
});

app.post('/api/games/:id/solve', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json({ solution: game.solution });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sudoku running at http://localhost:${PORT}`);
});

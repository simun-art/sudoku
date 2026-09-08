# Sudoku

A browser-playable Sudoku game with a Node/Express backend. The server generates
puzzles with a guaranteed unique solution, and keeps the solution server-side so
opening dev tools won't reveal the answer.

## Setup

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

## How it works

- `sudoku.js` — puzzle generator (random full grid via backtracking, then digs
  holes while checking with a solution-counter that each removal keeps the
  puzzle uniquely solvable), a solver, and a conflict checker.
- `server.js` — Express API:
  - `POST /api/games` — start a new game (`{ difficulty: "easy"|"medium"|"hard"|"expert" }`)
  - `GET /api/games/:id` — refetch a game's puzzle
  - `POST /api/games/:id/check` — validate the current board, returns conflicting cells and whether it's solved
  - `POST /api/games/:id/hint` — reveal the correct value for one cell
  - `POST /api/games/:id/solve` — reveal the full solution
- `public/` — the frontend (vanilla HTML/CSS/JS, no build step).

## Playing

- Click a cell, then type a number (1–9) or click the keypad. Backspace/Delete/0 erases.
- Arrow keys move the selection.
- **Notes** toggles pencil-mark mode (or press `N`) for jotting candidate numbers.
- **Undo** steps back one move. **Hint** reveals the selected cell's correct value.
- Same-row/column/box cells and same-value cells are highlighted; conflicting
  entries are flagged in red as soon as they collide with another clue or entry.
- Difficulty tabs at the top start a fresh puzzle at that level.

Game state lives in memory on the server, so restarting the server clears any
in-progress games.

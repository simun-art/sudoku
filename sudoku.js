// sudoku.js — puzzle generation, solving, and uniqueness checking
// Board representation: flat array of 81 numbers, 0 = empty, row-major order.

const SIZE = 9;
const BOX = 3;

function idx(r, c) {
  return r * SIZE + c;
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isSafe(board, r, c, val) {
  for (let i = 0; i < SIZE; i++) {
    if (board[idx(r, i)] === val) return false;
    if (board[idx(i, c)] === val) return false;
  }
  const boxRow = Math.floor(r / BOX) * BOX;
  const boxCol = Math.floor(c / BOX) * BOX;
  for (let dr = 0; dr < BOX; dr++) {
    for (let dc = 0; dc < BOX; dc++) {
      if (board[idx(boxRow + dr, boxCol + dc)] === val) return false;
    }
  }
  return true;
}

// Find the empty cell with the fewest candidate values (helps both
// generation speed and keeps solution-counting fast during digging).
function findBestEmptyCell(board) {
  let best = -1;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    let count = 0;
    for (let v = 1; v <= 9; v++) {
      if (isSafe(board, r, c, v)) count++;
    }
    if (count < bestCount) {
      bestCount = count;
      best = i;
      if (count <= 1) break;
    }
  }
  return best;
}

// Fills an empty board completely at random using backtracking.
function generateSolvedBoard() {
  const board = new Array(81).fill(0);

  function fill(pos) {
    if (pos === 81) return true;
    const r = Math.floor(pos / SIZE);
    const c = pos % SIZE;
    if (board[pos] !== 0) return fill(pos + 1);
    for (const v of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (isSafe(board, r, c, v)) {
        board[pos] = v;
        if (fill(pos + 1)) return true;
        board[pos] = 0;
      }
    }
    return false;
  }

  fill(0);
  return board;
}

// Counts solutions up to `limit` (stops early once the limit is hit).
// Used to verify a dug puzzle still has a unique solution.
function countSolutions(board, limit) {
  let count = 0;

  function solve(b) {
    if (count >= limit) return;
    const pos = findBestEmptyCell(b);
    if (pos === -1) {
      count++;
      return;
    }
    const r = Math.floor(pos / SIZE);
    const c = pos % SIZE;
    for (let v = 1; v <= 9; v++) {
      if (count >= limit) return;
      if (isSafe(b, r, c, v)) {
        b[pos] = v;
        solve(b);
        b[pos] = 0;
      }
    }
  }

  solve(board.slice());
  return count;
}

function solveBoard(board) {
  const b = board.slice();
  function solve() {
    const pos = findBestEmptyCell(b);
    if (pos === -1) return true;
    const r = Math.floor(pos / SIZE);
    const c = pos % SIZE;
    for (let v = 1; v <= 9; v++) {
      if (isSafe(b, r, c, v)) {
        b[pos] = v;
        if (solve()) return true;
        b[pos] = 0;
      }
    }
    return false;
  }
  if (!solve()) return null;
  return b;
}

const DIFFICULTY_CLUES = {
  easy: 40,
  medium: 33,
  hard: 28,
  expert: 24
};

// Removes numbers from a solved board one at a time (in random order),
// only keeping a removal if the puzzle still has exactly one solution.
function digHoles(solved, targetClues) {
  const puzzle = solved.slice();
  const positions = shuffled([...Array(81).keys()]);
  let clues = 81;

  for (const pos of positions) {
    if (clues <= targetClues) break;
    const backup = puzzle[pos];
    puzzle[pos] = 0;
    const solutions = countSolutions(puzzle, 2);
    if (solutions !== 1) {
      puzzle[pos] = backup; // removing this cell broke uniqueness
    } else {
      clues--;
    }
  }
  return { puzzle, clues };
}

function generatePuzzle(difficulty = 'medium') {
  const targetClues = DIFFICULTY_CLUES[difficulty] ?? DIFFICULTY_CLUES.medium;
  const solved = generateSolvedBoard();
  const { puzzle, clues } = digHoles(solved, targetClues);
  return { puzzle, solution: solved, clues, difficulty };
}

function boardsMatch(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Returns indices of cells in `board` that conflict with row/col/box rules
// or that disagree with `givens` (fixed clue cells can't be judged wrong).
function findConflicts(board) {
  const conflicts = new Set();

  for (let r = 0; r < SIZE; r++) {
    const seen = {};
    for (let c = 0; c < SIZE; c++) {
      const v = board[idx(r, c)];
      if (!v) continue;
      if (seen[v] !== undefined) {
        conflicts.add(seen[v]);
        conflicts.add(idx(r, c));
      } else {
        seen[v] = idx(r, c);
      }
    }
  }

  for (let c = 0; c < SIZE; c++) {
    const seen = {};
    for (let r = 0; r < SIZE; r++) {
      const v = board[idx(r, c)];
      if (!v) continue;
      if (seen[v] !== undefined) {
        conflicts.add(seen[v]);
        conflicts.add(idx(r, c));
      } else {
        seen[v] = idx(r, c);
      }
    }
  }

  for (let br = 0; br < SIZE; br += BOX) {
    for (let bc = 0; bc < SIZE; bc += BOX) {
      const seen = {};
      for (let dr = 0; dr < BOX; dr++) {
        for (let dc = 0; dc < BOX; dc++) {
          const r = br + dr;
          const c = bc + dc;
          const v = board[idx(r, c)];
          if (!v) continue;
          if (seen[v] !== undefined) {
            conflicts.add(seen[v]);
            conflicts.add(idx(r, c));
          } else {
            seen[v] = idx(r, c);
          }
        }
      }
    }
  }

  return Array.from(conflicts);
}

module.exports = {
  generatePuzzle,
  solveBoard,
  boardsMatch,
  findConflicts,
  DIFFICULTY_CLUES
};

(() => {
  const boardEl = document.getElementById('board');
  const timerEl = document.getElementById('timer');
  const mistakesEl = document.getElementById('mistakes');
  const keypadEl = document.getElementById('keypad');
  const notesBtn = document.getElementById('notesBtn');
  const undoBtn = document.getElementById('undoBtn');
  const hintBtn = document.getElementById('hintBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const diffTabs = document.querySelectorAll('.diff-tab');
  const winBanner = document.getElementById('winBanner');
  const winTime = document.getElementById('winTime');

  let state = null; // set by startGame()
  let cellEls = [];

  function idx(r, c) {
    return r * 9 + c;
  }

  function blankState() {
    return {
      gameId: null,
      difficulty: 'medium',
      given: new Array(81).fill(false),
      board: new Array(81).fill(0),
      notes: Array.from({ length: 81 }, () => new Set()),
      selected: null,
      notesMode: false,
      mistakes: 0,
      seconds: 0,
      timerHandle: null,
      history: [],
      solved: false
    };
  }

  async function startGame(difficulty) {
    if (state?.timerHandle) clearInterval(state.timerHandle);
    winBanner.hidden = true;

    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty })
    });
    const data = await res.json();

    state = blankState();
    state.gameId = data.gameId;
    state.difficulty = data.difficulty;
    state.given = data.givenMask;
    state.board = data.puzzle.slice();

    renderBoard();
    startTimer();
    updateMistakes();
  }

  function startTimer() {
    state.timerHandle = setInterval(() => {
      state.seconds++;
      timerEl.textContent = formatTime(state.seconds);
    }, 1000);
    timerEl.textContent = formatTime(0);
  }

  function formatTime(total) {
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateMistakes() {
    mistakesEl.textContent = state.mistakes;
    mistakesEl.classList.toggle('is-warning', state.mistakes > 0);
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    cellEls = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const i = idx(r, c);
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = i;
        cell.tabIndex = 0;
        if (r % 3 === 2 && r !== 8) cell.classList.add('row-thick');
        cell.addEventListener('click', () => selectCell(i));
        boardEl.appendChild(cell);
        cellEls.push(cell);
      }
    }
    refreshAllCells();
  }

  function refreshAllCells() {
    for (let i = 0; i < 81; i++) refreshCell(i);
    applySelectionHighlights();
  }

  function refreshCell(i) {
    const cell = cellEls[i];
    const val = state.board[i];
    const given = state.given[i];

    cell.classList.toggle('is-given', given);
    cell.innerHTML = '';

    if (val !== 0) {
      cell.textContent = val;
    } else if (state.notes[i].size > 0) {
      const grid = document.createElement('div');
      grid.className = 'notes-grid';
      for (let n = 1; n <= 9; n++) {
        const span = document.createElement('span');
        span.textContent = state.notes[i].has(n) ? n : '';
        grid.appendChild(span);
      }
      cell.appendChild(grid);
    }
  }

  function selectCell(i) {
    state.selected = i;
    applySelectionHighlights();
  }

  function applySelectionHighlights() {
    const sel = state.selected;
    const selVal = sel !== null ? state.board[sel] : 0;
    const selRow = sel !== null ? Math.floor(sel / 9) : -1;
    const selCol = sel !== null ? sel % 9 : -1;
    const selBoxR = Math.floor(selRow / 3);
    const selBoxC = Math.floor(selCol / 3);

    const conflicts = new Set(state.lastConflicts || []);

    for (let i = 0; i < 81; i++) {
      const cell = cellEls[i];
      const r = Math.floor(i / 9);
      const c = i % 9;
      const boxR = Math.floor(r / 3);
      const boxC = Math.floor(c / 3);

      cell.classList.remove('is-selected', 'is-peer', 'is-same-value', 'is-conflict');

      if (sel === null) continue;

      if (i === sel) {
        cell.classList.add('is-selected');
      } else if (r === selRow || c === selCol || (boxR === selBoxR && boxC === selBoxC)) {
        cell.classList.add('is-peer');
      }

      if (selVal !== 0 && state.board[i] === selVal) {
        cell.classList.add('is-same-value');
      }

      if (conflicts.has(i)) {
        cell.classList.add('is-conflict');
      }
    }
  }

  function setCellValue(i, val) {
    if (state.given[i] || state.solved) return;

    if (state.notesMode && val !== 0) {
      state.history.push({ type: 'note', index: i, notes: new Set(state.notes[i]) });
      if (state.notes[i].has(val)) {
        state.notes[i].delete(val);
      } else {
        state.notes[i].add(val);
      }
      refreshCell(i);
      return;
    }

    const prevVal = state.board[i];
    const prevNotes = new Set(state.notes[i]);
    if (prevVal === val) return;

    state.history.push({ type: 'value', index: i, value: prevVal, notes: prevNotes });
    state.board[i] = val;
    if (val !== 0) state.notes[i].clear();

    checkBoard();
  }

  async function checkBoard() {
    const res = await fetch(`/api/games/${state.gameId}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board: state.board })
    });
    const data = await res.json();
    const wasConflictFree = (state.lastConflicts || []).length === 0;
    state.lastConflicts = data.conflicts;

    if (data.conflicts.length > 0 && wasConflictFree) {
      state.mistakes++;
      updateMistakes();
    }

    refreshAllCells();

    if (data.solved) {
      finishGame();
    }
  }

  function finishGame() {
    state.solved = true;
    clearInterval(state.timerHandle);
    winTime.textContent = `Finished in ${formatTime(state.seconds)}`;
    winBanner.hidden = false;
  }

  function undo() {
    const last = state.history.pop();
    if (!last) return;
    if (last.type === 'value') {
      state.board[last.index] = last.value;
      state.notes[last.index] = last.notes;
    } else {
      state.notes[last.index] = last.notes;
    }
    checkBoard();
  }

  async function hint() {
    if (state.selected === null || state.given[state.selected] || state.solved) return;
    const r = Math.floor(state.selected / 9);
    const c = state.selected % 9;
    const res = await fetch(`/api/games/${state.gameId}/hint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row: r, col: c })
    });
    const data = await res.json();
    state.history.push({
      type: 'value',
      index: state.selected,
      value: state.board[state.selected],
      notes: new Set(state.notes[state.selected])
    });
    state.notes[state.selected].clear();
    state.board[state.selected] = data.value;
    cellEls[state.selected].classList.add('is-hint');
    setTimeout(() => cellEls[state.selected]?.classList.remove('is-hint'), 900);
    checkBoard();
  }

  keypadEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn || state.selected === null) return;
    setCellValue(state.selected, Number(btn.dataset.num));
  });

  notesBtn.addEventListener('click', () => {
    state.notesMode = !state.notesMode;
    notesBtn.setAttribute('aria-pressed', String(state.notesMode));
  });

  undoBtn.addEventListener('click', undo);
  hintBtn.addEventListener('click', hint);
  newGameBtn.addEventListener('click', () => startGame(state.difficulty));

  diffTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      diffTabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      startGame(tab.dataset.difficulty);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (state.selected === null) return;

    if (e.key >= '1' && e.key <= '9') {
      setCellValue(state.selected, Number(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      setCellValue(state.selected, 0);
    } else if (e.key === 'n' || e.key === 'N') {
      state.notesMode = !state.notesMode;
      notesBtn.setAttribute('aria-pressed', String(state.notesMode));
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const r = Math.floor(state.selected / 9);
      const c = state.selected % 9;
      let nr = r, nc = c;
      if (e.key === 'ArrowUp') nr = Math.max(0, r - 1);
      if (e.key === 'ArrowDown') nr = Math.min(8, r + 1);
      if (e.key === 'ArrowLeft') nc = Math.max(0, c - 1);
      if (e.key === 'ArrowRight') nc = Math.min(8, c + 1);
      selectCell(idx(nr, nc));
    }
  });

  startGame('medium');
})();

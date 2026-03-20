const LOG = (...args) => console.log('[Queens Solver]', ...args);
const WARN = (...args) => console.warn('[Queens Solver]', ...args);

// ─── State helpers ──────────────────────────────────────────────────────────

function getCellState(cell) {
  if (cell.querySelector('[data-test-flippable-queen="true"]')) return 'queen';
  if (cell.querySelector('[data-testid="cross-svg"]'))          return 'cross';
  return 'empty';
}

// Waits for the cell's DOM to change after a click (via MutationObserver)
function waitForStateChange(cell, timeout = 500) {
  return new Promise(resolve => {
    const timer = setTimeout(() => { observer.disconnect(); resolve(); }, timeout);
    const observer = new MutationObserver(() => {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    });
    observer.observe(cell, { childList: true, subtree: true, attributes: true });
  });
}

// Clicks a cell until it reaches targetState (cycle: empty→queen→cross→empty)
async function clickUntilState(cell, targetState, maxClicks = 3) {
  for (let i = 0; i < maxClicks; i++) {
    const state = getCellState(cell);
    if (state === targetState) return true;
    LOG(`  clic ${i + 1} sur (${cellCoords(cell)}) : état "${state}" → cible "${targetState}"`);
    cell.click();
    await waitForStateChange(cell);
  }
  const finalState = getCellState(cell);
  if (finalState !== targetState) {
    WARN(`  échec : état final "${finalState}" ≠ cible "${targetState}" sur (${cellCoords(cell)})`);
  }
  return finalState === targetState;
}

function cellCoords(cell) {
  const label = cell.getAttribute('aria-label') || '';
  const m = label.match(/(?:ligne|row) (\d+),\s*(?:colonne|column) (\d+)/);
  return m ? `ligne ${m[1]}, col ${m[2]}` : cell.getAttribute('data-cell-idx');
}

// ─── Grid reading ────────────────────────────────────────────────────────────

function parseAriaLabel(label) {
  // French:  "Reine de couleur lavande, ligne 1, colonne 2"
  // English: "Queen of color lavender, row 1, column 2"
  const colorMatch = label.match(/(?:couleur|color) ([^,]+)/);
  const posMatch   = label.match(/(?:ligne|row) (\d+),\s*(?:colonne|column) (\d+)/);
  return { colorMatch, posMatch };
}

function readGrid() {
  const container = document.querySelector('[data-testid="interactive-grid"]');
  if (!container) {
    WARN('Conteneur de grille introuvable.');
    return null;
  }

  const style     = container.getAttribute('style') || '';
  const sizeMatch = style.match(/--_[a-f0-9]+:\s*(\d+)/);
  const size      = sizeMatch ? parseInt(sizeMatch[1]) : 8;
  LOG(`Grille détectée : ${size}x${size}`);

  const cells = container.querySelectorAll('[data-cell-idx]');
  if (!cells.length) {
    WARN('Aucune case trouvée dans la grille.');
    return null;
  }

  const grid = [];
  const colorsSeen = new Set();

  for (const cell of cells) {
    const label = cell.getAttribute('aria-label') || '';
    const { colorMatch, posMatch } = parseAriaLabel(label);
    if (!colorMatch || !posMatch) continue;

    const color = colorMatch[1].trim();
    colorsSeen.add(color);
    grid.push({
      index: parseInt(cell.getAttribute('data-cell-idx')),
      row:   parseInt(posMatch[1]) - 1,
      col:   parseInt(posMatch[2]) - 1,
      color,
    });
  }

  LOG(`${grid.length} cases lues, ${colorsSeen.size} couleurs : ${[...colorsSeen].join(', ')}`);
  return { grid, size };
}

// ─── Solution application ────────────────────────────────────────────────────

function buildCellMap(container) {
  const map = {};
  for (const cell of container.querySelectorAll('[data-cell-idx]')) {
    const label = cell.getAttribute('aria-label') || '';
    const { posMatch } = parseAriaLabel(label);
    if (posMatch) {
      map[`${parseInt(posMatch[1]) - 1},${parseInt(posMatch[2]) - 1}`] = cell;
    }
  }
  return map;
}

async function applySolution(solution) {
  const container = document.querySelector('[data-testid="interactive-grid"]');
  if (!container) return { success: false, error: 'Grille introuvable.' };

  const cellMap = buildCellMap(container);

  // 1. Reset cells not in the solution
  const solutionSet = new Set(solution.map(([r, c]) => `${r},${c}`));
  let resetCount = 0;
  for (const [key, cell] of Object.entries(cellMap)) {
    if (!solutionSet.has(key) && getCellState(cell) !== 'empty') {
      await clickUntilState(cell, 'empty');
      resetCount++;
    }
  }
  if (resetCount > 0) LOG(`${resetCount} case(s) remise(s) à vide.`);

  // 2. Place queens on solution cells
  LOG('Placement des reines :');
  for (const [row, col] of solution) {
    const cell = cellMap[`${row},${col}`];
    if (!cell) {
      WARN(`Case introuvable à (${row}, ${col})`);
      continue;
    }
    const ok = await clickUntilState(cell, 'queen');
    LOG(`  reine à (ligne ${row + 1}, col ${col + 1}) : ${ok ? 'OK' : 'ECHEC'}`);
  }

  LOG('Application terminée.');
  return { success: true };
}

// ─── Local solver (backtracking CSP) ────────────────────────────────────────

function solveLocally(grid, size) {
  LOG('Démarrage du solveur local...');
  const t0 = performance.now();

  const colorIndex = {};
  let colorCount = 0;
  const colorMap = Array.from({ length: size }, () => Array(size).fill(-1));

  for (const cell of grid) {
    if (!(cell.color in colorIndex)) colorIndex[cell.color] = colorCount++;
    colorMap[cell.row][cell.col] = colorIndex[cell.color];
  }

  const solution   = [];
  const usedCols   = new Set();
  const usedColors = new Set();

  function conflicts(row, col) {
    for (const [r, c] of solution) {
      if (Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1) return true;
    }
    return false;
  }

  function backtrack(row) {
    if (row === size) return true;
    for (let col = 0; col < size; col++) {
      if (usedCols.has(col))     continue;
      const color = colorMap[row][col];
      if (color === -1)          continue;
      if (usedColors.has(color)) continue;
      if (conflicts(row, col))   continue;

      solution.push([row, col]);
      usedCols.add(col);
      usedColors.add(color);

      if (backtrack(row + 1)) return true;

      solution.pop();
      usedCols.delete(col);
      usedColors.delete(color);
    }
    return false;
  }

  const solved = backtrack(0);
  const ms = (performance.now() - t0).toFixed(2);

  if (solved) {
    LOG(`Solution trouvée en ${ms}ms :`, solution.map(([r, c]) => `(${r + 1},${c + 1})`).join(' '));
  } else {
    WARN(`Aucune solution trouvée (${ms}ms).`);
  }

  return solved ? solution : null;
}

// ─── Message listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.action === 'readGrid') {
    const result = readGrid();
    sendResponse(result || { error: 'Grille introuvable. Le jeu est-il chargé ?' });
    return true;
  }

  if (msg.action === 'solveAndApplyLocal') {
    const solution = solveLocally(msg.grid, msg.size);
    if (!solution) {
      sendResponse({ success: false, error: 'Aucune solution trouvée par le solveur local.' });
      return true;
    }
    applySolution(solution).then(sendResponse);
    return true;
  }

  if (msg.action === 'applySolution') {
    LOG('Solution reçue de Claude :', msg.solution.map(([r, c]) => `(${r + 1},${c + 1})`).join(' '));
    applySolution(msg.solution).then(sendResponse);
    return true;
  }
});

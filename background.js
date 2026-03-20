chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'solveWithClaude') {
    solveWithClaude(msg.grid, msg.size, msg.apiKey)
      .then(solution => sendResponse({ solution }))
      .catch(err => sendResponse({ error: err.message }));
    return true; // async response
  }
});

async function solveWithClaude(grid, size, apiKey) {
  // Build a 2D color map to send to Claude
  const colorMap = Array.from({ length: size }, () => Array(size).fill(''));
  for (const cell of grid) {
    colorMap[cell.row][cell.col] = cell.color;
  }

  // Format as a readable grid for Claude
  const gridText = colorMap.map((row, r) =>
    row.map((color, c) => `(${r},${c}):${color}`).join('  ')
  ).join('\n');

  const prompt = `Tu dois résoudre un puzzle "Queens" sur une grille ${size}x${size}.

Règles :
1. Exactement une reine par ligne
2. Exactement une reine par colonne
3. Exactement une reine par région de couleur
4. Aucune reine ne doit être adjacente à une autre (y compris en diagonale)

Grille (format ligne,colonne:couleur, indexation 0) :
${gridText}

Réponds UNIQUEMENT avec un tableau JSON des positions des reines, format :
[[ligne, colonne], [ligne, colonne], ...]

Aucun texte supplémentaire, juste le JSON.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur API: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text?.trim();

  if (!text) throw new Error('Réponse vide de Claude.');

  // Extract JSON array from response
  const jsonMatch = text.match(/\[\s*\[[\s\S]*\]\s*\]/);
  if (!jsonMatch) throw new Error(`Réponse inattendue de Claude: ${text.substring(0, 100)}`);

  const solution = JSON.parse(jsonMatch[0]);

  // Basic validation
  if (!Array.isArray(solution) || solution.length !== size) {
    throw new Error(`Solution invalide: ${solution.length} reines pour une grille ${size}x${size}`);
  }

  return solution;
}

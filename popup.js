const apiKeyInput  = document.getElementById('apiKey');
const solveBtn     = document.getElementById('solveBtn');
const statusDiv    = document.getElementById('status');
const claudeConfig = document.getElementById('claudeConfig');
const radios       = document.querySelectorAll('input[name="method"]');

function setStatus(msg, type = '') {
  statusDiv.textContent = msg;
  statusDiv.className = type;
}

function getMethod() {
  return document.querySelector('input[name="method"]:checked')?.value || 'local';
}

// Restore saved preferences
chrome.storage.local.get(['anthropicApiKey', 'solverMethod'], ({ anthropicApiKey, solverMethod }) => {
  const method = solverMethod || 'local';
  document.querySelector(`input[value="${method}"]`).checked = true;
  claudeConfig.style.display = method === 'claude' ? 'block' : 'none';
  if (anthropicApiKey) apiKeyInput.value = anthropicApiKey;
});

// Show/hide API key field based on selected method
radios.forEach(radio => {
  radio.addEventListener('change', () => {
    const method = getMethod();
    claudeConfig.style.display = method === 'claude' ? 'block' : 'none';
    chrome.storage.local.set({ solverMethod: method });
    setStatus('');
  });
});

solveBtn.addEventListener('click', async () => {
  const method = getMethod();

  if (method === 'claude') {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      setStatus('Veuillez entrer votre clé API Anthropic.', 'error');
      return;
    }
    chrome.storage.local.set({ anthropicApiKey: apiKey });
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url.includes('linkedin.com/games/queens')) {
    setStatus('Ouvrez la page LinkedIn Queens d\'abord.', 'error');
    return;
  }

  solveBtn.disabled = true;
  setStatus('Lecture de la grille...', 'loading');

  chrome.tabs.sendMessage(tab.id, { action: 'readGrid' }, async (response) => {
    if (chrome.runtime.lastError || !response) {
      setStatus('Impossible de lire la grille. Rechargez la page.', 'error');
      solveBtn.disabled = false;
      return;
    }
    if (response.error) {
      setStatus(response.error, 'error');
      solveBtn.disabled = false;
      return;
    }

    if (method === 'local') {
      setStatus('Résolution en cours...', 'loading');
      chrome.tabs.sendMessage(tab.id, {
        action: 'solveAndApplyLocal',
        grid: response.grid,
        size: response.size,
      }, (res) => {
        solveBtn.disabled = false;
        if (res?.success) {
          setStatus('Grille résolue !', 'success');
        } else {
          setStatus(res?.error || 'Aucune solution trouvée.', 'error');
        }
      });

    } else {
      setStatus('Appel à Claude AI...', 'loading');
      const apiKey = apiKeyInput.value.trim();

      chrome.runtime.sendMessage(
        { action: 'solveWithClaude', grid: response.grid, size: response.size, apiKey },
        (solveRes) => {
          if (chrome.runtime.lastError || !solveRes) {
            setStatus('Erreur lors de l\'appel à Claude.', 'error');
            solveBtn.disabled = false;
            return;
          }
          if (solveRes.error) {
            setStatus(solveRes.error, 'error');
            solveBtn.disabled = false;
            return;
          }

          setStatus('Application de la solution...', 'loading');
          chrome.tabs.sendMessage(tab.id, {
            action: 'applySolution',
            solution: solveRes.solution,
          }, (applyRes) => {
            solveBtn.disabled = false;
            if (applyRes?.success) {
              setStatus('Grille résolue !', 'success');
            } else {
              setStatus('Erreur lors de l\'application.', 'error');
            }
          });
        }
      );
    }
  });
});

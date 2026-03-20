# LinkedIn Queens Solver

Extension Chrome qui résout automatiquement le puzzle [Queens de LinkedIn](https://www.linkedin.com/games/queens/).

## Fonctionnement

Deux modes au choix :

| Mode | Vitesse | Coût | Fiabilité |
|---|---|---|---|
| **Local** | Instantané (<1ms) | Gratuit | 100% exact (backtracking) |
| **Claude AI** | ~2-3s | Clé API requise | Dépend du modèle |

### Mode Local

Solveur par backtracking (CSP) intégré directement dans l'extension. Résout la grille sans appel réseau, sans clé API.

### Mode Claude AI

Envoie la grille à l'API Anthropic (`claude-opus-4-6`) et en reçoit la solution. Nécessite une clé API Anthropic.

## Installation

1. Cloner ou télécharger ce dossier
2. Ouvrir Chrome → `chrome://extensions/`
3. Activer le **mode développeur** (toggle en haut à droite)
4. Cliquer **"Charger l'extension non empaquetée"**
5. Sélectionner le dossier `queens-extension/`

## Utilisation

1. Aller sur `https://www.linkedin.com/games/queens/`
2. Attendre que la grille soit chargée
3. Cliquer sur l'icône de l'extension dans la barre Chrome
4. Choisir le mode : **Local** ou **Claude AI**
5. Si Claude AI : entrer la clé API Anthropic (`sk-ant-api03-...`)
6. Cliquer **"Résoudre la grille"**

La clé API est sauvegardée localement dans le navigateur (jamais transmise ailleurs qu'à l'API Anthropic). Le mode sélectionné est également mémorisé.

## Structure

```
queens-extension/
├── manifest.json     # Configuration Chrome (Manifest V3)
├── content.js        # Lecture de la grille, solveur local, application de la solution
├── background.js     # Appel à l'API Claude (mode Claude AI uniquement)
├── popup.html        # Interface utilisateur
└── popup.js          # Logique du popup, choix du mode
```

## Règles du puzzle

- Une reine par ligne
- Une reine par colonne
- Une reine par région de couleur
- Aucune reine adjacente à une autre (y compris en diagonale)

## Compatibilité

- Grille de taille variable (détectée automatiquement via variable CSS)
- Interface LinkedIn en français et en anglais
# linkedin-queens-resolver

Using https://github.com/mlc-ai/web-llm/tree/main/examples/chrome-extension as reference.

# MLCBot - Assistant IA local (Chrome Extension)

MLCBot est une extension Chrome qui permet de discuter avec un modèle de langage (LLM) directement dans votre navigateur. Contrairement aux extensions classiques, l'inférence est effectuée **100% localement** sur votre machine grâce à **WebGPU**, garantissant une confidentialité totale et aucune dépendance à des serveurs tiers.

## Arborescence du Projet

Pour maintenir le projet et le compiler, la structure suivante est utilisée :

```text
mon-extension-ai/
├── package.json          # Dépendances (WebLLM, Parcel, TypeScript)
├── package-lock.json     # Verrouillage des versions des dépendances
├── src/                  # Code source original
│   ├── icons/            # Icônes de l'extension (16x16, 32x32, etc.)
│   ├── content.js        # Script injecté pour lire le texte des pages web
│   ├── manifest.json     # Configuration V3 et règles de sécurité (CSP)
│   ├── popup.css         # Styles de l'interface de chat
│   ├── popup.html        # Structure de la fenêtre de l'extension
│   └── popup.ts          # Logique TypeScript (moteur WebLLM et UI)
└── dist/                 # Dossier généré après compilation (à charger dans Chrome)

```

## 🚀 Installation et Développement

### 1. Prérequis

* **Node.js** installé sur votre machine.
* Un navigateur basé sur **Chromium** (Chrome, Brave, Edge) avec support WebGPU.

### 2. Initialisation

Placez-vous dans le dossier racine et installez les modules nécessaires :

```bash
npm install
```

*Note : Cela installe notamment `@mlc-ai/web-llm` pour le moteur et `@mlc-ai/web-runtime` pour la communication GPU.*

### 3. Compilation

Pour générer les fichiers optimisés dans le dossier `/dist` :

```bash
npm run build
```

### 4. Chargement dans Chrome

1. Ouvrez `chrome://extensions/`.
2. Activez le **Mode développeur** (en haut à droite).
3. Cliquez sur **Charger l'extension décompressée**.
4. Sélectionnez le dossier **`/dist`** à la racine de votre projet.
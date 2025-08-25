# 🚀 Serveur Socket.IO pour Agar3.fun

## 🔧 Installation et démarrage

### Prérequis
- Node.js (version 16+)
- npm ou yarn

### Installation des dépendances
```bash
cd server
npm install
```

### Démarrage du serveur

#### Mode développement
```bash
cd server
npm run dev
```

#### Mode production
```bash
cd server
npm start
```

Le serveur démarrera sur le port **3001** par défaut.

## 🎮 Utilisation

Une fois le serveur démarré :
1. **Mode Solo** : Fonctionne sans le serveur (jeu local uniquement)
2. **Mode Multijoueur** : Nécessite le serveur Socket.IO sur le port 3001

## 🔗 Configuration

Variables d'environnement disponibles dans `.env` :
- `PORT` : Port du serveur (défaut: 3001)
- `SERVER_ID` : Identifiant unique du serveur
- `ENABLE_REDIS` : Activation de Redis pour la scalabilité (défaut: false)

## 🐛 Dépannage

### Erreur "WebSocket disconnected"
1. Vérifiez que le serveur Node.js est en cours d'exécution
2. Vérifiez que le port 3001 est disponible
3. En mode solo, cette erreur est normale car aucun serveur n'est requis

### Le jeu ne se lance pas
- **Mode Solo** : Ajoutez `?local=true` à l'URL
- **Mode Multi** : Assurez-vous d'être dans une room active et que le serveur tourne

## 📋 Scripts disponibles

- `npm start` : Démarrage en mode production
- `npm run dev` : Démarrage en mode développement avec ts-node
- `npm run build` : Compilation TypeScript

## 🏗️ Architecture

```
server/
├── src/
│   ├── index.ts              # Point d'entrée
│   ├── ScalableSocketServer.ts # Serveur principal
│   ├── game/                 # Logique de jeu
│   ├── rooms/                # Gestion des salles
│   └── monitoring/           # Surveillance
├── start.js                  # Script de démarrage
└── package.json
```
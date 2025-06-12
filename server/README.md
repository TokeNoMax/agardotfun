
# Agar3.fun Realtime Server

Serveur temps-réel haute performance pour agar3.fun utilisant Socket.IO et Node.js.

## Caractéristiques

- **Haute fréquence**: 15Hz (66ms par tick) pour une expérience fluide
- **Transport WebSocket uniquement**: Performance optimale
- **Architecture modulaire**: GameEngine, RoomManager, SnapshotManager
- **Delta compression**: Seules les modifications sont transmises
- **Réconciliation serveur autoritaire**: Anti-triche intégré

## Architecture

```
server/
├── src/
│   ├── types/game.ts          # Types TypeScript partagés
│   ├── game/
│   │   ├── GameEngine.ts      # Moteur de jeu principal
│   │   └── SnapshotManager.ts # Gestion des deltas
│   ├── rooms/
│   │   └── RoomManager.ts     # Gestion des salles
│   ├── SocketServer.ts        # Serveur Socket.IO
│   └── index.ts              # Point d'entrée
└── package.json
```

## Installation et Démarrage

```bash
cd server
npm install
npm run dev
```

Le serveur démarre sur le port 3001 par défaut.

## Endpoints

- `ws://localhost:3001` - WebSocket endpoint principal
- `GET /health` - Status du serveur
- `GET /rooms` - Liste des salles actives

## Événements Socket.IO

### Client → Serveur
- `joinRoom` - Rejoindre une salle
- `leaveRoom` - Quitter une salle  
- `playerInput` - Input joueur avec prédiction client

### Serveur → Client
- `connected` - Confirmation de connexion
- `gameSnapshot` - Snapshot de jeu (15Hz)
- `playerJoined` - Nouveau joueur
- `playerLeft` - Joueur parti
- `roomJoined` - Confirmation d'entrée en salle

## Performance

- **Latence optimisée**: WebSocket uniquement, pas de fallback HTTP
- **Compression delta**: Réduction de 70-80% de la bande passante
- **Tick rate fixe**: 15Hz stable même sous charge
- **Réconciliation intelligente**: Corrections de position fluides

## Configuration

Variables d'environnement disponibles:
- `PORT` - Port du serveur (défaut: 3001)
- `NODE_ENV` - Environment (development/production)

## Monitoring

Le serveur expose des métriques de performance via l'endpoint `/health`:
- Nombre de salles actives
- Joueurs connectés par salle
- Status de santé général

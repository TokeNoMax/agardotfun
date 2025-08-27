// src/index.ts
import path from "path";
import http from "http";
import express from "express";
import { Server as IOServer, Socket } from "socket.io";
import crypto from "node:crypto";

/* =================== Config =================== */
const PORT = Number(process.env.PORT) || 3000;
const TICK_HZ = 15; // 15 FPS côté serveur

const MAP_W = 3000, MAP_H = 3000;
const PELLETS = 400;
const RUGS = 12;
const EAT_RATIO = 1.15; // ratio pour qu’un joueur puisse en manger un autre
const SPEED_BASE = 3.2; // vitesse de base

/* ================ App + Static ================= */
const app = express();

// Sert le front buildé depuis /public (tu y as mis le contenu de dist/)
app.use(express.static(path.join(__dirname, "../public")));
app.get("*", (_, res) =>
  res.sendFile(path.join(__dirname, "../public/index.html"))
);

const server = http.createServer(app);
export const io = new IOServer(server, {
  // même domaine → pas besoin de CORS strict ; ajuste si tu sers le front ailleurs
  cors: { origin: "*" },
  transports: ["websocket"], // évite le polling
});

/* ================== Types ===================== */
type Player = {
  id: string;
  name: string;
  color: string;
  x: number; y: number;
  vx: number; vy: number;
  mass: number;    // “aire” (pas le rayon)
  alive: boolean;
  lastInputAt: number;
};

type Pellet = { id: string; x: number; y: number; r: number };
type Rug    = { id: string; x: number; y: number; r: number };

type Room = {
  id: string;
  status: "waiting" | "running";
  minPlayers: number;
  players: Record<string, Player>;
  pellets: Pellet[];
  rugs: Rug[];
  loop: NodeJS.Timeout | null;
  seed: string;
};

const rooms: Record<string, Room> = Object.create(null);

/* ================= Utils Jeu ================== */
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const radiusFromMass = (m: number) => Math.sqrt(m / Math.PI);
const speedFor = (m: number) => SPEED_BASE / (1 + Math.sqrt(m) / 35);

const makePellet = (): Pellet => ({
  id: crypto.randomUUID().slice(0, 8),
  x: rnd(20, MAP_W - 20),
  y: rnd(20, MAP_H - 20),
  r: 3,
});
const makeRug = (): Rug => ({
  id: crypto.randomUUID().slice(0, 8),
  x: rnd(100, MAP_W - 100),
  y: rnd(100, MAP_H - 100),
  r: rnd(40, 80),
});

function spawnWorld(r: Room) {
  r.pellets = Array.from({ length: PELLETS }, makePellet);
  r.rugs = Array.from({ length: RUGS }, makeRug);
  r.seed = crypto.randomUUID().slice(0, 8);
}

function ensureRoom(roomId: string, minPlayers: number): Room {
  if (rooms[roomId]) return rooms[roomId];
  const room: Room = {
    id: roomId,
    status: "waiting",
    minPlayers,
    players: {},
    pellets: [],
    rugs: [],
    loop: null,
    seed: "",
  };
  spawnWorld(room);
  rooms[roomId] = room;
  return room;
}

function lobbySnapshot(roomId: string) {
  const r = rooms[roomId];
  return Object.values(r.players).map(p => ({
    id: p.id, name: p.name, color: p.color, alive: p.alive, score: Math.round(p.mass),
  }));
}

function broadcast(roomId: string, event: string, data: any) {
  io.to(roomId).emit(event, data);
}

function startIfReady(roomId: string) {
  const r = rooms[roomId];
  if (!r || r.status !== "waiting") return;
  const alive = Object.values(r.players).filter(p => p.alive).length;
  if (alive >= r.minPlayers) {
    r.status = "running";
    broadcast(roomId, "start", {
      map: { w: MAP_W, h: MAP_H },
      pellets: r.pellets,
      rugs: r.rugs,
      seed: r.seed,
    });
    r.loop = setInterval(() => tick(roomId), Math.round(1000 / TICK_HZ));
  }
}

/* ================== Tick ====================== */
function tick(roomId: string) {
  const r = rooms[roomId];
  if (!r) return;

  // 1) déplacer les joueurs selon leur direction normalisée
  for (const p of Object.values(r.players)) {
    if (!p.alive) continue;
    const sp = speedFor(p.mass);
    const rad = radiusFromMass(p.mass);
    p.x = clamp(p.x + p.vx * sp, rad, MAP_W - rad);
    p.y = clamp(p.y + p.vy * sp, rad, MAP_H - rad);
  }

  // 2) manger pellets
  for (const p of Object.values(r.players)) {
    if (!p.alive) continue;
    const pr = radiusFromMass(p.mass);
    for (let i = r.pellets.length - 1; i >= 0; i--) {
      const pe = r.pellets[i];
      const dx = p.x - pe.x, dy = p.y - pe.y;
      if (dx * dx + dy * dy <= (pr + pe.r) * (pr + pe.r)) {
        p.mass += Math.PI * pe.r * pe.r;
        r.pellets.splice(i, 1);
      }
    }
  }
  while (r.pellets.length < PELLETS) r.pellets.push(makePellet());

  // 3) rugs rétrécissent
  for (const p of Object.values(r.players)) {
    if (!p.alive) continue;
    const pr = radiusFromMass(p.mass);
    for (const rug of r.rugs) {
      const dx = p.x - rug.x, dy = p.y - rug.y;
      if (dx * dx + dy * dy <= (pr + rug.r) * (pr + rug.r)) {
        p.mass = Math.max(80, p.mass * 0.995); // ~0.5%/tick
      }
    }
  }

  // 4) joueurs mangent joueurs
  const alive = Object.values(r.players).filter(p => p.alive);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const A = alive[i], B = alive[j];
      const rA = radiusFromMass(A.mass), rB = radiusFromMass(B.mass);
      const dx = A.x - B.x, dy = A.y - B.y;
      if (dx * dx + dy * dy > (rA + rB) * (rA + rB)) continue;
      if (rA >= EAT_RATIO * rB) { A.mass += B.mass; B.alive = false; }
      else if (rB >= EAT_RATIO * rA) { B.mass += A.mass; A.alive = false; }
    }
  }

  // 5) fin de partie
  const still = Object.values(r.players).filter(p => p.alive);
  if (r.status === "running" && still.length <= 1) {
    const winner = still[0]?.name || null;
    broadcast(roomId, "over", { winner });
    clearInterval(r.loop!);
    r.loop = null;
    r.status = "waiting";
    spawnWorld(r);
    // soft reset des joueurs
    for (const p of Object.values(r.players)) {
      p.alive = true; p.mass = 100;
      p.x = rnd(200, MAP_W - 200); p.y = rnd(200, MAP_H - 200);
      p.vx = 0; p.vy = 0;
    }
    broadcast(roomId, "lobby", { status: r.status, players: lobbySnapshot(roomId) });
    return;
  }

  // 6) snapshot pour rendu client
  const snapshot = Object.values(r.players).map(p => ({
    id: p.id, x: p.x, y: p.y, r: radiusFromMass(p.mass),
    c: p.color, n: p.name, a: p.alive
  }));
  broadcast(roomId, "state", snapshot);
}

/* =============== Connexion IO ================= */
io.on("connection", (socket: Socket) => {
  socket.on("join", (payload: { roomId?: string; name?: string; color?: string; minPlayers?: number }) => {
    const roomId = payload.roomId || "default";
    const minPlayers = payload.minPlayers ?? 2;
    const r = ensureRoom(roomId, minPlayers);

    const id = crypto.randomUUID().slice(0, 6);
    const p: Player = {
      id,
      name: (payload.name || "anon").slice(0, 16),
      color: payload.color || "#33aaff",
      x: rnd(200, MAP_W - 200), y: rnd(200, MAP_H - 200),
      vx: 0, vy: 0,
      mass: 100,
      alive: true,
      lastInputAt: 0,
    };

    // attachements
    (socket.data as any).roomId = roomId;
    (socket.data as any).playerId = id;

    r.players[id] = p;
    socket.join(roomId);

    socket.emit("joined", { id, roomId, map: { w: MAP_W, h: MAP_H } });
    broadcast(roomId, "lobby", { status: r.status, players: lobbySnapshot(roomId) });
    startIfReady(roomId);
  });

  // input directionnel (dx,dy normalisés) – 20 Hz côté client recommandé
  socket.on("input", ({ dx, dy }: { dx: number; dy: number }) => {
    const rid = (socket.data as any).roomId;
    const pid = (socket.data as any).playerId;
    const r = rooms[rid]; if (!r) return;
    const p = r.players[pid]; if (!p || !p.alive) return;

    const now = Date.now();
    if (now - p.lastInputAt < 33) return; // throttle ~30Hz
    p.lastInputAt = now;

    const n = Math.hypot(dx, dy) || 1;
    p.vx = dx / n; p.vy = dy / n;
  });

  // fallback si ton client envoie encore "update" avec x/y (on le supporte)
  socket.on("update", (msg: { id?: string; player?: { x?: number; y?: number } }) => {
    const rid = (socket.data as any).roomId;
    const pid = (socket.data as any).playerId;
    const r = rooms[rid]; if (!r) return;
    const p = r.players[pid]; if (!p || !p.alive) return;
    if (msg?.player?.x != null) p.x = msg.player.x!;
    if (msg?.player?.y != null) p.y = msg.player.y!;
  });

  socket.on("disconnect", () => {
    const rid = (socket.data as any).roomId;
    const pid = (socket.data as any).playerId;
    if (!rid || !rooms[rid]) return;
    delete rooms[rid].players[pid];
    broadcast(rid, "lobby", { status: rooms[rid].status, players: lobbySnapshot(rid) });
    if (Object.keys(rooms[rid].players).length === 0) {
      clearInterval(rooms[rid].loop!);
      delete rooms[rid];
    }
  });
});

/* ================ Listen ====================== */
server.listen(PORT, () => {
  console.log(`✅ Server on :${PORT}  |  tick ${TICK_HZ} Hz  |  path /socket.io`);
});

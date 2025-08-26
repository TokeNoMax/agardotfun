import { v4 as uuidv4 } from "uuid";
import type { Player, PlayerInput, RoomState, Food } from "../types/game";

export class RoomManager {
  private rooms = new Map<string, RoomState>();

  list() {
    return [...this.rooms.values()].map(r => ({
      id: r.id, status: r.status, maxPlayers: r.maxPlayers, players: Object.keys(r.players).length
    }));
  }

  get(roomId: string) {
    return this.rooms.get(roomId);
  }

  ensure(roomId: string, maxPlayers = 8): RoomState {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        status: "waiting",
        maxPlayers,
        players: {},
        foods: this.spawnFoods(200),
        startedAt: null
      };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  create(roomId?: string, maxPlayers = 8) {
    const id = roomId || uuidv4().slice(0, 6);
    return this.ensure(id, maxPlayers);
  }

  addPlayer(roomId: string, name: string, color: string) {
    const room = this.ensure(roomId);
    if (Object.keys(room.players).length >= room.maxPlayers) {
      throw new Error("Room pleine");
    }
    const id = uuidv4();
    const p: Player = {
      id, name, color,
      x: Math.random() * 800 - 400,
      y: Math.random() * 800 - 400,
      r: 20,
      vx: 0, vy: 0,
      alive: true,
      lastSeq: 0
    };
    room.players[id] = p;
    if (room.status === "waiting" && Object.keys(room.players).length >= 2) {
      room.status = "playing";
      room.startedAt = Date.now();
    }
    return { room, player: p };
  }

  removePlayer(roomId: string, playerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    delete room.players[playerId];
    if (Object.keys(room.players).length === 0) {
      this.rooms.delete(roomId);
    }
  }

  applyInput(roomId: string, playerId: string, input: PlayerInput) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== "playing") return;
    const p = room.players[playerId];
    if (!p || !p.alive) return;
    if (input.seq <= p.lastSeq) return; // anti reorder
    p.lastSeq = input.seq;

    const speed = Math.max(60 - (p.r - 20) * 0.6, 15); // plus gros => plus lent
    // clamp
    const dx = Math.max(-1, Math.min(1, input.dx || 0));
    const dy = Math.max(-1, Math.min(1, input.dy || 0));

    p.vx = dx * speed;
    p.vy = dy * speed;
  }

  /** avance la simu et renvoie un snapshot compact */
  tick(dt: number) {
    for (const room of this.rooms.values()) {
      if (room.status !== "playing") continue;

      // positions
      for (const p of Object.values(room.players)) {
        if (!p.alive) continue;
        p.x += p.vx * (dt / 1000);
        p.y += p.vy * (dt / 1000);
      }

      // collisions player-food (simple)
      const eaten: string[] = [];
      for (const f of Object.values(room.foods)) {
        for (const p of Object.values(room.players)) {
          if (!p.alive) continue;
          const dx = f.x - p.x, dy = f.y - p.y;
          const d2 = dx*dx + dy*dy;
          if (d2 <= (p.r * p.r)) {
            eaten.push(f.id);
            p.r = Math.min(120, p.r + 0.4); // grossit un peu
            break;
          }
        }
      }
      // regenerate foods
      if (eaten.length) {
        for (const id of eaten) delete room.foods[id];
        const toAdd = eaten.length;
        const newFoods = this.spawnFoods(toAdd);
        Object.assign(room.foods, newFoods);
      }

      // win condition (dernier vivant)
      const alive = Object.values(room.players).filter(p => p.alive);
      if (alive.length <= 1) {
        room.status = "finished";
      }
    }
  }

  /** snapshot minimal pour broadcast */
  snapshot(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return {
      roomId: room.id,
      status: room.status,
      players: Object.values(room.players).map(p => ({
        id: p.id, x: p.x, y: p.y, r: p.r, c: p.color, n: p.name, alive: p.alive
      })),
      foods: Object.values(room.foods) // compactable plus tard
    };
  }

  private spawnFoods(n: number) {
    const foods: Record<string, Food> = {};
    for (let i = 0; i < n; i++) {
      const id = uuidv4();
      foods[id] = {
        id,
        x: Math.random() * 4000 - 2000,
        y: Math.random() * 4000 - 2000,
        r: 4 + Math.random() * 3
      };
    }
    return foods;
  }
}

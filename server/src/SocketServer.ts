import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { RoomManager } from "./rooms/RoomManager";

export class SocketServer {
  private app = express();
  private server = http.createServer(this.app);
  private io: Server;
  public rooms = new RoomManager();

  constructor(private port: number) {
    const allowed = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://*.glitch.me",
      "https://*.lovable.app"
    ];

    this.app.use(cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowed.some(a => a.includes("*")
          ? new RegExp("^" + a.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$").test(origin)
          : a === origin)) return cb(null, true);
        return cb(new Error("CORS: " + origin));
      },
      credentials: true
    }));
    this.app.get("/health", (_req, res) => res.send("ok"));
    this.app.get("/rooms", (_req, res) => res.json(this.rooms.list()));

    this.io = new Server(this.server, {
      cors: { origin: allowed, methods: ["GET","POST"], credentials: true },
      transports: ["websocket","polling"],
      pingInterval: 25000,
      pingTimeout: 60000
    });

    this.bindHandlers();

    this.server.listen(this.port, () => {
      console.log(`✅ Realtime server on :${this.port}`);
    });
  }

  private bindHandlers() {
    this.io.on("connection", (socket) => {
      let currentRoom: string | null = null;
      let currentPlayerId: string | null = null;

      socket.on("lobby:create", ({ roomId, max = 8, name, color }) => {
        const room = this.rooms.create(roomId, max);
        const { player } = this.rooms.addPlayer(room.id, name || "Player", color || "#00AEEF");
        currentRoom = room.id;
        currentPlayerId = player.id;
        socket.join(room.id);
        this.io.to(room.id).emit("lobby:update", { roomId: room.id, players: this.rooms.snapshot(room.id)?.players });
        if (Object.keys(room.players).length === room.maxPlayers) {
          this.io.to(room.id).emit("game:start", { roomId: room.id, t: Date.now() });
        }
      });

      socket.on("lobby:join", ({ roomId, name, color }) => {
        const room = this.rooms.ensure(roomId);
        const { player } = this.rooms.addPlayer(room.id, name || "Player", color || "#00AEEF");
        currentRoom = room.id;
        currentPlayerId = player.id;
        socket.join(room.id);
        this.io.to(room.id).emit("lobby:update", { roomId: room.id, players: this.rooms.snapshot(room.id)?.players });
      });

      socket.on("player:input", ({ roomId, input }) => {
        if (!roomId || roomId !== currentRoom || !currentPlayerId) return;
        this.rooms.applyInput(roomId, currentPlayerId, input);
      });

      socket.on("leave", () => {
        if (!currentRoom || !currentPlayerId) return;
        this.rooms.removePlayer(currentRoom, currentPlayerId);
        socket.leave(currentRoom);
        this.io.to(currentRoom).emit("player:left", { id: currentPlayerId });
        currentRoom = null;
        currentPlayerId = null;
      });

      socket.on("disconnect", () => {
        if (!currentRoom || !currentPlayerId) return;
        this.rooms.removePlayer(currentRoom, currentPlayerId);
        this.io.to(currentRoom).emit("player:left", { id: currentPlayerId });
      });
    });

    // boucle d'émission snapshots (20 Hz)
    setInterval(() => {
      for (const { id } of this.rooms.list()) {
        const snap = this.rooms.snapshot(id);
        if (snap) this.io.to(id).emit("state", snap);
      }
    }, 50);
  }

  /** tick de simu à appeler depuis index.ts */
  public tick(dt: number) {
    this.rooms.tick(dt);
  }
}

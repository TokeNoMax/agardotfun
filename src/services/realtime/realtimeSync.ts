
// realtimeSync.ts (v2) – Lovable‑ready
// --------------------------------------------------
//  ⭐️  INTERPOLATION BUFFER (smooth 60 fps) ⭐️
// --------------------------------------------------
// Synchro temps réel pour Agar.fun  
// * Supabase Realtime, un seul channel "game-<room>"  
// * Broadcast 20 Hz : id, x, y, r  
// * Heart‑beat infaillible : requestAnimationFrame + visibilitychange  
// * Buffer d'interpolation pour rendu smooth 60 FPS
// --------------------------------------------------

import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { InterpolationBuffer } from "./interpolationBuffer";

export interface BlobPayload {
  id: string;   // wallet / uuid (non vide)
  x: number;
  y: number;
  r: number;    // radius / score
  timestamp?: number; // timestamp pour l'interpolation
}

export interface RealtimeSyncOptions {
  supabase: SupabaseClient;
  roomId: string;
  myId: string;                           // sera rempli après login
  players: Record<string, any>;           // table des sprites
  createBlob: (id: string) => any;        // fabrique un sprite distant
  sendIntervalMs?: number;                // défaut 50 ms (20 Hz)
  enableInterpolation?: boolean;          // activer l'interpolation (défaut: true)
}

export class RealtimeSync {
  private ch: RealtimeChannel | null = null;
  private sendLoopId: ReturnType<typeof setInterval> | undefined;
  private interpolationLoopId: number | undefined;
  private lastPing = 0;
  private interpolationBuffer: InterpolationBuffer;
  private lastInterpolationTime = 0;

  constructor(private opts: RealtimeSyncOptions) {
    this.interpolationBuffer = new InterpolationBuffer();
  }

  // --------------------------------------------------
  // PUBLIC
  // --------------------------------------------------
  async connect() {
    const { supabase, roomId } = this.opts;

    this.ch = supabase.channel(`game-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    // réception des positions
    this.ch.on("broadcast", { event: "position" }, ({ payload }) =>
      this.handlePosition(payload as BlobPayload)
    );

    await this.ch.subscribe();

    // boucle émission (20 Hz par défaut)
    const pace = this.opts.sendIntervalMs ?? 50;
    this.sendLoopId = setInterval(() => this.broadcastPosition(), pace);

    // heartbeat : RAF + visibilitychange
    requestAnimationFrame(this.rafPing);
    document.addEventListener("visibilitychange", this.forcePing);

    // Démarrer l'interpolation à 60 FPS si activée
    if (this.opts.enableInterpolation !== false) {
      this.startInterpolationLoop();
    }
  }

  disconnect() {
    if (this.sendLoopId) clearInterval(this.sendLoopId);
    if (this.interpolationLoopId) cancelAnimationFrame(this.interpolationLoopId);
    document.removeEventListener("visibilitychange", this.forcePing);
    this.ch?.unsubscribe();
  }

  // --------------------------------------------------
  // PRIVATE
  // --------------------------------------------------
  private broadcastPosition() {
    const { myId, players } = this.opts;
    if (!myId) return;                        // évite id undefined
    const me = players[myId];
    if (!me) return;

    this.ch?.send({
      type: "broadcast",
      event: "position",
      payload: {
        id: myId,
        x: me.x,
        y: me.y,
        r: me.r ?? 0,
        timestamp: Date.now()
      } satisfies BlobPayload,
    });
  }

  private handlePosition(p: BlobPayload) {
    if (!p?.id || p.id === this.opts.myId) return; // filtre id vide et notre propre position
    
    if (this.opts.enableInterpolation !== false) {
      // Utiliser le buffer d'interpolation
      this.interpolationBuffer.addPosition(p.id, p.x, p.y, p.r, p.timestamp);
    } else {
      // Mode direct (ancien comportement)
      const { players, createBlob } = this.opts;
      const blob = players[p.id] ?? (players[p.id] = createBlob(p.id));
      blob.setPos(p.x, p.y);
      blob.setSize(Number.isFinite(p.r) ? p.r : 0);
    }
  }

  // Boucle d'interpolation à 60 FPS
  private startInterpolationLoop() {
    const interpolate = (timestamp: number) => {
      const deltaTime = timestamp - this.lastInterpolationTime;
      this.lastInterpolationTime = timestamp;

      // Interpoler toutes les positions
      const interpolatedPositions = this.interpolationBuffer.interpolateAll(deltaTime);

      // Appliquer les positions interpolées
      const { players, createBlob } = this.opts;
      for (const [id, pos] of interpolatedPositions) {
        if (id !== this.opts.myId) { // Ne pas interpoler notre propre joueur
          const blob = players[id] ?? (players[id] = createBlob(id));
          blob.setPos(pos.x, pos.y);
          blob.setSize(Number.isFinite(pos.r) ? pos.r : 0);
        }
      }

      // Nettoyer les blobs inactifs toutes les 5 secondes
      if (timestamp % 5000 < 16) {
        this.interpolationBuffer.cleanup();
      }

      this.interpolationLoopId = requestAnimationFrame(interpolate);
    };

    this.lastInterpolationTime = performance.now();
    this.interpolationLoopId = requestAnimationFrame(interpolate);
  }

  // ---------- heartbeat fiable ----------
  private rafPing = (time: number) => {
    if (time - this.lastPing > 9500) {        // ~9,5 s
      this.ch?.track({ t: Date.now() });
      this.lastPing = time;
    }
    requestAnimationFrame(this.rafPing);
  };

  private forcePing = () => {
    if (document.visibilityState === "hidden") {
      this.ch?.track({ t: Date.now() });
      this.lastPing = performance.now();
    }
  };
}

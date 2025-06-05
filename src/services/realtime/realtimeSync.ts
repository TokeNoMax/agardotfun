
// realtimeSync.ts (v2) – Lovable‑ready
// --------------------------------------------------
// Synchro temps réel pour Agar.fun  
// * Supabase Realtime, un seul channel "game-<room>"  
// * Broadcast 20 Hz : id, x, y, r  
// * Heart‑beat infaillible : requestAnimationFrame + visibilitychange  
// --------------------------------------------------

import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

export interface BlobPayload {
  id: string;   // wallet / uuid (non vide)
  x: number;
  y: number;
  r: number;    // radius / score
}

export interface RealtimeSyncOptions {
  supabase: SupabaseClient;
  roomId: string;
  myId: string;                           // sera rempli après login
  players: Record<string, any>;           // table des sprites
  createBlob: (id: string) => any;        // fabrique un sprite distant
  sendIntervalMs?: number;                // défaut 50 ms (20 Hz)
}

export class RealtimeSync {
  private ch: RealtimeChannel | null = null;
  private sendLoopId: ReturnType<typeof setInterval> | undefined;
  private lastPing = 0;

  constructor(private opts: RealtimeSyncOptions) {}

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
  }

  disconnect() {
    if (this.sendLoopId) clearInterval(this.sendLoopId);
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
      } satisfies BlobPayload,
    });
  }

  private handlePosition(p: BlobPayload) {
    if (!p?.id) return;                       // filtre id vide
    const { players, createBlob } = this.opts;
    const blob = players[p.id] ?? (players[p.id] = createBlob(p.id));
    blob.setPos(p.x, p.y);
    blob.setSize(Number.isFinite(p.r) ? p.r : 0);
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

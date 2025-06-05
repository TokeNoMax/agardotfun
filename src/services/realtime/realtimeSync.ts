
// realtimeSync.ts
// --------------------------------------------------
// Service minimal pour la synchro temps‑réel d'un jeu type Agar.io
// ➜ utilise Supabase Realtime (un seul channel par room)
// ➜ broadcast 20 Hz : id, x, y, r (radius / score)
// ➜ heartbeat présence 10 s pour éviter les kicks fantômes
// --------------------------------------------------

import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

export interface BlobPayload {
  id: string; // player / wallet id (non vide)
  x: number;
  y: number;
  r: number;  // radius / score
}

export interface RealtimeSyncOptions {
  supabase: SupabaseClient;
  roomId: string;
  myId: string;                          // adresse wallet / UUID
  players: Record<string, any>;          // table des sprites
  createBlob: (id: string) => any;       // fabrique un sprite distant
  sendIntervalMs?: number;               // défaut 50 ms (20 Hz)
}

export class RealtimeSync {
  private ch: RealtimeChannel | null = null;
  private sendLoopId: any;
  private heartbeatId: any;

  constructor(private opts: RealtimeSyncOptions) {}

  /** Initialise la connexion et démarre la boucle */
  async connect() {
    const { supabase, roomId } = this.opts;

    this.ch = supabase.channel(`game-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    // --- listener positions ---
    this.ch.on(
      "broadcast",
      { event: "position" },
      ({ payload }) => this.handlePosition(payload as BlobPayload)
    );

    await this.ch.subscribe();

    // --- boucle d'envoi 20 Hz (ou custom) ---
    const pace = this.opts.sendIntervalMs ?? 50;
    this.sendLoopId = setInterval(() => this.broadcastPosition(), pace);

    // --- heartbeat présence 10 s ---
    this.heartbeatId = setInterval(() => {
      this.ch?.track({ t: Date.now() });
    }, 10_000);
  }

  /** Nettoie tout (appelé quand on quitte la page / room) */
  disconnect() {
    clearInterval(this.sendLoopId);
    clearInterval(this.heartbeatId);
    this.ch?.unsubscribe();
  }

  // ------------------------------------------------------------------
  // PRIVÉ : gestion des positions
  // ------------------------------------------------------------------

  private broadcastPosition() {
    const { myId, players } = this.opts;
    if (!myId) return; // id non initialisé ⇒ on attend

    const me = players[myId];
    if (!me) return;

    this.ch?.send({
      type: "broadcast",
      event: "position",
      payload: {
        id: myId,
        x: me.x,
        y: me.y,
        r: me.r,
      } satisfies BlobPayload,
    });
  }

  private handlePosition(p: BlobPayload) {
    if (!p?.id) return; // ignore id vide

    const { players, createBlob } = this.opts;
    const blob = players[p.id] ?? (players[p.id] = createBlob(p.id));

    blob.setPos(p.x, p.y);
    blob.setSize(p.r);
  }
}

// ------------------------------------------------------------------
// Exemple d'utilisation (React ou vanilla)
// ------------------------------------------------------------------
/*
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sync = new RealtimeSync({
  supabase,
  roomId: "abc123",
  myId: walletAddress,
  players,
  createBlob: (id) => new BlobSprite(id),
});

sync.connect();

window.addEventListener("beforeunload", () => sync.disconnect());
*/

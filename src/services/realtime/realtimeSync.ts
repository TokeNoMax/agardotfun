
// realtimeSync.ts (v3) – RÉCAP COMPLET
// --------------------------------------------------
// • Broadcast temps‑réel 30 Hz : id, x, y, r
// • Broadcast score immédiat quand r change
// • Interpolation 60 fps (Hermite optionnelle) côté rendu
// • Heart‑beat anti‑ghost via RAF + visibilitychange
// --------------------------------------------------

import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

export interface PosPayload { id: string; x: number; y: number; r: number }
export interface ScorePayload { id: string; r: number }

export interface RealtimeSyncOptions {
  supabase: SupabaseClient;
  roomId: string;
  myId: string;                           // wallet / uuid (non vide après login)
  players: Record<string, any>;           // table des sprites
  createBlob: (id: string) => any;        // fabrique un sprite distant
  sendIntervalMs?: number;                // défaut 33 ms (30 Hz)
  onScoreUpdate?: (id: string, r: number) => void; // pour le leaderboard UI
}

export class RealtimeSync {
  private ch: RealtimeChannel | null = null;
  private sendLoopId: ReturnType<typeof setInterval> | undefined;
  private lastPing = 0;
  private prevR = 0;

  constructor(private opts: RealtimeSyncOptions) {}

  // --------------------------------------------------
  // PUBLIC
  // --------------------------------------------------
  async connect() {
    const { supabase, roomId } = this.opts;

    this.ch = supabase.channel(`game-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    // listener positions & scores - FIXED: correct event listener syntax
    this.ch.on('broadcast', { event: 'position' }, ({ payload }) => {
      this.handlePosition(payload as PosPayload);
    });
    
    this.ch.on('broadcast', { event: 'score' }, ({ payload }) => {
      this.handleScore(payload as ScorePayload);
    });

    await this.ch.subscribe();

    // boucle émission position
    const pace = this.opts.sendIntervalMs ?? 33;
    this.sendLoopId = setInterval(() => this.broadcastPosition(), pace);

    // heartbeat
    requestAnimationFrame(this.rafPing);
    document.addEventListener('visibilitychange', this.forcePing);
  }

  disconnect() {
    if (this.sendLoopId) clearInterval(this.sendLoopId);
    document.removeEventListener('visibilitychange', this.forcePing);
    this.ch?.unsubscribe();
  }

  /** À appeler quand ton blob grossit (kill, pellet) */
  updateLocalScore(newR: number) {
    if (!this.ch || newR === this.prevR || !Number.isFinite(newR)) return;
    this.prevR = newR;
    this.ch.send({
      type: 'broadcast', event: 'score',
      payload: { id: this.opts.myId, r: newR } satisfies ScorePayload,
    });
    this.opts.onScoreUpdate?.(this.opts.myId, newR);
  }

  // --------------------------------------------------
  // PRIVATE
  // --------------------------------------------------
  private broadcastPosition() {
    const { myId, players } = this.opts;
    if (!myId) return;
    const me = players[myId];
    if (!me || !Number.isFinite(me.x) || !Number.isFinite(me.y)) return;

    this.ch?.send({
      type: 'broadcast', event: 'position',
      payload: { id: myId, x: me.x, y: me.y, r: me.r ?? 0 } satisfies PosPayload,
    });
  }

  private handlePosition(p: PosPayload) {
    if (!p?.id || p.id === this.opts.myId) return; // filter own position
    const { players, createBlob } = this.opts;
    const blob = players[p.id] ?? (players[p.id] = createBlob(p.id));
    blob.setPos(p.x, p.y);
    blob.setSize(Number.isFinite(p.r) ? p.r : 0);
    
    // Push to interpolation buffer
    pushSnapshot(p.id, p.x, p.y);
  }

  private handleScore(p: ScorePayload) {
    if (!p?.id) return;
    const blob = this.opts.players[p.id];
    blob?.setSize(p.r);
    this.opts.onScoreUpdate?.(p.id, p.r);
  }

  // heartbeat via RAF
  private rafPing = (t: number) => {
    if (t - this.lastPing > 9500) {
      this.ch?.track({ t: Date.now() });
      this.lastPing = t;
    }
    requestAnimationFrame(this.rafPing);
  };
  
  private forcePing = () => {
    if (document.visibilityState === 'hidden') {
      this.ch?.track({ t: Date.now() });
      this.lastPing = performance.now();
    }
  };
}

// --------------------------------------------------
// Interpolation helper (linéaire ou Hermite)
// --------------------------------------------------
export interface Snapshot { x: number; y: number; t: number }
export const snapshots: Record<string, Snapshot[]> = {};

export function pushSnapshot(id: string, x: number, y: number) {
  const arr = (snapshots[id] ??= []);
  arr.push({ x, y, t: performance.now() });
  if (arr.length > 4) arr.shift();
}

export function getInterpolatedPos(id: string): { x: number; y: number } | null {
  const [a, b] = snapshots[id] || [];
  if (!a || !b) return null;
  const now = performance.now();
  const dt = b.t - a.t || 1;
  const t = (now - b.t) / dt;
  const lerp = (u: number, v: number) => u + (v - u) * Math.max(0, Math.min(1, t));
  return { x: lerp(a.x, b.x), y: lerp(a.y, b.y) };
}

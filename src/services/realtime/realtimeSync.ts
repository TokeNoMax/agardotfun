
// realtimeSync.ts (v4) – INTERPOLATION HERMITE AVEC VÉLOCITÉS
// --------------------------------------------------
// • Broadcast temps‑réel 30 Hz : id, x, y, r, vx, vy
// • Broadcast score immédiat quand r change
// • Interpolation 60 fps Hermite avec vélocités côté rendu
// • Heart‑beat anti‑ghost via RAF + visibilitychange
// --------------------------------------------------

import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

export interface PosPayload { 
  id: string; 
  x: number; 
  y: number; 
  r: number;
  vx: number;   // px/s  (new)
  vy: number;   // px/s  (new)
}
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
  // Variables pour le calcul de vélocité
  private prevX = 0;
  private prevY = 0;
  private readonly dt = 1 / 30;           // 33 ms

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

    // ----  B.  émission côté joueur local avec vélocités ----------
    const vx = (me.x - this.prevX) / this.dt;
    const vy = (me.y - this.prevY) / this.dt;

    this.ch?.send({
      type: 'broadcast', event: 'position',
      payload: { id: myId, x: me.x, y: me.y, r: me.r ?? 0, vx, vy } satisfies PosPayload,
    });

    // Mémoriser pour le prochain calcul de vélocité
    this.prevX = me.x;
    this.prevY = me.y;
  }

  private handlePosition(p: PosPayload) {
    if (!p?.id || p.id === this.opts.myId) return; // filter own position
    const { players, createBlob } = this.opts;
    const blob = players[p.id] ?? (players[p.id] = createBlob(p.id));
    blob.setSize(Number.isFinite(p.r) ? p.r : 0);
    
    // ----  C.  côté réception – on garde 3 snapshots ----------
    pushSnapshot(p.id, p.x, p.y, p.vx, p.vy);
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
// Système de snapshots avec vélocités pour Hermite
// --------------------------------------------------
export interface Snapshot { x: number; y: number; t: number }
export interface Snap { x: number; y: number; vx: number; vy: number; t: number }

export const snapshots: Record<string, Snapshot[]> = {};
export const snaps: Record<string, Snap[]> = {};

export function pushSnapshot(id: string, x: number, y: number, vx: number, vy: number) {
  const arr = (snaps[id] ??= []);
  arr.push({ x, y, vx, vy, t: performance.now() });
  if (arr.length > 3) arr.shift();
}

// ----  D.  interpolation Hermite ----------
export function hermite(a: Snap, b: Snap, t: number) {
  const dt = b.t - a.t || 1;
  const h = t / dt;
  const h2 = h * h, h3 = h2 * h;
  const h00 = 2 * h3 - 3 * h2 + 1;
  const h10 = h3 - 2 * h2 + h;
  const h01 = -2 * h3 + 3 * h2;
  const h11 = h3 - h2;
  return {
    x: a.x * h00 + a.vx * dt * h10 + b.x * h01 + b.vx * dt * h11,
    y: a.y * h00 + a.vy * dt * h10 + b.y * h01 + b.vy * dt * h11,
  };
}

export function getInterpolatedPosHermite(id: string): { x: number; y: number } | null {
  const [a, b] = snaps[id] || [];
  if (!a || !b) return null;
  
  const now = performance.now();
  // on se place 100 ms dans le passé
  const renderTime = now - 100;
  
  if (renderTime < a.t) return null;               // trop tôt
  
  if (renderTime > b.t) {                          // extrapole gentiment
    const dt = (renderTime - b.t) / 1000;
    return {
      x: b.x + b.vx * dt,
      y: b.y + b.vy * dt
    };
  } else {
    return hermite(a, b, renderTime - a.t);
  }
}

// Ancien système pour compatibilité
export function getInterpolatedPos(id: string): { x: number; y: number } | null {
  return getInterpolatedPosHermite(id);
}

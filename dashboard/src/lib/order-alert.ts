/**
 * Browser ringtone for incoming online shop orders (Web Audio API — no asset file).
 */

let sharedCtx: AudioContext | null = null;
let loopTimer: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!sharedCtx) sharedCtx = new AC();
    if (sharedCtx.state === 'suspended') void sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

function tone(ctx: AudioContext, freq: number, start: number, dur: number, gain = 0.18) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** One alert sequence (~1.4s): ascending chime. */
export function playOrderAlertOnce(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  tone(ctx, 880, t0, 0.18, 0.2);
  tone(ctx, 1175, t0 + 0.2, 0.18, 0.2);
  tone(ctx, 1480, t0 + 0.4, 0.28, 0.22);
  tone(ctx, 1175, t0 + 0.75, 0.15, 0.14);
  tone(ctx, 1480, t0 + 0.95, 0.35, 0.2);
}

/** Repeat ringtone until stopOrderAlertLoop() — used while new orders are waiting. */
export function startOrderAlertLoop(intervalMs = 4500): void {
  if (loopTimer) return;
  playOrderAlertOnce();
  loopTimer = setInterval(() => playOrderAlertOnce(), intervalMs);
}

export function stopOrderAlertLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
}

export function isOrderAlertLooping(): boolean {
  return loopTimer != null;
}

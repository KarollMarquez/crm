const API_ORIGIN =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  (typeof process !== "undefined" && process.env.API_URL) ||
  "http://127.0.0.1:3001";

export function apiOrigin() {
  if (typeof window === "undefined") return API_ORIGIN;
  return process.env.NEXT_PUBLIC_API_URL || API_ORIGIN;
}

/** Soft chime via Web Audio — no asset file needed. */
export function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const tones = [
      { freq: 880, start: 0, dur: 0.12 },
      { freq: 1174.66, start: 0.1, dur: 0.18 },
    ];

    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = tone.freq;
      gain.gain.setValueAtTime(0.0001, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + tone.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.dur + 0.02);
    }

    window.setTimeout(() => {
      void ctx.close();
    }, 500);
  } catch {
    /* ignore autoplay / AudioContext errors */
  }
}

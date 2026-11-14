export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Measures the display refresh rate from the intervals between animation frames.
export function measureRefresh(frames = 60): Promise<{ hz: number; medianMs: number }> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let prev: number | null = null;
    const tick = (ts: number) => {
      if (prev !== null) deltas.push(ts - prev);
      prev = ts;
      if (deltas.length >= frames) {
        const medianMs = median(deltas);
        resolve({ hz: 1000 / medianMs, medianMs });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

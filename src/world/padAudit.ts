import type { Box, CityLayout } from './CityGenerator';

/**
 * Pad fairness audit (round 15). With a new city on every load, every seed must give pads a player can reach.
 * A pad is fair when the drone can drop straight down onto it from the flight ceiling: the vertical column above the
 * pad, `clearR` wide, holds no collider (no tree canopy, setback tier, water tower, mast, cornice or wall over it), the
 * drone's landing sphere is not inside anything (not buried), and no drawn-only awning hangs over it. Streets are an
 * open grid at every height, so a pad with a clear column is reachable. Pads outside the city edge are reported too.
 */
export type PadIssue = { site: string; kind: string; problem: 'buried' | 'overhang' | 'awning' | 'outside'; detail: string };

const distXZ = (b: Box, x: number, z: number) => {
  const dx = Math.max(b.minX - x, 0, x - b.maxX);
  const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
  return Math.hypot(dx, dz);
};

export function auditPads(layout: CityLayout, ceiling = 105, clearR = 1.2, droneR = 0.95): PadIssue[] {
  const issues: PadIssue[] = [];
  for (const s of layout.sites) {
    const { x, y, z } = s.pos;
    if (Math.abs(x) > layout.half || Math.abs(z) > layout.half) issues.push({ site: s.name, kind: s.kind, problem: 'outside', detail: `${x.toFixed(1)}, ${z.toFixed(1)}` });
    const hoverY = y + droneR + 0.25; // drone centre when it sits on the pad
    for (const b of layout.colliders) {
      if (b.maxY <= y + 0.35) continue; // the block the pad sits on, kerbs, the pad itself
      const d = distXZ(b, x, z);
      // buried: the landing sphere overlaps a box that reaches the pad height
      const dy = Math.max(b.minY - hoverY, 0, hoverY - b.maxY);
      if (Math.hypot(d, dy) < droneR) {
        issues.push({ site: s.name, kind: s.kind, problem: 'buried', detail: `box top ${b.maxY.toFixed(1)} at ${d.toFixed(2)} m${b.soft ? ' (soft)' : ''}` });
        continue;
      }
      // overhang: anything in the column above the pad up to the ceiling
      if (d < clearR && b.minY < ceiling) issues.push({ site: s.name, kind: s.kind, problem: 'overhang', detail: `box ${b.minY.toFixed(1)}-${b.maxY.toFixed(1)} m at ${d.toFixed(2)} m${b.soft ? ' (soft)' : ''}` });
    }
    // drawn-only awnings: the drone would pass through them on the way down, which reads as a pad under a roof
    for (const b of layout.awnings) {
      const d = distXZ(b, x, z);
      if (d < droneR) issues.push({ site: s.name, kind: s.kind, problem: 'awning', detail: `awning at ${d.toFixed(2)} m` });
    }
  }
  return issues;
}

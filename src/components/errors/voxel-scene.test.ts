import { describe, expect, it } from 'vitest';
import { cellsOf, sceneOf } from './voxel-scene';

describe('sceneOf', () => {
  it('draws a lone block as its front, top and left side, each fully outlined', () => {
    const { faces } = sceneOf(new Set(['0,0']));

    expect(faces.map((face) => face.kind).sort()).toEqual(['front', 'side', 'top']);
    faces.forEach((face) => expect(face.edges).toHaveLength(4));
  });

  it('merges neighbours into one solid: no seam where two blocks touch', () => {
    const { faces } = sceneOf(new Set(['0,0', '1,0']));
    const fronts = faces.filter((face) => face.kind === 'front');

    // The right block has no left side (its neighbour covers it), and the two
    // fronts share an edge that neither strokes.
    expect(faces.filter((face) => face.kind === 'side')).toHaveLength(1);
    expect(fronts.map((face) => face.edges.length)).toEqual([3, 3]);
  });

  it('paints farther blocks first', () => {
    // The camera sits toward -x: the block at x=3 is farther than x=0.
    const { faces } = sceneOf(new Set(['0,0', '3,0']));
    const firstFront = faces.find((face) => face.kind === 'front');
    const lastFront = faces.findLast((face) => face.kind === 'front');

    expect(firstFront?.points[0]?.[0]).toBeGreaterThan(lastFront?.points[0]?.[0] ?? Infinity);
  });

  it('frames every face inside its viewBox', () => {
    const { faces, viewBox } = sceneOf(cellsOf('404'));

    for (const [x, y] of faces.flatMap((face) => face.points)) {
      expect(x).toBeGreaterThanOrEqual(viewBox.x);
      expect(y).toBeGreaterThanOrEqual(viewBox.y);
      expect(x).toBeLessThanOrEqual(viewBox.x + viewBox.width);
      expect(y).toBeLessThanOrEqual(viewBox.y + viewBox.height);
    }
  });
});

describe('cellsOf', () => {
  it('lays numerals out left to right with a gap between them', () => {
    const cells = cellsOf('40');

    expect(cells.has('0,3')).toBe(true); // the 4's crossbar starts at the left edge
    expect(cells.has('6,0')).toBe(false); // the gap column
    expect(cells.has('7,1')).toBe(true); // the 0's left stroke
  });

  it('refuses a character it has no block for', () => {
    expect(() => cellsOf('4x4')).toThrow(/No block glyph/);
  });
});

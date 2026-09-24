import { describe, expect, it } from 'vitest';
import { layoutJourney, type JourneyFrame, type JourneySource } from './journey-flow';

const FRAME: JourneyFrame = {
  sourceX: 100,
  targetX: 500,
  top: 10,
  height: 300,
  sourceGap: 10,
  targetGap: 20,
};

const SOURCES: readonly JourneySource[] = [
  { name: 'Instagram', conversations: 2000, purchaseRate: 0.75 },
  { name: 'WhatsApp', conversations: 1000, purchaseRate: 0.5 },
  { name: 'SMS', conversations: 1000, purchaseRate: 0.25 },
];

/** The y values a ribbon path passes through, in the order it draws them. */
function pathYs(path: string): number[] {
  const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];

  return numbers.filter((_, index) => index % 2 === 1);
}

describe('layoutJourney', () => {
  it('reports the purchase rate across every channel, not the mean of the rates', () => {
    const layout = layoutJourney(SOURCES, FRAME);

    // (1500 + 500 + 250) / 4000, where the mean of the three rates is 0.5.
    expect(layout.purchaseRate).toBeCloseTo(0.5625);
    expect(layout.purchased.detail).toBe('56%');
    expect(layout.dropped.detail).toBe('44%');
  });

  it('sizes a channel bar by its conversations and keeps the gaps between bars', () => {
    const [first, second, third] = layoutJourney(SOURCES, FRAME).sources;

    expect(first?.height).toBeCloseTo(2 * (second?.height ?? 0));
    expect(second?.height).toBeCloseTo(third?.height ?? 0);
    expect((second?.y ?? 0) - ((first?.y ?? 0) + (first?.height ?? 0))).toBeCloseTo(10);
    expect(first?.detail).toBe('2,000 conversations');
  });

  it('fits both columns inside the frame', () => {
    const layout = layoutJourney(SOURCES, FRAME);
    const lastSource = layout.sources.at(-1);

    expect(layout.sources[0]?.y).toBe(FRAME.top);
    expect((lastSource?.y ?? 0) + (lastSource?.height ?? 0)).toBeLessThanOrEqual(
      FRAME.top + FRAME.height + 1e-9
    );
    expect(layout.purchased.y).toBeGreaterThanOrEqual(FRAME.top);
    expect(layout.dropped.y + layout.dropped.height).toBeLessThanOrEqual(
      FRAME.top + FRAME.height + 1e-9
    );
  });

  it('lands the ribbons exactly on their outcome bar, one after another', () => {
    const layout = layoutJourney(SOURCES, FRAME);
    const purchased = layout.ribbons.filter(ribbon => ribbon.outcome === 'purchased');

    // Each purchased ribbon's landing edge (its 4th and 5th y) starts where
    // the one before it ended, and the last one ends at the bar's foot.
    let cursor = layout.purchased.y;

    for (const ribbon of purchased) {
      const [, , , landTop, landBottom] = pathYs(ribbon.path);

      expect(landTop).toBeCloseTo(cursor, 1);
      cursor = landBottom ?? Number.NaN;
    }
    expect(cursor).toBeCloseTo(layout.purchased.y + layout.purchased.height, 1);
  });

  it('draws two ribbons per channel that together cover its bar', () => {
    const layout = layoutJourney(SOURCES, FRAME);

    expect(layout.ribbons).toHaveLength(SOURCES.length * 2);
    layout.sources.forEach((node, index) => {
      const boughtYs = pathYs(layout.ribbons[index * 2]?.path ?? '');
      const droppedYs = pathYs(layout.ribbons[index * 2 + 1]?.path ?? '');

      expect(boughtYs[0]).toBeCloseTo(node.y, 1);
      expect(droppedYs.at(-1)).toBeCloseTo(node.y + node.height, 1);
    });
  });
});

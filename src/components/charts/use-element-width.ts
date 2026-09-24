'use client';

import { useEffect, useState } from 'react';

/**
 * The rendered width of an element, kept current as it resizes, so a chart
 * can draw at its real pixel size (a stretched viewBox would thin the lines
 * and squash the dots). Returns a callback ref and the width; the width is 0
 * until the first measurement, and charts draw nothing until then.
 */
export function useElementWidth<T extends Element>(): [(node: T | null) => void, number] {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!node) return;

    // ResizeObserver reports once on observe, then on every change.
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) setWidth(Math.round(entry.contentRect.width));
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [node]);

  return [setNode, width];
}

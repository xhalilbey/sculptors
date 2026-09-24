/**
 * The geometry of the hero dashboard's "Conversation journey": a two-column
 * Sankey where every channel on the left splits into the conversations that
 * ended in a purchase and the ones that did not.
 *
 * It is pure arithmetic over the figures, so the picture cannot disagree
 * with its own labels: a ribbon's thickness is its share of the whole, the
 * two ribbons leaving a channel exactly cover that channel's bar, and the
 * ribbons arriving at an outcome exactly cover the outcome's bar.
 */

export type JourneySource = {
  readonly name: string;
  readonly conversations: number;
  /** Share of this channel's conversations that ended in a purchase, 0..1. */
  readonly purchaseRate: number;
};

export type JourneyNode = {
  readonly label: string;
  readonly detail: string;
  readonly y: number;
  readonly height: number;
};

export type JourneyRibbon = {
  readonly outcome: 'purchased' | 'dropped';
  readonly path: string;
};

export type JourneyLayout = {
  readonly sources: readonly JourneyNode[];
  readonly purchased: JourneyNode;
  readonly dropped: JourneyNode;
  readonly ribbons: readonly JourneyRibbon[];
  /** Purchases over conversations across every channel, 0..1. */
  readonly purchaseRate: number;
};

export type JourneyFrame = {
  /** Right edge of the channel bars; the ribbons leave from here. */
  readonly sourceX: number;
  /** Left edge of the outcome bars; the ribbons arrive here. */
  readonly targetX: number;
  readonly top: number;
  readonly height: number;
  /** Space between two channel bars. */
  readonly sourceGap: number;
  /** Space between the two outcome bars. */
  readonly targetGap: number;
};

const count = new Intl.NumberFormat('en-US');
const percent = (share: number) => `${Math.round(share * 100)}%`;

/** One ribbon: a band whose two edges are the same S-curve, offset. */
function ribbonPath(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number
): string {
  const mid = (x0 + x1) / 2;
  const r = (n: number) => Math.round(n * 100) / 100;

  return [
    `M${r(x0)} ${r(y0)}`,
    `C${r(mid)} ${r(y0)} ${r(mid)} ${r(y1)} ${r(x1)} ${r(y1)}`,
    `L${r(x1)} ${r(y1 + thickness)}`,
    `C${r(mid)} ${r(y1 + thickness)} ${r(mid)} ${r(y0 + thickness)} ${r(x0)} ${r(y0 + thickness)}`,
    'Z',
  ].join(' ');
}

export function layoutJourney(
  sources: readonly JourneySource[],
  frame: JourneyFrame
): JourneyLayout {
  const total = sources.reduce((sum, source) => sum + source.conversations, 0);
  const bought = sources.map(source => source.conversations * source.purchaseRate);
  const boughtTotal = bought.reduce((sum, value) => sum + value, 0);

  // One scale for both columns, set by the taller of the two, so a ribbon is
  // equally thick where it leaves and where it lands.
  const sourceSpan = frame.height - frame.sourceGap * Math.max(0, sources.length - 1);
  const targetSpan = frame.height - frame.targetGap;
  const scale = Math.min(sourceSpan, targetSpan) / total;

  const sourceNodes: JourneyNode[] = [];
  let sourceY = frame.top;

  for (const source of sources) {
    const height = source.conversations * scale;

    sourceNodes.push({
      label: source.name,
      detail: `${count.format(source.conversations)} conversations`,
      y: sourceY,
      height,
    });
    sourceY += height + frame.sourceGap;
  }

  // The outcomes stand centred against the channels, purchases on top.
  const targetHeight = total * scale + frame.targetGap;
  const purchasedY = frame.top + (frame.height - targetHeight) / 2;
  const purchasedHeight = boughtTotal * scale;
  const droppedY = purchasedY + purchasedHeight + frame.targetGap;
  const droppedHeight = (total - boughtTotal) * scale;
  const purchaseRate = total === 0 ? 0 : boughtTotal / total;

  const ribbons: JourneyRibbon[] = [];
  let purchasedCursor = purchasedY;
  let droppedCursor = droppedY;

  sources.forEach((source, index) => {
    const node = sourceNodes[index];
    const boughtHere = bought[index];

    if (!node || boughtHere === undefined) return;

    // Each channel's bar is split top to bottom: purchases, then the rest.
    const boughtThickness = boughtHere * scale;
    const droppedThickness = node.height - boughtThickness;

    ribbons.push({
      outcome: 'purchased',
      path: ribbonPath(frame.sourceX, node.y, frame.targetX, purchasedCursor, boughtThickness),
    });
    ribbons.push({
      outcome: 'dropped',
      path: ribbonPath(
        frame.sourceX,
        node.y + boughtThickness,
        frame.targetX,
        droppedCursor,
        droppedThickness
      ),
    });

    purchasedCursor += boughtThickness;
    droppedCursor += droppedThickness;
  });

  return {
    sources: sourceNodes,
    purchased: {
      label: 'Purchased',
      detail: percent(purchaseRate),
      y: purchasedY,
      height: purchasedHeight,
    },
    dropped: {
      label: 'Dropped',
      detail: percent(1 - purchaseRate),
      y: droppedY,
      height: droppedHeight,
    },
    ribbons,
    purchaseRate,
  };
}

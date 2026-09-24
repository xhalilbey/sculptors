import type { CSSProperties } from 'react';

/*
 * The marketplace marquee under the hero's two buttons.
 *
 * Every mark is drawn as a silhouette: the SVG is a CSS mask and the colour
 * comes from the strip, so twenty logos that ship in twenty different brand
 * colours (Alibaba orange, Shopee red, Coupang's five-colour wordmark) land on
 * the page as one flat ink tone. Nothing here carries a gradient, a highlight
 * or a shadow -- the strip is a footnote under the buttons, not a second thing
 * to press.
 *
 * Each file's viewBox was retightened to the artwork's own bounding box, so a
 * shared height is a shared letter height: the boxes Wikimedia and Simple Icons
 * ship are padded differently, and at equal box heights Tesco's wordmark came
 * out a third the size of Trendyol's. `ratio` is that tight box's width/height,
 * which is what gives every mark its width without measuring the DOM.
 */

type Mark = {
  readonly name: string;
  readonly file: string;
  /** width / height of the artwork's tight bounding box. */
  readonly ratio: number;
  /**
   * A multiplier on the shared height, for marks whose box is taller than their
   * letters -- an icon beside the word, or caps with no descender to spend.
   */
  readonly scale?: number;
};

/*
 * Asia and Europe alternate on purpose: grouped, the strip reads as two lists
 * that happen to share a rail rather than one market.
 */
const MARKS: readonly Mark[] = [
  { name: 'Trendyol', file: 'trendyol.svg', ratio: 4.3804 },
  { name: 'Zalando', file: 'zalando.svg', ratio: 4.9636 },
  { name: 'Alibaba', file: 'alibaba.svg', ratio: 6.3361, scale: 0.8 },
  { name: 'Zara', file: 'zara.svg', ratio: 2.3774, scale: 0.86 },
  { name: 'Shopee', file: 'shopee.svg', ratio: 3.1279, scale: 0.92 },
  { name: 'Otto', file: 'otto.svg', ratio: 2.963, scale: 0.72 },
  { name: 'Zomato', file: 'zomato.svg', ratio: 4.7303 },
  { name: 'Allegro', file: 'allegro.svg', ratio: 3.235 },
  { name: 'Lazada', file: 'lazada.svg', ratio: 3.8162, scale: 0.92 },
  { name: 'Tesco', file: 'tesco.svg', ratio: 3.7395, scale: 0.86 },
  { name: 'Rakuten', file: 'rakuten.svg', ratio: 4.9407, scale: 0.92 },
  { name: 'bol.com', file: 'bol.svg', ratio: 4.1935 },
  { name: 'Coupang', file: 'coupang.svg', ratio: 4.4439 },
  { name: 'Farfetch', file: 'farfetch.svg', ratio: 8.053, scale: 0.8 },
  { name: 'AliExpress', file: 'aliexpress.svg', ratio: 4.6164, scale: 0.92 },
  { name: 'Glovo', file: 'glovo.svg', ratio: 3.0501, scale: 0.92 },
  { name: 'Tokopedia', file: 'tokopedia.svg', ratio: 4.6432 },
  { name: 'IKEA', file: 'ikea.svg', ratio: 2.5, scale: 0.86 },
  { name: 'Grab', file: 'grab.svg', ratio: 2.8169, scale: 0.86 },
  { name: 'Paytm', file: 'paytm.svg', ratio: 3.1303, scale: 0.86 },
];

function Row({ ariaHidden = false }: { readonly ariaHidden?: boolean }) {
  return (
    <ul className="logo-strip-row" aria-hidden={ariaHidden || undefined}>
      {MARKS.map(mark => (
        <li key={mark.name}>
          {/* Height and width both come off --logo-h, which the stylesheet
              shrinks on a phone: a mark sized in px here would keep its
              width when the row scaled down and leave a hole beside it. */}
          <span
            className="logo-mark"
            role={ariaHidden ? undefined : 'img'}
            aria-label={ariaHidden ? undefined : mark.name}
            style={
              {
                '--ratio': mark.ratio,
                '--trim': mark.scale ?? 1,
                maskImage: `url(/logos/${mark.file})`,
                WebkitMaskImage: `url(/logos/${mark.file})`,
              } as CSSProperties
            }
          />
        </li>
      ))}
    </ul>
  );
}

export function MarketplaceLogos() {
  return (
    <section className="logo-strip" aria-labelledby="logo-strip-label">
      <p className="logo-strip-label" id="logo-strip-label">
        Built for the marketplaces your customers already buy on
      </p>

      <div className="logo-strip-window">
        {/* The sequence runs twice and the track travels exactly one copy's
            width, so the frame where it snaps back is identical to the one
            before it and the loop has no seam. */}
        <div className="logo-strip-track">
          <Row />
          <Row ariaHidden />
        </div>
      </div>
    </section>
  );
}

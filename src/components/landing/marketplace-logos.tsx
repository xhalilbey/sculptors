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
   * Set by eye: equal areas still let a heavy black wordmark (Alibaba)
   * outweigh a thin one (Shopee), so heavy marks shrink a little and light
   * ones grow a little. 1 when omitted.
   */
  readonly optical?: number;
};

/*
 * Every mark gets the same AREA, not the same height (owner's direction,
 * 24 Sep 2026: "make them equal to each other"). At a shared letter height a
 * long wordmark (Farfetch, 8:1) read three times the size of a short one
 * (Zara, 2.4:1). Holding width x height constant is how logo walls make
 * marks of any shape weigh the same: height scales with 1/sqrt(ratio),
 * width with sqrt(ratio). A mark as wide as REFERENCE_RATIO keeps --logo-h.
 */
const REFERENCE_RATIO = 4;
const fitFor = (ratio: number) => Math.sqrt(REFERENCE_RATIO / ratio);

/*
 * Asia and Europe alternate on purpose: grouped, the strip reads as two lists
 * that happen to share a rail rather than one market.
 */
const MARKS: readonly Mark[] = [
  { name: 'Trendyol', file: 'trendyol.svg', ratio: 4.3804, optical: 1.1 },
  { name: 'Zalando', file: 'zalando.svg', ratio: 4.9636, optical: 1.06 },
  // Its bird is white on a red disc in the original; drawn as a silhouette it
  // would vanish into a solid disc, so the SVG cuts it out with an internal
  // mask. The two airlines joined on 24 Sep 2026 (owner's direction).
  { name: 'Turkish Airlines', file: 'turkish-airlines.svg', ratio: 6.372, optical: 1.22 },
  { name: 'Alibaba', file: 'alibaba.svg', ratio: 6.3361, optical: 0.9 },
  { name: 'Zara', file: 'zara.svg', ratio: 2.3774, optical: 0.84 },
  { name: 'Shopee', file: 'shopee.svg', ratio: 3.1279, optical: 1.14 },
  { name: 'Otto', file: 'otto.svg', ratio: 2.963, optical: 0.8 },
  { name: 'Zomato', file: 'zomato.svg', ratio: 4.7303, optical: 0.86 },
  { name: 'Allegro', file: 'allegro.svg', ratio: 3.235 },
  { name: 'Qatar Airways', file: 'qatar-airways.svg', ratio: 2.951, optical: 1.14 },
  { name: 'Lazada', file: 'lazada.svg', ratio: 3.8162, optical: 1.12 },
  { name: 'Tesco', file: 'tesco.svg', ratio: 3.7395, optical: 0.94 },
  { name: 'Rakuten', file: 'rakuten.svg', ratio: 4.9407, optical: 0.9 },
  { name: 'bol.com', file: 'bol.svg', ratio: 4.1935 },
  { name: 'Coupang', file: 'coupang.svg', ratio: 4.4439, optical: 1.06 },
  { name: 'Farfetch', file: 'farfetch.svg', ratio: 8.053, optical: 0.94 },
  { name: 'AliExpress', file: 'aliexpress.svg', ratio: 4.6164, optical: 1.04 },
  { name: 'Glovo', file: 'glovo.svg', ratio: 3.0501, optical: 0.96 },
  { name: 'Tokopedia', file: 'tokopedia.svg', ratio: 4.6432, optical: 1.06 },
  { name: 'IKEA', file: 'ikea.svg', ratio: 2.5, optical: 0.86 },
  { name: 'Grab', file: 'grab.svg', ratio: 2.8169, optical: 0.9 },
  { name: 'Paytm', file: 'paytm.svg', ratio: 3.1303, optical: 0.84 },
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
                '--fit': fitFor(mark.ratio) * (mark.optical ?? 1),
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

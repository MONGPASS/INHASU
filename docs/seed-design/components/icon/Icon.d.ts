import * as React from "react";

/**
 * Seed icon glyph, painted with the current text colour.
 *
 * @startingPoint section="Foundations" subtitle="Seed icon glyph set" viewport="700x220"
 */
export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Glyph name without the `icon_` prefix, e.g. `home_regular`, `heart_fill`. */
  name: string;
  /** Rendered box size in px. Seed glyphs are drawn on a 24pt grid. */
  size?: number;
  /** Paint colour. Defaults to `currentColor`. */
  color?: string;
  /** Directory holding the `icon_*.svg` files. Defaults to `window.__seedIconBase` or `assets/svg`. */
  base?: string;
}

export declare function Icon(props: IconProps): JSX.Element;

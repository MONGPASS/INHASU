import React from "react";

/* Seed icon glyphs are single-path 24×24 SVGs painted with currentColor.
   Here they are applied as a CSS mask so the glyph inherits the text colour
   of whatever component holds it, matching @seed-design/icon's behaviour. */

export function Icon({ name, size = 24, color = "currentColor", base, style, ...rest }) {
  const root = base ?? (typeof window !== "undefined" && window.__seedIconBase) ?? "assets/svg";
  const url = `url("${root}/icon_${name}.svg")`;
  return (
    <span
      aria-hidden="true"
      data-seed-icon={name}
      style={{
        display: "inline-block",
        flex: "none",
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        ...style,
      }}
      {...rest}
    />
  );
}

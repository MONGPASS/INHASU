import React from "react";

/* docs/content/component/avatar/style.mdx */
export const avatarSizes = { xxsmall: 20, xsmall: 24, small: 36, medium: 48, large: 64, xlarge: 80, xxlarge: 96 };
const avatarBadgeSizes = { xxsmall: 10, xsmall: 12, small: 20, medium: 24, large: 24, xlarge: 24, xxlarge: 32 };

export function Avatar({ size = "medium", src, alt = "", fallback, badge, style, ...rest }) {
  const box = avatarSizes[size] ?? avatarSizes.medium;
  const badgeBox = avatarBadgeSizes[size] ?? avatarBadgeSizes.medium;
  return (
    <span style={{ position: "relative", display: "inline-flex", width: box, height: box, flex: "none", ...style }} {...rest}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: box,
          height: box,
          borderRadius: "100%",
          overflow: "hidden",
          background: "var(--seed-scale-color-gray-100)",
          boxShadow: "inset 0 0 0 1px var(--seed-scale-color-gray-alpha-50)",
          color: "var(--seed-scale-color-gray-600)",
          fontSize: Math.round(box * 0.4),
        }}
      >
        {src ? <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : fallback}
      </span>
      {badge ? (
        <span
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: badgeBox,
            height: badgeBox,
            borderRadius: "100%",
            background: "var(--seed-scale-color-gray-00)",
          }}
        >
          {badge}
        </span>
      ) : null}
    </span>
  );
}

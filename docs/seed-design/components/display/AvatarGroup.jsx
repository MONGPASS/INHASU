import React from "react";
import { Avatar, avatarSizes } from "./Avatar.jsx";

/* docs/content/component/avatar-group/style.mdx — negative gap by size. */
const avatarGroupGaps = { xxsmall: -5, xsmall: -6, small: -8, medium: -10 };
const excessFontSizes = { xxsmall: 10, xsmall: 11, small: 11, medium: 14 };

export function AvatarGroup({ size = "medium", limit = 3, topItem = "firstItem", items = [], style, ...rest }) {
  const shown = items.slice(0, limit);
  const excess = items.length - shown.length;
  const box = avatarSizes[size] ?? avatarSizes.medium;
  const gap = avatarGroupGaps[size] ?? -10;
  const entries = [...shown.map((item, i) => ({ item, i })), ...(excess > 0 ? [{ excess: true, i: shown.length }] : [])];
  return (
    <span style={{ display: "inline-flex", ...style }} {...rest}>
      {entries.map((entry, idx) => (
        <span
          key={idx}
          style={{
            marginLeft: idx === 0 ? 0 : gap,
            zIndex: topItem === "firstItem" ? entries.length - idx : idx,
            borderRadius: "100%",
            boxShadow: "0 0 0 2px var(--seed-semantic-color-paper-default)",
          }}
        >
          {entry.excess ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: box,
                height: box,
                borderRadius: "100%",
                background: "var(--seed-semantic-color-paper-background)",
                boxShadow: "inset 0 0 0 1px var(--seed-scale-color-gray-400)",
                color: "var(--seed-scale-color-gray-600)",
                fontSize: excessFontSizes[size] ?? 14,
              }}
            >
              {`+${excess}`}
            </span>
          ) : (
            <Avatar size={size} src={entry.item.src} alt={entry.item.alt} fallback={entry.item.fallback} />
          )}
        </span>
      ))}
    </span>
  );
}

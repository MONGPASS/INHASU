import React from "react";
import { FloatingActionButton } from "./FloatingActionButton.jsx";

/* A FAB that expands into a vertical stack of labelled actions over a dim overlay.
   docs/content/component/menu-floating-action-button — geometry follows the plain
   FAB (48px root) and the small extended FAB (35px item pills). */
export function MenuFloatingActionButton({ items = [], icon, closeIcon, open: openProp, onOpenChange, style, ...rest }) {
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = (next) => { setOpenState(next); onOpenChange?.(next); };
  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 12, ...style }} {...rest}>
      {open ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { item.onClick?.(); setOpen(false); }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 35,
                padding: "0 16px",
                border: "none",
                borderRadius: "var(--seed-radius-full)",
                background: "var(--seed-semantic-color-paper-floating)",
                color: "var(--seed-scale-color-gray-900)",
                fontFamily: "inherit",
                fontSize: 14,
                boxShadow: "0 1px 3px 0 rgba(0,0,0,0.28)",
                cursor: "pointer",
              }}
            >
              {item.icon ? <span style={{ display: "inline-flex", width: 16, height: 16 }}>{item.icon}</span> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      <FloatingActionButton size="medium" icon={open ? closeIcon ?? icon : icon} onClick={() => setOpen(!open)} />
    </div>
  );
}

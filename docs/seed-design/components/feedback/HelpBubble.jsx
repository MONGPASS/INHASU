import React from "react";

/* docs/content/component/help-bubble/style.mdx */
export function HelpBubble({ open = true, modal = false, placement = "bottom", message, showCloseTrigger = false, closeIcon, onClose, children, style, ...rest }) {
  const bg = modal ? "var(--seed-static-color-static-white)" : "var(--seed-scale-color-gray-900)";
  const fg = modal ? "var(--seed-static-color-static-black)" : "var(--seed-scale-color-gray-00)";
  const above = placement === "top";
  return (
    <span style={{ position: "relative", display: "inline-flex", ...style }} {...rest}>
      {children}
      {open ? (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            top: above ? "auto" : "calc(100% + 8px)",
            bottom: above ? "calc(100% + 8px)" : "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 6,
            background: bg,
            color: fg,
            fontSize: 13,
            fontWeight: "bold",
            lineHeight: "150%",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              marginLeft: -5,
              top: above ? "auto" : -4,
              bottom: above ? -4 : "auto",
              width: 10,
              height: 10,
              background: bg,
              transform: "rotate(45deg)",
            }}
          />
          <span style={{ position: "relative" }}>{message}</span>
          {showCloseTrigger ? (
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              style={{ position: "relative", display: "inline-flex", width: 18, height: 18, padding: 0, border: "none", background: "none", color: "inherit", cursor: "pointer" }}
            >
              {closeIcon}
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

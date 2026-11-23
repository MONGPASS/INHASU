import React from "react";
import { InlineAlert } from "./InlineAlert.jsx";

/* An InlineAlert the reader can close. */
export function DismissableInlineAlert({ closeIcon, onDismiss, children, style, ...rest }) {
  const [open, setOpen] = React.useState(true);
  if (!open) return null;
  return (
    <InlineAlert style={{ alignItems: "center", ...style }} {...rest}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
        <span style={{ flex: 1 }}>{children}</span>
        <button
          type="button"
          aria-label="닫기"
          onClick={() => { setOpen(false); onDismiss?.(); }}
          style={{ display: "inline-flex", width: 16, height: 16, padding: 0, border: "none", background: "none", color: "inherit", cursor: "pointer", flex: "none" }}
        >
          {closeIcon}
        </button>
      </span>
    </InlineAlert>
  );
}

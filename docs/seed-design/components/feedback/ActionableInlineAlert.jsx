import React from "react";
import { InlineAlert } from "./InlineAlert.jsx";

/* An InlineAlert whose whole row is a button, with a trailing indicator. */
export function ActionableInlineAlert({ actionIndicator, children, onClick, style, ...rest }) {
  return (
    <InlineAlert
      role="button"
      tabIndex={0}
      onClick={onClick}
      style={{ alignItems: "center", cursor: "pointer", ...style }}
      {...rest}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
        <span style={{ flex: 1 }}>{children}</span>
        <span style={{ display: "inline-flex", width: 16, height: 16, flex: "none" }}>{actionIndicator}</span>
      </span>
    </InlineAlert>
  );
}

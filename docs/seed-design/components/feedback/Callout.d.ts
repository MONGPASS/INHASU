import * as React from "react";

/** A tinted block that carries a short, contextual notice inside page content. */
export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "outline" | "normal" | "info" | "warning" | "danger";
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export declare function Callout(props: CalloutProps): JSX.Element;

import * as React from "react";

/** A Callout that is itself a button, with a trailing action indicator. */
export interface ActionableCalloutProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "outline" | "normal" | "info" | "warning" | "danger";
  title?: React.ReactNode;
  /** 18px trailing indicator — usually a right chevron. */
  actionIndicator?: React.ReactNode;
  children?: React.ReactNode;
}

export declare function ActionableCallout(props: ActionableCalloutProps): JSX.Element;

import * as React from "react";

/** A label-only button for secondary and inline actions. */
export interface TextButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "small" | "medium" | "large";
  variant?: "primary" | "secondary" | "secondary-low" | "accent" | "danger";
  /** `underlined` draws a 4pt-offset underline under the label. */
  buttonStyle?: "basic" | "underlined";
  bold?: boolean;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  disabled?: boolean;
  children?: React.ReactNode;
}

export declare function TextButton(props: TextButtonProps): JSX.Element;

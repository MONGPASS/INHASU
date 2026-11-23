import * as React from "react";

/**
 * A single-line input with its label, description, error message and counter.
 *
 * @startingPoint section="Forms" subtitle="Labelled input, outlined and underlined" viewport="700x260"
 */
export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  size?: "small" | "medium" | "large";
  variant?: "outlined" | "underlined";
  label?: React.ReactNode;
  /** Required / optional indicator rendered next to the label, e.g. "필수". */
  indicator?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  invalid?: boolean;
  maxLength?: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export declare function TextField(props: TextFieldProps): JSX.Element;

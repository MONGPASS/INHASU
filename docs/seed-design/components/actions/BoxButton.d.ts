import * as React from "react";

/**
 * The primary filled button: the strongest call to action on a screen.
 *
 * @startingPoint section="Actions" subtitle="Filled button, 6 variants × 5 sizes" viewport="700x200"
 */
export interface BoxButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Height ramp. 32 / 40 / 48 / 56 / 64 px. */
  size?: "xsmall" | "small" | "medium" | "large" | "xlarge";
  /** Emphasis (Milky Way palette). `primary` #36D1A7 fill; `secondary` mint tint; `tertiary` neutral gray. */
  variant?: "primary" | "secondary" | "tertiary" | "danger" | "outlined" | "ghost";
  /** Icon element placed before the label. */
  prefix?: React.ReactNode;
  /** Icon element placed after the label. */
  suffix?: React.ReactNode;
  /** Stretches the button — used for sticky bottom CTAs. */
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

export declare function BoxButton(props: BoxButtonProps): JSX.Element;

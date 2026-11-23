import * as React from "react";

/** A BoxButton that carries an on/off state — "관심 있어요", follow, save. */
export interface BoxToggleButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  size?: "xsmall" | "small" | "medium" | "large";
  variant?: "primary" | "primary-low" | "secondary";
  selected?: boolean;
  defaultSelected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  disabled?: boolean;
  children?: React.ReactNode;
}

export declare function BoxToggleButton(props: BoxToggleButtonProps): JSX.Element;

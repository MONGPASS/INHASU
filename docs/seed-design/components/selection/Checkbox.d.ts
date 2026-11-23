import * as React from "react";

/** A checkbox with its label, in square, circle, or ghost (check-only) shape. */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  size?: "small" | "medium" | "large";
  /** `square` and `circle` draw a filled control; `ghost` shows only the check glyph. */
  shape?: "square" | "circle" | "ghost";
  bold?: boolean;
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export declare function Checkbox(props: CheckboxProps): JSX.Element;

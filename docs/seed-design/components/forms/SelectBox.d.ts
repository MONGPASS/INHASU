import * as React from "react";

export interface SelectBoxItem {
  value: string;
  label: string;
}

/**
 * A single-choice dropdown. Provisional: Seed has not published a visual spec for
 * this family, so the geometry is borrowed from the outlined TextField.
 */
export interface SelectBoxProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange"> {
  size?: "small" | "medium" | "large";
  label?: React.ReactNode;
  placeholder?: string;
  items?: SelectBoxItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}

export declare function SelectBox(props: SelectBoxProps): JSX.Element;

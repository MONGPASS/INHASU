import * as React from "react";

export interface RadioGroupItem {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

/** A single-choice list of radios. */
export interface RadioGroupProps {
  size?: "small" | "medium" | "large";
  items?: RadioGroupItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  orientation?: "vertical" | "horizontal";
  style?: React.CSSProperties;
}

export declare function RadioGroup(props: RadioGroupProps): JSX.Element;

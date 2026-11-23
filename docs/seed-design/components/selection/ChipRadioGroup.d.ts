import * as React from "react";

export interface ChipRadioGroupItem {
  value: string;
  label: React.ReactNode;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  disabled?: boolean;
}

/** A row of chips where exactly one is selected. */
export interface ChipRadioGroupProps {
  size?: "small" | "medium";
  items?: ChipRadioGroupItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  style?: React.CSSProperties;
}

export declare function ChipRadioGroup(props: ChipRadioGroupProps): JSX.Element;

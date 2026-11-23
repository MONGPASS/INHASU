import * as React from "react";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** Carrot dot after the label, marking new content. */
  dot?: boolean;
  disabled?: boolean;
}

/** A tab bar with a sliding gray-900 indicator over a gray-300 track. */
export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `hug` sizes tabs to their labels (16px left padding); `fill` splits the width evenly. */
  layout?: "hug" | "fill";
  items?: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Panel content for the active tab. */
  children?: React.ReactNode;
}

export declare function Tabs(props: TabsProps): JSX.Element;

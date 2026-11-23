import * as React from "react";

export interface MenuFloatingActionButtonItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

/** A FAB that expands into a vertical stack of labelled actions. */
export interface MenuFloatingActionButtonProps {
  items?: MenuFloatingActionButtonItem[];
  /** Icon in the closed state. */
  icon?: React.ReactNode;
  /** Icon swapped in while open — usually a close glyph. */
  closeIcon?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: React.CSSProperties;
}

export declare function MenuFloatingActionButton(props: MenuFloatingActionButtonProps): JSX.Element;

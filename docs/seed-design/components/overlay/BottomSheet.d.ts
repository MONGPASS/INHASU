import * as React from "react";

/** A sheet that slides up from the bottom edge holding arbitrary content. */
export interface BottomSheetProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerAlign?: "start" | "center";
  /** 24px close glyph shown at the top right. */
  closeIcon?: React.ReactNode;
  onClose?: () => void;
  /** Sticky footer area, usually a full-width BoxButton. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export declare function BottomSheet(props: BottomSheetProps): JSX.Element;

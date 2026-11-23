import * as React from "react";

/** A short coach-mark bubble anchored to the element it explains. */
export interface HelpBubbleProps extends React.HTMLAttributes<HTMLSpanElement> {
  open?: boolean;
  /** Modal bubbles are white on a dimmed backdrop; non-modal are gray-900. */
  modal?: boolean;
  placement?: "top" | "bottom";
  message?: React.ReactNode;
  showCloseTrigger?: boolean;
  closeIcon?: React.ReactNode;
  onClose?: () => void;
  /** The anchor element the bubble points at. */
  children?: React.ReactNode;
}

export declare function HelpBubble(props: HelpBubbleProps): JSX.Element;

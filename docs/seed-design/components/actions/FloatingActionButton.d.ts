import * as React from "react";

/** A round, shadowed, icon-only button pinned over scrolling content. */
export interface FloatingActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 40px (small) or 48px (medium). */
  size?: "small" | "medium";
  /** Icon element. Seed sizes it 20px at small, 22px at medium. */
  icon?: React.ReactNode;
}

export declare function FloatingActionButton(props: FloatingActionButtonProps): JSX.Element;

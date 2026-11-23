import * as React from "react";

/** A circular profile image with an optional corner badge. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 20 / 24 / 36 / 48 / 64 / 80 / 96 px. */
  size?: "xxsmall" | "xsmall" | "small" | "medium" | "large" | "xlarge" | "xxlarge";
  src?: string;
  alt?: string;
  /** Shown when there is no image — initials or a placeholder glyph. */
  fallback?: React.ReactNode;
  /** Badge element pinned to the bottom-right on a gray-00 disc. */
  badge?: React.ReactNode;
}

export declare function Avatar(props: AvatarProps): JSX.Element;

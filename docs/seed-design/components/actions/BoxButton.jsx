"use client";

import React from "react";

const sizes = {
  xsmall: { height: 32, padding: 12, fontSize: 12, gap: 4 },
  small: { height: 40, padding: 16, fontSize: 14, gap: 6 },
  medium: { height: 48, padding: 20, fontSize: 16, gap: 8 },
  large: { height: 56, padding: 24, fontSize: 18, gap: 8 },
  xlarge: { height: 64, padding: 28, fontSize: 20, gap: 10 },
};

const variants = {
  primary: {
    background: "#36D1A7",
    color: "#FFFFFF",
    border: "transparent",
  },
  secondary: {
    background: "#ECFDF7",
    color: "#079475",
    border: "transparent",
  },
  tertiary: {
    background: "var(--seed-scale-color-gray-100)",
    color: "var(--seed-scale-color-gray-900)",
    border: "transparent",
  },
  danger: {
    background: "#B72F50",
    color: "#FFFFFF",
    border: "transparent",
  },
  outlined: {
    background: "transparent",
    color: "#079475",
    border: "#36D1A7",
  },
  ghost: {
    background: "transparent",
    color: "#079475",
    border: "transparent",
  },
};

const darkVariants = {
  primary: {
    background: "#36D1A7",
    color: "#032B25",
    border: "transparent",
  },
  secondary: {
    background: "#074D41",
    color: "#D2F9E9",
    border: "transparent",
  },
  tertiary: {
    background: "var(--seed-scale-color-gray-100)",
    color: "var(--seed-scale-color-gray-900)",
    border: "transparent",
  },
  danger: {
    background: "#FFA6B5",
    color: "#351321",
    border: "transparent",
  },
  outlined: {
    background: "transparent",
    color: "#A8F2D7",
    border: "#36D1A7",
  },
  ghost: {
    background: "transparent",
    color: "#A8F2D7",
    border: "transparent",
  },
};

export const BoxButton = React.forwardRef(function BoxButton(
  {
    children,
    size = "medium",
    variant = "primary",
    disabled = false,
    loading = false,
    fullWidth = false,
    prefix,
    suffix,
    type = "button",
    className = "",
    style,
    ...rest
  },
  ref
) {
  const s = sizes[size] ?? sizes.medium;
  const light = variants[variant] ?? variants.primary;
  const dark = darkVariants[variant] ?? darkVariants.primary;
  const unavailable = disabled || loading;

  return (
    <>
      <style>{`
        .milkyway-box-button {
          --mw-button-bg: var(--mw-light-bg);
          --mw-button-text: var(--mw-light-text);
          --mw-button-border: var(--mw-light-border);

          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          vertical-align: middle;

          background: var(--mw-button-bg);
          color: var(--mw-button-text);
          border: 1px solid var(--mw-button-border);
          border-radius: 8px;

          font-family: inherit;
          font-weight: 700;
          line-height: 1;
          text-decoration: none;
          white-space: nowrap;

          appearance: none;
          cursor: pointer;
          touch-action: manipulation;

          transition:
            filter 150ms ease,
            box-shadow 150ms ease,
            transform 100ms ease;
        }

        [data-seed-scale-color="dark"] .milkyway-box-button {
          --mw-button-bg: var(--mw-dark-bg);
          --mw-button-text: var(--mw-dark-text);
          --mw-button-border: var(--mw-dark-border);
        }

        @media (hover: hover) {
          .milkyway-box-button:hover:not(:disabled) {
            filter: brightness(0.94);
          }
        }

        .milkyway-box-button:active:not(:disabled) {
          transform: translateY(1px);
          filter: brightness(0.88);
        }

        .milkyway-box-button:focus-visible {
          outline: 3px solid #075E4E;
          outline-offset: 3px;
        }

        [data-seed-scale-color="dark"]
        .milkyway-box-button:focus-visible {
          outline-color: #70E5C2;
        }

        .milkyway-box-button:disabled {
          background: var(--seed-scale-color-gray-200);
          color: var(--seed-scale-color-gray-500);
          border-color: transparent;
          cursor: not-allowed;
        }

        [data-seed-scale-color="dark"]
        .milkyway-box-button:disabled {
          background: var(--seed-scale-color-gray-200);
          color: var(--seed-scale-color-gray-500);
          border-color: transparent;
        }

        .milkyway-box-button[data-loading="true"]:disabled {
          cursor: progress;
        }

        .milkyway-box-button__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .milkyway-box-button__spinner {
          box-sizing: border-box;
          width: 1em;
          height: 1em;
          flex-shrink: 0;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: milkyway-button-spin 800ms linear infinite;
        }

        @keyframes milkyway-button-spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .milkyway-box-button {
            transition: none;
          }

          .milkyway-box-button__spinner {
            animation: none;
          }
        }
      `}</style>

      <button
        {...rest}
        ref={ref}
        type={type}
        disabled={unavailable}
        aria-busy={loading || undefined}
        data-loading={loading ? "true" : undefined}
        className={`milkyway-box-button ${className}`.trim()}
        style={{
          "--mw-light-bg": light.background,
          "--mw-light-text": light.color,
          "--mw-light-border": light.border,

          "--mw-dark-bg": dark.background,
          "--mw-dark-text": dark.color,
          "--mw-dark-border": dark.border,

          height: s.height,
          padding: `0 ${s.padding}px`,
          fontSize: s.fontSize,
          gap: s.gap,
          width: fullWidth ? "100%" : undefined,
          ...style,
        }}
      >
        {loading ? (
          <span
            className="milkyway-box-button__spinner"
            aria-hidden="true"
          />
        ) : prefix ? (
          <span className="milkyway-box-button__icon">
            {prefix}
          </span>
        ) : null}

        {children}

        {suffix ? (
          <span className="milkyway-box-button__icon">
            {suffix}
          </span>
        ) : null}
      </button>
    </>
  );
});

export default BoxButton;
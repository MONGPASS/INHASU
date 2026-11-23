import React from "react";

/* docs/content/component/tabs/style.mdx */
export function Tabs({ layout = "hug", items = [], value: valueProp, defaultValue, onValueChange, children, style, ...rest }) {
  const [inner, setInner] = React.useState(defaultValue ?? items[0]?.value);
  const value = valueProp ?? inner;
  const activeIndex = Math.max(0, items.findIndex((item) => item.value === value));
  const refs = React.useRef([]);
  const [indicator, setIndicator] = React.useState({ left: 0, width: 0 });

  React.useLayoutEffect(() => {
    const node = refs.current[activeIndex];
    if (node) setIndicator({ left: node.offsetLeft, width: node.offsetWidth });
  }, [activeIndex, items.length, layout]);

  return (
    <div style={style} {...rest}>
      <div role="tablist" style={{ position: "relative", display: "flex", paddingLeft: layout === "hug" ? 16 : 0, borderBottom: "1px solid var(--seed-scale-color-gray-300)" }}>
        {items.map((item, i) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              ref={(node) => { refs.current[i] = node; }}
              role="tab"
              aria-selected={selected}
              disabled={item.disabled}
              onClick={() => { setInner(item.value); onValueChange?.(item.value); }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                flex: layout === "fill" ? 1 : "none",
                minWidth: 54,
                padding: "10px 12px",
                border: "none",
                background: "none",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: "bold",
                color: item.disabled
                  ? "var(--seed-scale-color-gray-300)"
                  : selected
                  ? "var(--seed-scale-color-gray-900)"
                  : "var(--seed-scale-color-gray-600)",
                cursor: item.disabled ? "default" : "pointer",
              }}
            >
              <span>{item.label}</span>
              {item.dot ? <span style={{ width: 4, height: 4, borderRadius: "100%", background: "var(--seed-scale-color-carrot-500)" }} /> : null}
            </button>
          );
        })}
        <span
          style={{
            position: "absolute",
            bottom: -1,
            left: indicator.left,
            width: indicator.width,
            height: 2,
            background: "var(--seed-scale-color-gray-900)",
            transition: "left 200ms var(--seed-timing-function-standard-easing), width 200ms var(--seed-timing-function-standard-easing)",
          }}
        />
      </div>
      {children ? <div>{children}</div> : null}
    </div>
  );
}

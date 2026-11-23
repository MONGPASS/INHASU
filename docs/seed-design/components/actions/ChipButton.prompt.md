Pill-shaped outlined button for filter and shortcut rows that scroll horizontally above a feed.

```jsx
<ChipButton size="medium" count={12} suffixIcon={<Icon name="expand_more_regular" size={14} />}>동네</ChipButton>
```

- Always full-radius, 1px divider-2 outline, transparent fill.
- `count` renders in gray-600 and darkens to gray-700 on hover.
- Not a toggle — use ChipToggleButton or ChipFilter for selectable state.

A row of chips where exactly one is selected — category switchers above a feed.

```jsx
<ChipRadioGroup defaultValue="all" items={[{ value: "all", label: "전체" }, { value: "free", label: "나눔" }]} onValueChange={setTab} />
```

- Chips sit 8px apart and use the same visuals as ChipToggleButton (gray-800 fill when selected).
- Multi-select in the same row is ChipToggleButton, not this.

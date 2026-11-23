Top-level switching inside a screen.

```jsx
<Tabs layout="fill" items={[{ value: "sell", label: "판매중" }, { value: "sold", label: "거래완료", dot: true }]} onValueChange={setTab}>
  {panel}
</Tabs>
```

- Selected label gray-900, unselected gray-600, both label3-bold; the 2px indicator is gray-900 over a gray-300 track.
- `hug` for a scrolling row of many tabs (16px left padding), `fill` for 2–4 tabs across the width.
- The dot is 4px carrot-500, 2px after the label.

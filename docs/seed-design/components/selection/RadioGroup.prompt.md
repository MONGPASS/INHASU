Single-choice list — sort order, report reasons, delivery options.

```jsx
<RadioGroup
  size="medium"
  defaultValue="recent"
  items={[{ value: "recent", label: "최신순" }, { value: "near", label: "가까운 순" }]}
  onValueChange={setSort}
/>
```

- Selected control fills carrot with a white dot that scales in from 0 over 100ms.
- Control sizes: 18 / 20 / 24 px; label sits 8px to its right.

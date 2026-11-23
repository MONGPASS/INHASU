A dropdown for one choice out of many, sized to sit beside a TextField in the same form.

```jsx
<SelectBox label="카테고리" items={[{ value: "digital", label: "디지털기기" }]} onValueChange={setCategory} />
```

**Provisional.** Seed lists `select-box` as a component family but publishes no style spec for it, so this uses TextField's outlined geometry (6px radius, gray-400 border, 42/52/54px heights). Replace with the real spec when it ships.

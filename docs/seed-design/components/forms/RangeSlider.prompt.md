Two-handle slider for a min/max range — price filters, age ranges.

```jsx
<RangeSlider label="가격" output="1만 ~ 5만원" min={0} max={100} defaultValue={[10, 50]} />
```

- Same track/handle geometry as Slider; only the filled segment between the handles is carrot.
- Put the readable range in `output`; do not label the handles individually.

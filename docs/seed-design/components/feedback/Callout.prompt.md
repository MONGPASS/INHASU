A tinted notice block that sits inside content — safety tips, policy notes, status explanations.

```jsx
<Callout variant="info" icon={<Icon name="info_fill" size={16} />} title="안전 거래 안내">
  직거래 시에는 공공장소에서 만나세요.
</Callout>
```

- Variants map to alpha-50 tints with a deep 950 text of the same hue: info (blue), warning (yellow), danger (red), plus `normal` (gray-100) and `outline`.
- 10px radius, 14/16 padding, 16px icon 8px from the text.
- For a callout with a trailing action or a dismiss button, use ActionableCallout / DismissableCallout.

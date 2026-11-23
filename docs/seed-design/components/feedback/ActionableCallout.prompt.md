A Callout that navigates somewhere — the whole block is the tap target.

```jsx
<ActionableCallout variant="info" title="본인인증이 필요해요" actionIndicator={<Icon name="chevron_right_regular" size={18} />}>
  인증하고 더 안전하게 거래하세요.
</ActionableCallout>
```

- Right padding drops to 12px to make room for the 18px indicator, 10px from the text.
- Pressed deepens the tint one step (alpha-50 → alpha-100).

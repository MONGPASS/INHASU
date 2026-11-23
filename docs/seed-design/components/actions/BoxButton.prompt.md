The main filled button — one per screen region, for the action you want people to take.

```jsx
<BoxButton size="large" variant="primary" layout="fullWidth">채팅하기</BoxButton>
<BoxButton size="medium" variant="secondary" prefixIcon={<Icon name="share_regular" size={16} />}>공유</BoxButton>
```

- Variants: `primary` (carrot fill), `primary-low` (carrot tint on white), `secondary` (gray-100 fill), `danger`.
- Sizes map to fixed heights: xsmall 32, small 36, medium 40, large 48, xlarge 52.
- Presses scale to 0.95 over 100ms — that squish is a Seed signature, keep it.
- Disabled always renders gray-300 on gray-500 regardless of variant.

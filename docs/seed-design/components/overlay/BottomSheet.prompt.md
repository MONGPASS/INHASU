A sheet from the bottom edge holding real content — pickers, forms, details.

```jsx
<BottomSheet title="가격 제안하기" closeIcon={<Icon name="close_regular" size={24} />} footer={<BoxButton size="large" layout="fullWidth">제안 보내기</BoxButton>}>
  <TextField placeholder="₩ 제안할 금액" />
</BottomSheet>
```

- Max height 375px, 20px top radius, paper-default fill on overlay-dim.
- Header and content sit 16px apart; the header can be start- or center-aligned.
- Use ActionSheet instead when the content is just a list of actions.

A label-only button — list row actions, "전체보기", inline links inside content.

```jsx
<TextButton variant="secondary-low" size="small" suffixIcon={<Icon name="chevron_right_regular" size={14} />}>전체보기</TextButton>
<TextButton variant="danger" bold>삭제</TextButton>
```

- Variants: primary, secondary (gray-900), secondary-low (gray-600), accent (blue), danger.
- `buttonStyle="underlined"` for links inside running text.
- No background, no press-scale — colour shift only.

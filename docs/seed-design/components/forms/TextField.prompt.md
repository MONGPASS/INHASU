Single-line input with everything around it: label, indicator, prefix/suffix, description, error, counter.

```jsx
<TextField label="가격" placeholder="₩ 가격을 입력해주세요" suffix="원" description="나눔은 0원으로 입력하세요" />
<TextField label="닉네임" invalid errorMessage="이미 사용 중인 닉네임이에요" maxLength={20} />
```

- `outlined` (6px radius, gray-400 border) is the default; `underlined` is the borderless variant for dense forms.
- Focus darkens the border to gray-900 — there is no coloured focus fill.
- Invalid swaps the fill to danger-low and the border to danger; the error message replaces the description.
- Min width is 280px in every size.

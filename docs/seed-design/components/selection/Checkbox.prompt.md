Checkbox plus label. Use for multi-select lists and consent rows.

```jsx
<Checkbox size="medium" defaultChecked>전체 동의</Checkbox>
<Checkbox shape="ghost" size="small">알림 받기</Checkbox>
```

- `square` (4px radius) is the default; `circle` for agreement lists; `ghost` when the row itself carries the affordance.
- Selected control is carrot with a white check; disabled is gray-300 with a gray-500 check.
- Long labels wrap aligned to the label's start, not under the control.

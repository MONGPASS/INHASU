A blocking confirm/warn modal. Render it inside a `position: relative` container (a phone frame, say) — it fills its nearest positioned ancestor.

```jsx
<AlertDialog
  title="채팅방을 나갈까요?"
  description="나가면 대화 내용이 모두 삭제돼요."
  primaryLabel="나가기"
  secondaryLabel="취소"
  secondaryActionIntent="neutral"
/>
```

- 272px max width, 16px radius, paper-dialog fill on an overlay-dim backdrop.
- Title is title3-bold, description subtitle1-regular, both gray-900.
- Intent picks the secondary's treatment and the layout direction: `nonpreferred` stacks it under the primary as a bare gray-700 label.

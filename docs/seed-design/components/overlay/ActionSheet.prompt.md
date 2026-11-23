A list of one-tap actions rising from the bottom edge — the "더보기" menu.

```jsx
<ActionSheet
  title="게시글"
  actions={[{ label: "수정하기" }, { label: "삭제하기", variant: "destructive" }]}
  onClose={close}
/>
```

- paper-sheet fill, 20px top radius, 14px vertical padding; a 0.5px divider-2 line separates the header from the actions.
- Action labels are label2-regular, gray-900; `destructive` turns them danger red.
- Render inside a `position: relative` container.

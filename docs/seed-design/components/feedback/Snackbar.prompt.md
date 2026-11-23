A short-lived dark bar that confirms an action, pinned near the bottom of the screen.

```jsx
<Snackbar type="success" icon={<Icon name="check_fill" size={20} />} message="관심 목록에 저장했어요" actionLabel="보기" onAction={goToList} />
```

- The bar is always gray-900 with gray-00 text; only the icon carries the type colour (green for success, red-600 for warning).
- The action label is carrot and bold.
- Enters with a spring: scale 0.7 → 1 over 300ms, opacity over 100ms.

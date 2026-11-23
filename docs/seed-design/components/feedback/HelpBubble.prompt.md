Coach mark: a short bubble with an arrow, pointing at the thing it explains.

```jsx
<HelpBubble message="여기서 동네를 바꿀 수 있어요" placement="bottom">
  <BoxButton size="small" variant="secondary">서초동</BoxButton>
</HelpBubble>
```

- Non-modal: gray-900 bubble, gray-00 caption1-bold text. Modal: white bubble over a gray-alpha-500 backdrop.
- 6px radius, 12/8 padding, 18px close trigger when `showCloseTrigger`.
- One sentence only — anything longer belongs in a Callout or BottomSheet.

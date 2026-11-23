A FAB that opens a short vertical menu of actions above itself.

```jsx
<MenuFloatingActionButton
  icon={<Icon name="add_regular" size={22} />}
  closeIcon={<Icon name="close_regular" size={22} />}
  items={[{ label: "중고거래", icon: <Icon name="coupon_regular" size={16} /> }, { label: "동네생활" }]}
/>
```

- Keep the menu to a handful of items; it is a shortcut launcher, not navigation.
- Item pills reuse the small extended-FAB geometry (35px tall, full radius, floating shadow).

Circular profile image.

```jsx
<Avatar size="small" src={user.photo} fallback="당" />
<Avatar size="medium" src={user.photo} badge={<Icon name="check_fill" size={14} />} />
```

- Sizes are fixed: 20, 24, 36, 48, 64, 80, 96. Always a full circle with a hairline gray-alpha-50 outline.
- The badge sits on a gray-00 disc at the bottom-right; its size follows the avatar size.

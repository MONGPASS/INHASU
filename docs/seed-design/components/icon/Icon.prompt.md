Renders one glyph from the Seed icon set, masked so it takes the surrounding text colour.

```jsx
<Icon name="home_regular" size={24} />
<Icon name="heart_fill" size={16} color="var(--seed-semantic-color-primary)" />
```

- `name` is the file stem minus `icon_`: `home_regular`, `chatting_fill`, `chevron_right_regular`.
- Weights are `_regular` (default UI weight), `_fill` (selected/active), `_thin`.
- Set `window.__seedIconBase` once per page (e.g. `"../../assets/svg"`) so nested pages resolve the glyphs.
- Seed sizes icons in even steps: 12, 14, 16, 18, 20, 24.

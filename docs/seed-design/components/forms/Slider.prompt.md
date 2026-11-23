Single-value slider — distance, radius, price ceiling.

```jsx
<Slider label="거리" output="3km" min={0} max={10} defaultValue={3} onValueChange={setDistance} />
```

- Track gray-200 6px; filled range carrot; handle 28px white with a 0 4px 6px rgba(0,0,0,.15) shadow.
- While dragging or focused the handle shadow becomes a 5px spread ring at 22% black.
- Minimum width 240px.

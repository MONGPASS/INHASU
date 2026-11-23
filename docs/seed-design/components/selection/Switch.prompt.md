On/off control that applies immediately — settings rows, notification toggles.

```jsx
<Switch defaultChecked onCheckedChange={setAlarm} />
```

- Single fixed size (52×42 hit area, 52×30 track, 26px handle). Do not scale it.
- Off is gray-500, on is carrot. Disabled drops the whole control to 38% opacity.
- Switch carries no label of its own — put the label in the surrounding list row.

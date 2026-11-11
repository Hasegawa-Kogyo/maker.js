# Optional dimension caption leaders and shared joints

Linear, aligned, horizontal and vertical dimensions accept `textLeader` and
`endpointMarkers`. These options are opt-in; ordinary dimensions retain their
existing rendering and DXF behavior.

All lengths below use model units. A consuming application can scale the options
with its annotation scale before constructing the dimension.

| Text leader option | Meaning | Default |
| --- | --- | --- |
| `diagonalRun` | Distance perpendicular to the dimension axis | `textHeight * 0.8` |
| `diagonalRise` | Distance along the dimension axis before the elbow | `textHeight * 35 / 75` |
| `landingLength` | Length of the straight landing beside the caption | `textHeight * 1.6` |
| `textGap` | Caption clearance from the landing | `textHeight * 0.16` |
| `arrowTailLength` | Supporting line beyond outside arrows | Arrow size, also the minimum |
| `side` | Which side of the dimension axis receives the leader | `'positive'` (left of axis) |
| `attachment` | Measured endpoint where the leader starts | `'end'` |
| `alongDirection` | Landing/rise direction along the dimension axis | `1`; use `-1` to reverse |

`diagonalRun` and `landingLength` must be positive. The other lengths must be
finite and nonnegative. Leader placement determines the caption position and
rotation; it does not change the measured points or dimension value.

## One marker where two dimensions meet

Each endpoint marker can be `'arrow'`, `'joint'` or `'none'`. Omitted endpoints
keep their arrow. A joint is a hexagon with an inner circle. `jointRadius`
controls its outer radius and defaults to half the arrow size.

Let one dimension own the joint and suppress the neighboring arrow. This avoids
duplicating marker geometry. Dimensions are joined explicitly, not detected
automatically.

```js
const drawing = { models: {} };
const common = {
  layer: 'DIMENSION', textHeight: 25, arrowSize: 10,
  arrowPlacement: 'outside', extensionLineOffset: 0
};

makerjs.dimension.addVertical(drawing, [0, 0], [0, 72], 150, {
  ...common, key: 'clearance', text: '72', textPosition: [-165, 36],
  endpointMarkers: { end: 'joint', jointRadius: 6 }
});
makerjs.dimension.addVertical(drawing, [0, 72], [0, 112], 150, {
  ...common, key: 'rod_height', text: '40',
  endpointMarkers: { start: 'none' },
  textLeader: {
    diagonalRun: 30, diagonalRise: 20, landingLength: 60,
    textGap: 6, arrowTailLength: 12
  }
});
```

Marker paths use `<dimension layer>_JOINT`, allowing SVG consumers to set
`fill: none` independently of dimension text. Native DXF exports retain
DIMENSION entities, their measured endpoints and saved leader/marker graphics.
Explicit-style export resolves geometry after scale, rotation and placement
without changing the source model. Consuming SVG code should preserve the
explicit caption anchor rather than applying ordinary automatic text placement.

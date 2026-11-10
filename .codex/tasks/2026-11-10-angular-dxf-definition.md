# Native angular DXF definition and arrow verification

## Objective
Fix oversized CAD angle arcs traced from supplied K02 DXF; verify smooth circular arc and correctly connected arrowheads. Work authorized by user in in-house Maker.js checkout.

## Baseline and scope
- Repository C:/Users/2044/Desktop/hase_gawa_link/maker.js, HEAD ebb38b6; initial working tree clean.
- No AGENTS.md or master context exists in this checkout. Prior investigation: ../link/.codex/tasks/2026-11-09-k02-drawing-bug-review.md.
- Angular model stores a center, two ray endpoints, radius and counterclockwise sweep. Exporter previously emitted type34/two-line subclass with three-point coordinate layout.

## Implementation
- packages/maker.js/src/core/dxf.ts: emit type37 (three-point5 plus anonymous-block32) and AcDb3PointAngularDimension. Retain ray endpoints13/14, vertex15, arc point10 and text point11. Position native arc point at sweep midpoint to choose the intended sector, including zero wrap and reflex sweeps.
- Dimension.ts unchanged: its circular arc and open V arrows are already correct. Arrows share exact arc-end tips and their tails follow the inward tangents; no replacement of arc with segmented lines or styling changes.
- packages/maker.js/test/angular-dimension.js: six cases for60/44/31 degrees, reverse quadrant, zero wrap and240-degree reflex. Verify points/offsets, radius/sweep, vertex, type/subclass, explicit text, arrow tips/tangents/sizes, DXF saved arc and source immutability.
- packages/maker.js/.gitignore: unignore only the new regression test because existing test/* pattern hides new test files.
- Compiled dist locally. Restored only generated docs/target/js/browser.maker.js from this build because it also bundled unrelated source/browser drift. No pre-existing user changes were overwritten.

## Verification
- npm run build --workspace=makerjs --ignore-scripts: passed (TypeScript target compilation and package build).
- Focused angular regression:6 passing. Existing DXF tests:6 passing/1 failing; full suite from package cwd:133 passing/1 failing.
- Sole failure is existing DXF exact snapshot omitting expanded CENTER/PHANTOM/etc line-type tables. Reconstructed pre-fix exporter in memory and reproduced same snapshot failure. Non-angular square DXF output byte-identical before/after this fix. Did not alter unrelated snapshot.
- Initial full-suite attempt from repo cwd produced missing-font errors due relative test paths; reran from package cwd, eliminating those errors.
- Generated tmp/angular-dimension-fixed.dxf/.svg/.png and inspected rendered PNG: smooth circular curves, both attached open arrows. First PNG had transparent background; flattened SVG render to white for inspection.
- git diff --check passed, staged diff empty. No commit/push or application dependency update. Actual CAD regeneration remains unverified.

## Next integration
Commit/release the reviewed Maker.js change when requested, update ladder app pinned Maker.js commit, regenerate a real K02 export and verify CAD regeneration. Existing downloaded DXFs are not modified automatically.

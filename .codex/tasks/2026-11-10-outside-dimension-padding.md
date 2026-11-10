# Compact outside-arrow dimension-line padding

## Objective and authorization
User asks to implement shortening of long outward-arrow dimension tails in in-house Maker.js. Work in C:/Users/2044/Desktop/hase_gawa_link/maker.js; initial clean tree at967f0cf. Prior angle fix committed by user; preserve it. No AGENTS.md/master context in this checkout. Add configurable padding and reduce outside-text default from2x text height to0.5x; measured points, witnesses, arrow tips and text placement stay unchanged.

## Baseline
Captured24 horizontal/vertical/rotated, before/center/after text and inside/outside fixtures in tmp/outside-padding-baseline.json before modifying source. Build/test scripts inspected. No app dependency updates authorized as part of this library-only change.

## Implementation
- packages/maker.js/src/core/dimension.ts: documented outsideTextPadding numeric option in model units; finite/nonnegative, applies to linear/aligned outside-arrow dimensions. Legacy padding can be requested as textHeight *2.
- packages/maker.js/src/models/Dimension.ts: replace fixed2x text-height shelf padding with configurable value, default0.5x text height. Validate invalid supplied values with RangeError. Existing max/min bounds keep at least arrowSize line support and clear the estimated text extent. Text/caption placement, arrowheads, witnesses and physical metadata are unchanged.
- New test/outside-dimension-padding.js plus narrow unignore exception. Includes12 rotation/text-placement combinations, zero/explicit default, unchanged inside arrows, dimension helper/aligned constructor and invalid values.
- Build updates docs/target/js/browser.maker.js with only corresponding compiled logic (9-line diff); package dist is generated/ignored as before. Preserve existing UTF16LE source encoding from HEAD; this makes Git report source files as binary, so inspected decoded before/after diffs separately. No unrelated source changes.

## Verification
- npm run build --workspace=makerjs --ignore-scripts passed.
- Focused padding plus prior angular checks:22 passing. Full suite from packages/maker.js cwd:149 passing,1 pre-existing exact DXF snapshot failure for expanded line-type tables. Did not alter unrelated test.
- All24 pre-change fixtures reproduced byte-for-byte SVG/DXF and equivalent model JSON with explicit legacy padding; inside-arrow outputs identical without any override. Covers0/90/37/217-degree rotation, text before/inside/after span, inside/outside arrows.
- Generated tmp/outside-dimension-padding-comparison.svg/.dxf/.png; visually inspected previous padding on left vs compact default on right. Same50 text and arrow tips; compact tail ends sooner. Actual iCAD SX native regeneration not tested and may apply importer/dimension-style fitting independently of saved graphics.
- Initial apply_patch refused UTF16 source; switched to encoding-preserving Python edits. First test creation used root-relative paths from package cwd, so it created nothing; corrected with absolute patch paths. Initial gitignore write doubled carriage returns; restored original byte content plus one exception, final diff/check clean.
- Final source/schema/browser/test/new artifacts, Git status/history, staged diff(empty) and whitespace reviewed. git diff --check passed with line-ending conversion warnings only. No commit/push or app dependency modification.

## Integration
User must commit/release this Maker.js checkout and update/reinstall the app's pinned dependency before new K02 exports receive compact default padding. Existing downloaded DXFs are unchanged. Public option can be overridden per drawing without changing physical witnesses or text position.

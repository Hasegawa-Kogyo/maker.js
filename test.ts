const makerjs = require("./packages/maker.js/dist/index.js");
const fs = require("fs");

const lineDashed = new makerjs.paths.Line([0, 0], [100, 0]);
lineDashed.layer = "DASH";

const lineSolid = new makerjs.paths.Line([0, 10], [100, 10]);
lineSolid.layer = "0";

const circleDotted = new makerjs.paths.Circle([50, 20], 20);
circleDotted.layer = "1";

const rect = new makerjs.models.Rectangle(50, 30);
rect.origin = [120, 0];

// const jpFont = new makerjs.exporter.FontFile("NotoSansJP-VariableFont_wght.ttf", "JP");
// makerjs.exporter.registerFont(jpFont);

// const JapaneseText = new makerjs.models.Text("日本語テスト- 한국어 키보드 JP", 10, "JP");
// JapaneseText.layer = "TEXT";

const model = { paths: { lineDashed, lineSolid, circleDotted }, models: { rect } };

if (makerjs.dimension && typeof makerjs.dimension.addHorizontal === "function") {
  makerjs.dimension.addHorizontal(model, [120, 30], [170, 30], 10, {
    layer: "DIM",
    textHeight: 2,
    key: "rectWidth",
  });

  makerjs.dimension.addVertical(model, [170, 0], [170, 30], -10, {
    layer: "DIM",
    textHeight: 2,
    key: "rectHeight",
  });

  makerjs.dimension.addAngular(model, [120, 0], [170, 0], [120, 30], 10, {
    layer: "DIM",
    textHeight: 2,
    key: "rectAngle",
  });

  makerjs.dimension.addRadial(model, [50, 20], [70, 20], {
    layer: "DIM",
    textHeight: 2,
    key: "circleRadius",
  });

  makerjs.dimension.addDiameter(model, [50, 20], [70, 20], {
    layer: "DIM",
    textHeight: 2,
    key: "circleDiameter",
  });

  makerjs.dimension.addLinear(model, [0, 0], [100, 0], -5, {
    layer: "DIM",
    textHeight: 2,
    key: "dashLength",
  });

  makerjs.dimension.labels(model, "Dimension Demo - All Types", [0, 0], [168, 44], {
    layer: "DIM",
    textHeight: 24,
    shelfLength: 55,
    textPosition: [195, 38],
    textRotation: 0,
    key: "mainLabel",
  });
} else {
  console.log("Dimension API not available in current dist build; skipping dimension tests.");
}

const dxf = makerjs.exporter.toDXF(model, {
  units: makerjs.unitType.Millimeter,
  layerOptions: {
    DASH: { color: 1, lineType: "DASHED" },
    "0": { color: 7, lineType: "CONTINUOUS" },
    "1": { color: 1, lineType: "DOTTED" },
    DIM: { color: 2, lineType: "CONTINUOUS", fontSize: 24 },
    TEXT: { color: 3, lineType: "CONTINUOUS", fontSize: 5 },
  },

  // ✅ force TEXT entities
  texts: [
    { text: "日本語テスト- 한국어 키보드 JP", x: 0, y: 40, layer: "TEXT", rotation: 0, height: 4, styleName: "JP" },
  ],

  // jpFontFile: "NotoSansJP-VariableFont_wght.ttf",
  // codePage: "ANSI_932",
  // textStyleName: "JP",
});

fs.writeFileSync("out.dxf", dxf, "utf8");
console.log("Wrote out.dxf");
console.log("Dimension test cases: horizontal, vertical, angular, radial, diameter, linear, labels");
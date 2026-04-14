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
  makerjs.dimension.addHorizontal(model, [0, 0], [100, 0], -10, {
    layer: "DIMENSION",
    textHeight: 4,
    key: "dashLength",
  });

  makerjs.dimension.addRadial(model, [50, 20], [70, 20], {
    layer: "DIMENSION",
    textHeight: 4,
    key: "circleRadius",
  });

  makerjs.dimension.addDiameter(model, [50, 20], [70, 20], {
    layer: "DIMENSION",
    textHeight: 4,
    key: "circleDiameter",
  });

  makerjs.dimension.addHorizontal(model, [120, 30], [170, 30], 10, {
    layer: "DIMENSION",
    textHeight: 4,
    key: "rectWidth",
  });

  makerjs.dimension.addVertical(model, [170, 0], [170, 30], 10, {
    layer: "DIMENSION",
    textHeight: 4,
    key: "rectHeight",
  });

  makerjs.dimension.labels(model, "50 x 30 RECT", [170, 30], [190, 45], {
    layer: "DIMENSION",
    textHeight: 4,
    shelfLength: 20,
    key: "rectLabel",
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
    DIMENSION: { color: 7, lineType: "CONTINUOUS", fontSize: 4 },
    TEXT: { color: 3, lineType: "CONTINUOUS", fontSize: 5 },
  },

  // force TEXT entities
  texts: [
    { text: "日本語テスト- 한국어 키보드 JP", x: 0, y: 40, layer: "TEXT", rotation: 0, height: 4, styleName: "JP" },
  ],

  // jpFontFile: "NotoSansJP-VariableFont_wght.ttf",
  // codePage: "ANSI_932",
  // textStyleName: "JP",
});

fs.writeFileSync("out.dxf", dxf, "utf8");
console.log("Wrote out.dxf");
console.log("Dimension test cases: horizontal, radial, diameter, rectangle width, rectangle height, label");

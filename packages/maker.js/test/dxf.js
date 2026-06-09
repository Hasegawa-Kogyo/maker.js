var assert = require('assert');
var makerjs = require('../dist/index.js');

describe('Export DXF', function() {
    const exportOptions = {
        fontSize: 4,
        layerOptions: {
            big_square: {
                color: 0,
                fontSize: 8,
            },
        },
    };
    var model = {};
    model.units = makerjs.unitType.Inch;
    makerjs
        .$(new makerjs.models.Square(50))
        .layer('square')
        .addCaption('fold here', [0, 0], [50, 50])
        .addTo(model, 'square');

    const expected = [
        '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '1', '0', 'ENDSEC',
        '0', 'SECTION',
            '2', 'TABLES',
                '0', 'TABLE', '2', 'LTYPE', '0', 'LTYPE', '72', '65', '70', '0', '2', 'CONTINUOUS', '3', '______', '73', '0', '40', '0', '0', 'LTYPE', '72', '65', '70', '0', '2', 'DASHED', '3', '_ _ _ ', '73', '2', '40', '7.5', '49', '5', '49', '-2.5', '0', 'LTYPE', '72', '65', '70', '0', '2', 'DOTTED', '3', '. . . ', '73', '2', '40', '1.5', '49', '0.5', '49', '-1', '0', 'ENDTAB',
                '0', 'TABLE', '2', 'LAYER', '0', 'ENDTAB',
                '0', 'TABLE', '2', 'STYLE', '0', 'STYLE', '2', 'STANDARD', '70', '0', '40', '0', '41', '1', '50', '0', '71', '0', '42', '0', '3', 'txt.shx', '4', '', '0', 'STYLE', '2', 'JP', '70', '0', '40', '0', '41', '1', '50', '0', '71', '0', '42', '0', '3', 'YuGothic.ttf', '4', '', '0', 'ENDTAB',
        '0', 'ENDSEC',
        '0', 'SECTION',
            '2', 'ENTITIES',
                '0', 'LINE', '8', 'square', '6', 'CONTINUOUS', '10',  '0', '20',  '0', '11', '50', '21', '0',
                '0', 'LINE', '8', 'square', '6', 'CONTINUOUS', '10', '50', '20',  '0', '11', '50', '21', '50',
                '0', 'LINE', '8', 'square', '6', 'CONTINUOUS', '10', '50', '20', '50', '11',  '0', '21', '50',
                '0', 'LINE', '8', 'square', '6', 'CONTINUOUS', '10',  '0', '20', '50', '11',  '0', '21', '0',
                '0', 'TEXT', '10', '25', '20', '25', '11', '25', '21', '25', '40', '4', '1', 'fold here', '50', '45', '8', 'square', '7', 'JP', '72', '4', '73', '0',
        '0', 'ENDSEC',
        '0', 'EOF'
    ].join('\n');

    it('should export valid DXF', function() {
        var dxf = makerjs.exporter.toDXF(model, exportOptions);
        assert.equal(dxf, expected);
    });

    it('should allow override of layer using anchor', function() {
        model.models.square.caption.anchor.layer = "override_layer";
        var dxf = makerjs.exporter.toDXF(model, exportOptions);
        assert.ok(dxf.includes("override_layer"));
    });

    it('should allow changing fontSize using layerOptions', function() {
        model.models.square.caption.anchor.layer = "little_square";
        makerjs
            .$(new makerjs.models.Square(100))
            .layer('big_square')
            .addCaption('big fold here', [0, 0], [100, 100])
            .addTo(model, 'big_square');
        var dxf = makerjs.exporter.toDXF(model, exportOptions);
        assert.ok(dxf.includes(['0', 'LAYER', '2', 'big_square', '70', '0', '62', '0', '6', 'CONTINUOUS'].join('\n')));
        assert.ok(dxf.includes(['40', '4', '1', 'fold here', '50', '45', '8', 'little_square'].join('\n')));
        assert.ok(dxf.includes(['40', '8', '1', 'big fold here', '50', '45', '8', 'big_square'].join('\n')));
    });

    it('should allow changing color using layerOptions', function() {
        const exportOptions = {
            layerOptions: {
                square: {
                    color: 4,
                },
            },
        };
        var model = {};
        makerjs.$(new makerjs.models.Square(200)).layer('yellow').center().addTo(model, 's1');
        makerjs.$(new makerjs.models.Square(50)).layer('square').center().addTo(model, 's2');
        var dxf = makerjs.exporter.toDXF(model, exportOptions);
        assert.ok(dxf.includes(['0', 'LAYER', '2', 'yellow', '70', '0', '62', '2', '6', 'CONTINUOUS'].join('\n')));
        assert.ok(dxf.includes(['0', 'LAYER', '2', 'square', '70', '0', '62', '4', '6', 'CONTINUOUS'].join('\n')));
    });

    it('should ignore dimension textPosition in DXF output', function() {
        function createDimensionModel(textPosition) {
            var model = { paths: { measured: new makerjs.paths.Line([0, 0], [100, 0]) } };
            var options = {
                layer: 'DIMENSION',
                text: '100',
                textHeight: 4,
                key: 'dim'
            };

            if (textPosition) {
                options.textPosition = textPosition;
            }

            makerjs.dimension.addHorizontal(model, [0, 0], [100, 0], -10, options);
            return model;
        }

        var normalModel = createDimensionModel();
        var movedModel = createDimensionModel([50, -20]);

        assert.notDeepEqual(
            makerjs.point.middle(normalModel.models.dim.caption.anchor),
            makerjs.point.middle(movedModel.models.dim.caption.anchor)
        );
        assert.equal(
            makerjs.exporter.toDXF(movedModel, exportOptions),
            makerjs.exporter.toDXF(normalModel, exportOptions)
        );
    });

    it('should not mark linear dimension text as manually positioned', function() {
        var model = { paths: { measured: new makerjs.paths.Line([0, 0], [0, 600]) } };
        makerjs.dimension.addVertical(model, [0, 0], [0, 600], 30, {
            layer: 'DIMENSION',
            text: '600',
            textHeight: 20,
            key: 'dim'
        });

        var dxf = makerjs.exporter.toDXF(model, exportOptions);
        var dimensionStart = dxf.indexOf(['0', 'DIMENSION'].join('\n'));
        var dimensionEnd = dxf.indexOf(['0', 'ENDSEC'].join('\n'), dimensionStart);
        var dimensionEntity = dxf.substring(dimensionStart, dimensionEnd);

        assert.ok(dimensionEntity.includes(['70', '32'].join('\n')));
        assert.equal(dimensionEntity.includes(['11', '-30', '21', '300'].join('\n')), false);
    });

    it('should split DXF block dimension lines around default text', function() {
        var model = { paths: { measured: new makerjs.paths.Line([0, 0], [100, 0]) } };
        makerjs.dimension.addHorizontal(model, [0, 0], [100, 0], -10, {
            layer: 'DIMENSION',
            text: '100',
            textHeight: 4,
            key: 'dim'
        });

        var dxf = makerjs.exporter.toDXF(model, exportOptions);
        var blockStart = dxf.indexOf(['0', 'BLOCK'].join('\n'));
        var blockEnd = dxf.indexOf(['0', 'ENDBLK'].join('\n'), blockStart);
        var block = dxf.substring(blockStart, blockEnd);

        assert.equal(block.includes(['10', '0', '20', '-10', '11', '100', '21', '-10'].join('\n')), false);
        assert.ok(block.includes(['10', '0', '20', '-10', '11', '37.6', '21', '-10'].join('\n')));
        assert.ok(block.includes(['10', '62.4', '20', '-10', '11', '100', '21', '-10'].join('\n')));
    });

});

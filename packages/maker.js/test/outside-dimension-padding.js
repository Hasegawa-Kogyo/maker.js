var assert = require('assert');
var makerjs = require('../dist/index.js');

function create(rotation, position, outside, padding) {
    var options = { arrowPlacement: outside ? 'outside' : 'inside', text: '50', textHeight: 30, arrowSize: 12, textPosition: [position, -40] };
    if (padding !== undefined) options.outsideTextPadding = padding;
    var dimension = new makerjs.models.LinearDimension([0, 0], [50, 0], -40, options);
    makerjs.model.rotate(dimension, rotation);
    return dimension;
}
function withoutDimensionLines(model) {
    var copy = makerjs.cloneObject(model);
    function visit(m) {
        Object.keys(m.paths || {}).forEach(function (key) { if (/^dimensionLine/.test(key)) delete m.paths[key]; });
        Object.values(m.models || {}).forEach(visit);
        if (m.dxfModel) visit(m.dxfModel);
    }
    visit(copy);
    return copy;
}
function lineLength(model) {
    return Object.keys(model.paths).filter(function (key) { return /^dimensionLine/.test(key); }).reduce(function (total, key) { return total + makerjs.measure.pathLength(model.paths[key]); }, 0);
}

describe('Outside dimension text padding', function () {
    [0, 90, 37, 217].forEach(function (rotation) {
        [-60, 25, 110].forEach(function (position) {
            it('shortens tails without changing text, witnesses or arrows at ' + rotation + '/' + position, function () {
                var compact = create(rotation, position, true);
                var legacy = create(rotation, position, true, 60);
                assert.deepStrictEqual(withoutDimensionLines(compact), withoutDimensionLines(legacy));
                assert.ok(lineLength(compact) < lineLength(legacy));
                assert.ok(lineLength(compact.dxfModel) < lineLength(legacy.dxfModel));
            });
        });
    });
    it('supports zero padding while preserving text space and arrow support', function () {
        var zero = create(0, 110, true, 0);
        assert.deepStrictEqual(create(0, 110, true), create(0, 110, true, 15));
        [zero, zero.dxfModel].forEach(function (m) {
            assert.ok(m.paths.dimensionLine.origin[0] <= -12);
            assert.ok(m.paths.dimensionLine.end[0] >= 140);
        });
    });
    it('does not change inside-arrow dimensions', function () {
        assert.deepStrictEqual(create(90, 110, false), create(90, 110, false, 60));
    });
    it('works through the dimension helper and aligned constructor', function () {
        var options = { arrowPlacement: 'outside', textHeight: 30, textPosition: [110, -40], outsideTextPadding: 0 };
        var horizontal = makerjs.dimension.addHorizontal({}, [0, 0], [50, 0], -40, options);
        var aligned = new makerjs.models.AlignedDimension([0, 0], [50, 0], -40, options);
        assert.equal(horizontal.paths.dimensionLine.end[0], aligned.paths.dimensionLine.end[0]);
    });
    it('rejects invalid padding rather than exporting invalid geometry', function () {
        [-1, NaN, Infinity, -Infinity].forEach(function (padding) {
            assert.throws(function () { create(0, 110, true, padding); }, /outsideTextPadding/);
        });
    });
});

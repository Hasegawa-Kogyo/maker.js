var assert = require('assert');
var makerjs = require('../dist/index.js');

function near(actual, expected) {
    assert.ok(Math.abs(actual - expected) < 0.00001, actual + ' != ' + expected);
}

function nearPoint(actual, expected) {
    near(actual[0], expected[0]);
    near(actual[1], expected[1]);
}

function entities(dxf) {
    var lines = dxf.split(/\r?\n/);
    var result = [];
    var entity;
    for (var i = 0; i + 1 < lines.length; i += 2) {
        var code = lines[i].trim();
        var value = lines[i + 1].trim();
        if (code === '0') {
            entity = {};
            result.push(entity);
        }
        if (entity) {
            if (code === '100') {
                (entity.subclasses || (entity.subclasses = [])).push(value);
            } else {
                entity[code] = value;
            }
        }
    }
    return result;
}

describe('Angular dimension DXF and arrow geometry', function () {
    // Include both sides of a frame, zero-degree wrap and a reflex sweep.
    [[0, 60], [180, 240], [46, 90], [270, 301], [350, 394], [30, 270]].forEach(function (angles) {
        it('preserves the ' + angles.join('..') + ' degree arc and tangent arrow tips', function () {
            var center = [250, 120];
            var radius = 48;
            var size = 3;
            function ray(a) {
                return makerjs.point.add(center, makerjs.point.fromPolar(a * Math.PI / 180, radius));
            }
            var dimension = new makerjs.models.AngularDimension(center, ray(angles[0]), ray(angles[1]), radius, {
                arrowSize: size, extensionLineOffset: 0, textPosition: [260, 180], textRotation: 0
            });
            var sweep = angles[1] - angles[0];
            near(dimension.dimensionData.measuredValue, sweep);
            var arc = dimension.paths.dimensionArc;
            near(arc.radius, radius);
            var tips = makerjs.point.fromArc(arc);
            [dimension.models.arrow1, dimension.models.arrow2].forEach(function (arrow, index) {
                var legs = [arrow.paths.l1, arrow.paths.l2];
                legs.forEach(function (leg) {
                    nearPoint(leg.origin, tips[index]);
                    near(makerjs.measure.pathLength(leg), size);
                });
                // The open V's tail points along the arc's inward tangent.
                var tail = makerjs.point.average(legs[0].end, legs[1].end);
                var a = (index ? arc.endAngle - 90 : arc.startAngle + 90) * Math.PI / 180;
                var vector = makerjs.point.subtract(tail, tips[index]);
                near(vector[0] * Math.sin(a) - vector[1] * Math.cos(a), 0);
                assert.ok(vector[0] * Math.cos(a) + vector[1] * Math.sin(a) > 0);
            });

            var offset = [800, 1500];
            var model = { origin: offset, models: { angle: dimension } };
            var original = JSON.stringify(model);
            var output = entities(makerjs.exporter.toDXF(model));
            assert.equal(JSON.stringify(model), original);
            var native = output.filter(function (e) { return e['0'] === 'DIMENSION'; });
            assert.equal(native.length, 1);
            var dim = native[0];
            assert.equal(+dim['70'], 37);
            assert.ok(dim.subclasses.includes('AcDb3PointAngularDimension'));
            assert.ok(!dim.subclasses.includes('AcDb2LineAngularDimension'));
            function nativePoint(code) {
                return [+dim[code], +dim[code + 10]];
            }
            nearPoint(nativePoint(13), makerjs.point.add(ray(angles[0]), offset));
            nearPoint(nativePoint(14), makerjs.point.add(ray(angles[1]), offset));
            nearPoint(nativePoint(15), makerjs.point.add(center, offset));
            nearPoint(nativePoint(10), makerjs.point.add(ray(angles[0] + sweep / 2), offset));
            nearPoint(nativePoint(11), makerjs.point.add([260, 180], offset));
            near(+dim['42'], sweep);
            var savedArcs = output.filter(function (e) { return e['0'] === 'ARC'; });
            assert.equal(savedArcs.length, 1);
            near(+savedArcs[0]['40'], radius);
        });
    });
});

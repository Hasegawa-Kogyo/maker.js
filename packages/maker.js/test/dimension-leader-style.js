var assert = require('assert');
var maker = require('../dist/index.js');
function close(a,b) { assert.ok(Math.abs(a-b)<1e-6, a+' != '+b); }
function make(options, vertical) {
    var root={models:{}}, opts=Object.assign({text:'40',textHeight:75,arrowSize:25,arrowPlacement:'outside',extensionLineOffset:0},options);
    if(vertical) maker.dimension.addVertical(root,[0,0],[0,40],150,Object.assign({key:'dim'},opts));
    else maker.dimension.addHorizontal(root,[0,0],[40,0],-150,Object.assign({key:'dim'},opts));
    return root.models.dim;
}
function groups(dxf) {
    var lines=dxf.trimEnd().split(/\r?\n/), result=[];
    for(var i=0;i<lines.length;i+=2){var code=Number(lines[i]),value=String(lines[i+1]||'').trim();if(code===0)result.push({type:value,groups:{}});else if(result.length)result[result.length-1].groups[code]=value;}
    return result;
}
describe('Configurable dimension text leaders and endpoint joints',function(){
    [true,false].forEach(function(vertical){
        it('preserves physical points and arrows with configurable '+(vertical?'vertical':'horizontal')+' leader',function(){
            var plain=make({},vertical),dim=make({textLeader:{diagonalRun:50,diagonalRise:30,landingLength:100,textGap:10,arrowTailLength:30}},vertical);
            assert.deepStrictEqual(dim.dimensionData.point1,plain.dimensionData.point1);assert.deepStrictEqual(dim.dimensionData.point2,plain.dimensionData.point2);
            assert.deepStrictEqual(dim.models,plain.models);assert.deepStrictEqual(dim.paths.extensionLine1,plain.paths.extensionLine1);assert.deepStrictEqual(dim.paths.extensionLine2,plain.paths.extensionLine2);
            close(dim.dimensionData.measuredValue,40);close(maker.measure.pathLength(dim.paths.textLeaderLanding),100);close(maker.measure.pathLength(dim.paths.dimensionLine),100);
            close(dim.dimensionData.textPosition[0],vertical?-210:120);close(dim.dimensionData.textPosition[1],vertical?120:-90);
            assert.deepStrictEqual(dim.paths,dim.dxfModel.paths);assert.ok(maker.dimension.hasExplicitStyle(dim));
        });
    });
    it('supports opposite sides start attachment and minimum arrow support',function(){
        var dim=make({textLeader:{diagonalRun:80,diagonalRise:20,landingLength:60,textGap:8,arrowTailLength:1,side:'negative',attachment:'start',alongDirection:-1}},true);
        close(dim.paths.textLeaderDiagonal.origin[1],0);close(dim.paths.textLeaderDiagonal.end[0],-70);close(dim.paths.textLeaderDiagonal.end[1],-20);close(dim.paths.textLeaderLanding.end[1],-80);close(maker.measure.pathLength(dim.paths.dimensionLine),90);
    });
    it('keeps a single configurable joint where two dimensions meet',function(){
        var root={models:{}},opts={textHeight:25,arrowSize:10,arrowPlacement:'outside',extensionLineOffset:0};
        var lower=maker.dimension.addVertical(root,[0,0],[0,72],150,Object.assign({key:'lower',text:'72',endpointMarkers:{end:'joint',jointRadius:6}},opts));
        var upper=maker.dimension.addVertical(root,[0,72],[0,112],150,Object.assign({key:'upper',text:'40',endpointMarkers:{start:'none'},textLeader:{diagonalRun:30,diagonalRise:20,landingLength:60,textGap:6}},opts));
        assert.ok(lower.models.joint2);assert.ok(!lower.models.arrow2);assert.ok(!upper.models.arrow1);assert.ok(!upper.models.joint1);
        assert.strictEqual(Object.keys(lower.models.joint2.paths).length,7);close(lower.models.joint2.paths.center.radius,2.7);
        close(lower.models.joint2.paths.edge0.origin[0],-144);close(lower.models.joint2.paths.edge0.origin[1],72);
        close(lower.paths.dimensionLine.end[1],72);close(upper.paths.dimensionLine.origin[1],72);
        var before=JSON.stringify(root),items=groups(maker.exporter.toDXF(root));
        assert.strictEqual(items.filter(function(x){return x.type==='DIMENSION';}).length,2);
        assert.strictEqual(items.filter(function(x){return x.type==='CIRCLE';}).length,1);
        assert.strictEqual(JSON.stringify(root),before);
    });
    it('exports transformed native dimension blocks without stale text or definition points',function(){
        var root={models:{dim:make({textLeader:{diagonalRun:50,diagonalRise:30,landingLength:100,textGap:10}},true)}};
        maker.model.rotate(root,90);maker.model.scale(root,.2);maker.model.moveRelative(root,[50,80]);
        var before=JSON.stringify(root),dim=root.models.dim,caption=maker.point.average(dim.caption.anchor.origin,dim.caption.anchor.end);
        var native=groups(maker.exporter.toDXF(root)).filter(function(x){return x.type==='DIMENSION';})[0];
        close(Number(native.groups[11]),caption[0]+50);close(Number(native.groups[21]),caption[1]+80);assert.ok(Number(native.groups[70])&128);
        close(Number(native.groups[13]),dim.paths.extensionLine1.origin[0]+50);close(Number(native.groups[24]),dim.paths.extensionLine2.origin[1]+80);
        assert.strictEqual(JSON.stringify(root),before);close(maker.dimension.getExplicitTextHeight(dim),15);
        assert.ok(maker.exporter.toSVG(root).indexOf('40')>=0);
    });
    it('supports aligned constructors and long inside-arrow dimensions',function(){
        var dim=new maker.models.AlignedDimension([0,0],[300,400],40,{textLeader:{},endpointMarkers:{end:'joint'},textHeight:20,arrowSize:8});
        close(dim.dimensionData.measuredValue,500);assert.ok(dim.paths.textLeaderDiagonal);assert.ok(dim.models.joint2);close(maker.measure.pathLength(dim.paths.dimensionLine),500);
    });
    it('rejects invalid values and leaves normal styles unchanged',function(){
        [-1,NaN,Infinity].forEach(function(value){assert.throws(function(){make({textLeader:{diagonalRun:value}},true);},RangeError);});
        assert.throws(function(){make({textLeader:{landingLength:0}},true);},RangeError);
        assert.throws(function(){make({endpointMarkers:{end:'joint',jointRadius:0}},true);},RangeError);
        var plain=make({},true);assert.ok(!maker.dimension.hasExplicitStyle(plain));assert.ok(!plain.paths.textLeaderDiagonal);assert.ok(plain.models.arrow1&&plain.models.arrow2);
    });
});

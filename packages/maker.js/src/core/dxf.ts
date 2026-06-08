namespace MakerJs.exporter {

    export function toDXF(modelToExport: IModel, options?: IDXFRenderOptions): string;
    export function toDXF(pathsToExport: IPath[], options?: IDXFRenderOptions): string;
    export function toDXF(pathToExport: IPath, options?: IDXFRenderOptions): string;

    /**
     * Renders an item in AutoDesk DFX file format.
     *
     * @param itemToExport Item to render: may be a path, an array of paths, or a model object.
     * @param options Rendering options object.
     * @param options.units String of the unit system. May be omitted. See makerjs.unitType for possible values.
     * @returns String of DXF content.
     */
    export function toDXF(itemToExport: any, options: IDXFRenderOptions = {}): string {

        //DXF format documentation:
        //http://images.autodesk.com/adsk/files/acad_dxf0.pdf

        var opts: IDXFRenderOptions = {
            fontSize: 9
        };
        var layerIds: string[] = [];

        const doc: DxfParser.DXFDocument = {
            entities: [],
            header: {},
            tables: {}
        };

        interface IDXFDimensionBlockInfo {
            routeKey: string;
            blockName: string;
            insertOffset: IPoint;
            entities: DxfParser.Entity[];
            layer: string;
            dimensionData?: any;
        }

        interface IDXFCaptionWithRoute extends ICaption {
            layer?: string;
            routeKey: string;
        }

        const dimensionBlocks: IDXFDimensionBlockInfo[] = [];

        extendObject(opts, options);

        var modelToExport = itemToExport as IModel;

        if (isModel(itemToExport)) {
            if (modelToExport.exporterOptions) {
                extendObject(opts, modelToExport.exporterOptions['toDXF']);
            }
        }

        function createDxfModelContext(modelContext: IModel): IModel {
            const modelAsAny = modelContext as any;
            const source = (modelAsAny.dxfModel || modelContext) as IModel;
            const result: any = {};

            for (const key in source) {
                if (key !== 'models') {
                    result[key] = (source as any)[key];
                }
            }

            if (modelAsAny.dxfModel) {
                if (modelContext.origin !== undefined) {
                    result.origin = modelContext.origin;
                }
                if (modelContext.layer !== undefined) {
                    result.layer = modelContext.layer;
                }
            }

            if (source.models) {
                result.models = {};
                for (const modelId in source.models) {
                    const childModel = source.models[modelId];
                    result.models[modelId] = childModel ? createDxfModelContext(childModel) : childModel;
                }
            }

            return result as IModel;
        }

        if (isModel(modelToExport)) {
            modelToExport = createDxfModelContext(modelToExport);
        }

        // -------------------------
        // ✅ Unicode / Japanese text support
        // Encode non-ASCII as AutoCAD-style \U+XXXX
        // -------------------------
        function encodeDxfText(s: string): string {
            let out = "";

            for (let i = 0; i < s.length; i++) {
                const ch = s[i];
                const code = s.charCodeAt(i);

                // escape DXF text control characters
                if (ch === "\\") { out += "\\\\"; continue; }
                if (ch === "{") { out += "\\{"; continue; }
                if (ch === "}") { out += "\\}"; continue; }

                // TEXT entity doesn't support multi-line well; replace newline with space
                if (ch === "\r") continue;
                if (ch === "\n") { out += " "; continue; }

                // printable ASCII
                if (code >= 0x20 && code <= 0x7E) {
                    out += ch;
                    continue;
                }

                // Japanese is in BMP -> 4 hex digits works
                out += "\\U+" + code.toString(16).toUpperCase().padStart(4, "0");
            }

            return out;
        }

        function colorLayerOptions(layer: string): IDXFLayerOptions {
            if (opts.layerOptions && opts.layerOptions[layer]) return opts.layerOptions[layer];

            if (layer in colors) {
                return {
                    color: colors[layer]
                };
            }
        }

        function lineTypeLayerOptions(layer: string): string {
            if (opts.layerOptions && opts.layerOptions[layer] && opts.layerOptions[layer].lineType) {
                return opts.layerOptions[layer].lineType;
            }
            return "CONTINUOUS";
        }

        function addLayerId(layerId: string) {
            if (layerIds.indexOf(layerId) < 0) {
                layerIds.push(layerId);
            }
        }

        function defaultLayer(pathContext: IPath, parentLayer: string) {
            var layerId = (pathContext && pathContext.layer) || parentLayer || '0';
            addLayerId(layerId);
            return layerId;
        }

        var map: { [type: string]: (pathValue: IPath, offset: IPoint, layer: string) => DxfParser.Entity; } = {};

        function dxfVertex(p: IPoint, offset: IPoint = point.zero()) {
            return {
                x: round(p[0] + offset[0], opts.accuracy),
                y: round(p[1] + offset[1], opts.accuracy),
                z: 0
            };
        }

        function createDimensionEntity(blockName: string, data: any, offset: IPoint): DxfParser.EntityDIMENSION {
            const dim: DxfParser.EntityDIMENSION = {
                type: 'DIMENSION',
                layer: data.layer || 'DIMENSION',
                block: blockName,
                dimensionType: 32,
                attachmentPoint: 5,
                text: data.text ? encodeDxfText(data.text) : '',
                actualMeasurement: data.measuredValue
            } as any;

            (dim as any).textHeight = data.textHeight;
            (dim as any).styleName = 'STANDARD';
            (dim as any).extrusionDirection = { x: 0, y: 0, z: 1 };

            if (data.type === 'linear' || data.type === 'aligned') {
                const linearData = data as any;
                const dimensionAngle = linearData.dimensionAngle === undefined
                    ? angle.ofPointInDegrees(linearData.point1, linearData.point2)
                    : linearData.dimensionAngle;
                const dimensionPoint = point.add(linearData.point1, point.fromPolar(angle.toRadians(dimensionAngle + 90), linearData.offset));
                const defaultTextPosition = point.average(
                    dimensionPoint,
                    point.add(linearData.point2, point.fromPolar(angle.toRadians(dimensionAngle + 90), linearData.offset))
                );

                dim.anchorPoint = dxfVertex(dimensionPoint, offset);
                dim.linearOrAngularPoint1 = dxfVertex(linearData.point1, offset);
                dim.linearOrAngularPoint2 = dxfVertex(linearData.point2, offset);
                dim.angle = round(dimensionAngle, opts.accuracy);
                dim.dimensionType = 32;
                return dim;
            }

            if (data.type === 'angular') {
                const angularData = data as any;
                const angle1 = angle.ofPointInDegrees(angularData.centerPoint, angularData.point1);
                const arcPoint = point.add(angularData.centerPoint, point.fromPolar(angle.toRadians(angle1), angularData.radius));

                dim.dimensionType = 34;
                dim.anchorPoint = dxfVertex(arcPoint, offset);
                dim.middleOfText = dxfVertex(angularData.textPosition || arcPoint, offset);
                dim.linearOrAngularPoint1 = dxfVertex(angularData.point1, offset);
                dim.linearOrAngularPoint2 = dxfVertex(angularData.point2, offset);
                dim.arcPoint = dxfVertex(angularData.centerPoint, offset);
                return dim;
            }

            const radialData = data as any;
            dim.dimensionType = data.type === 'diameter' ? 35 : 36;
            dim.anchorPoint = dxfVertex(radialData.radiusPoint, offset);
            dim.middleOfText = dxfVertex(radialData.textPosition || radialData.radiusPoint, offset);
            dim.linearOrAngularPoint1 = dxfVertex(radialData.centerPoint, offset);
            dim.diameterOrRadiusPoint = dxfVertex(radialData.radiusPoint, offset);
            return dim;
        }

        function getDimensionOwner(routeKey: string) {
            for (let i = 0; i < dimensionBlocks.length; i++) {
                const block = dimensionBlocks[i];
                if (routeKey === block.routeKey || routeKey.indexOf(block.routeKey + '.') === 0) {
                    return block;
                }
            }
            return null;
        }

        function collectCaptionsWithRoute(modelContext: IModel): IDXFCaptionWithRoute[] {
            const captions: IDXFCaptionWithRoute[] = [];

            function tryAddCaption(m: IModel, offset: IPoint, layer: string | undefined, routeKey: string) {
                if (m.caption) {
                    const modelOffset = point.add((m.origin || point.zero()), offset);
                    captions.push({
                        text: m.caption.text,
                        anchor: path.clone(m.caption.anchor, modelOffset) as IPathLine,
                        layer: m.caption.anchor.layer || layer || '0',
                        routeKey
                    });
                }
            }

            tryAddCaption(modelContext, modelContext.origin || point.zero(), modelContext.layer, '');

            model.walk(modelContext, {
                afterChildWalk: walkedModel => {
                    tryAddCaption(walkedModel.childModel, walkedModel.offset, walkedModel.layer, walkedModel.routeKey);
                }
            });

            return captions;
        }

        map[pathType.Line] = function (line: IPathLine, offset: IPoint, layer: string) {
            const layerId = defaultLayer(line, layer);

            const lineEntity: DxfParser.EntityLINE = {
                type: "LINE",
                layer: layerId,
                vertices: [
                    {
                        x: round(line.origin[0] + offset[0], opts.accuracy),
                        y: round(line.origin[1] + offset[1], opts.accuracy)
                    },
                    {
                        x: round(line.end[0] + offset[0], opts.accuracy),
                        y: round(line.end[1] + offset[1], opts.accuracy)
                    }
                ]
            };

            (lineEntity as any).lineType = lineTypeLayerOptions(layerId);
            return lineEntity;
        };

        map[pathType.Circle] = function (circle: IPathCircle, offset: IPoint, layer: string) {
            const layerId = defaultLayer(circle, layer);

            const circleEntity: DxfParser.EntityCIRCLE = {
                type: "CIRCLE",
                layer: layerId,
                center: {
                    x: round(circle.origin[0] + offset[0], opts.accuracy),
                    y: round(circle.origin[1] + offset[1], opts.accuracy),
                },
                radius: round(circle.radius, opts.accuracy)
            };

            (circleEntity as any).lineType = lineTypeLayerOptions(layerId);
            return circleEntity;
        };

        map[pathType.Arc] = function (arc: IPathArc, offset: IPoint, layer: string) {
            const layerId = defaultLayer(arc, layer);

            const arcEntity: DxfParser.EntityARC = {
                type: "ARC",
                layer: layerId,
                center: {
                    x: round(arc.origin[0] + offset[0], opts.accuracy),
                    y: round(arc.origin[1] + offset[1], opts.accuracy)
                },
                radius: round(arc.radius, opts.accuracy),
                startAngle: round(arc.startAngle, opts.accuracy),
                endAngle: round(arc.endAngle, opts.accuracy)
            };

            (arcEntity as any).lineType = lineTypeLayerOptions(layerId);
            return arcEntity;
        };

        //TODO - handle scenario if any bezier seeds get passed
        //map[pathType.BezierSeed]

        function appendVertex(v: IPoint, layer: string, bulge?: number) {
            const vertex: DxfParser.EntityVERTEX = {
                type: "VERTEX",
                layer: defaultLayer(null, layer),
                x: round(v[0], opts.accuracy),
                y: round(v[1], opts.accuracy),
                bulge
            };
            return vertex;
        }

        function polyline(c: IChainOnLayer) {
            const polylineEntity: DxfParser.EntityPOLYLINE = {
                type: "POLYLINE",
                layer: defaultLayer(null, c.layer),
                shape: c.chain.endless,
                vertices: []
            };

            (polylineEntity as any).lineType = lineTypeLayerOptions(polylineEntity.layer);

            c.chain.links.forEach((link, i) => {
                let bulge: number;
                if (link.walkedPath.pathContext.type === pathType.Arc) {
                    const arc = link.walkedPath.pathContext as IPathArc;
                    bulge = round(Math.tan(angle.toRadians(angle.ofArcSpan(arc)) / 4), opts.accuracy);
                    if (link.reversed) {
                        bulge *= -1;
                    }
                }
                const vertex = link.endPoints[link.reversed ? 1 : 0];
                polylineEntity.vertices.push(appendVertex(vertex, c.layer, bulge));
            });

            if (!c.chain.endless) {
                const lastLink = c.chain.links[c.chain.links.length - 1];
                const endPoint = lastLink.endPoints[lastLink.reversed ? 0 : 1];
                polylineEntity.vertices.push(appendVertex(endPoint, c.layer));
            }

            return polylineEntity;
        }

        // ✅ TEXT entity with Unicode encoding + STYLE reference
        function text(caption: ICaption & { layer?: string }) {
            const layerId = defaultLayer(null, caption.layer);
            const layerOptions = colorLayerOptions(layerId);
            const center = point.middle(caption.anchor);
            const textEntity: DxfParser.EntityTEXT = {
                type: "TEXT",
                startPoint: appendVertex(center, null),
                endPoint: appendVertex(center, null),
                layer: layerId,
                textHeight: (layerOptions && layerOptions.fontSize) || opts.fontSize,
                text: encodeDxfText(caption.text), // ✅ Japanese supported here
                halign: 4, // Middle
                valign: 0, // Baseline
                rotation: angle.ofPointInDegrees(caption.anchor.origin, caption.anchor.end)
            };

            // STYLE name (we output it in TABLES -> STYLE)
            (textEntity as any).styleName = (opts as any).textStyleName || "JP";

            return textEntity;
        }

        function textFromOptions(t: IDXFText): DxfParser.EntityTEXT {
            const layerId = defaultLayer(null, t.layer || "0");
            const layerOptions = colorLayerOptions(layerId);

            const textEntity: DxfParser.EntityTEXT = {
                type: "TEXT",
                startPoint: appendVertex([t.x, t.y] as any, null),
                endPoint: appendVertex([t.x, t.y] as any, null),
                layer: layerId,
                textHeight: t.height ?? ((layerOptions && layerOptions.fontSize) || opts.fontSize),
                text: encodeDxfText(t.text),
                halign: t.halign ?? 0,
                valign: t.valign ?? 0,
                rotation: t.rotation ?? 0
            };

            (textEntity as any).styleName = t.styleName || (opts as any).textStyleName || "JP";
            return textEntity;
        }


        function layerOut(layerId: string, layerColor: number) {
            const layerEntity: DxfParser.Layer = {
                name: layerId,
                color: layerColor
            } as any;

            (layerEntity as any).lineType = lineTypeLayerOptions(layerId);
            return layerEntity;
        }

        function lineTypesOut() {
            // Dash pattern convention: positive = drawn segment, negative = gap, 0 can be dot.
            // patternLength is sum of absolute values.
            const lineStyleTable: DxfParser.TableLTYPE =
            {
                lineTypes: {
                    "CONTINUOUS": {
                        name: "CONTINUOUS",
                        description: "______",
                        patternLength: 0,
                        elements: []
                    } as any,

                    "DASHED": {
                        name: "DASHED",
                        description: "_ _ _ ",
                        elements: [5, -2.5],
                        patternLength: 7.5
                    } as any,

                    "DOTTED": {
                        name: "DOTTED",
                        description: ". . . ",
                        elements: [0.5, -1.0],
                        patternLength: 1.5
                    } as any
                }
            };
            const tableName: DxfParser.TableNames = 'lineType';
            doc.tables[tableName] = lineStyleTable;
        }

        function layersOut() {
            const layerTable: DxfParser.TableLAYER = {
                layers: {}
            }
            layerIds.forEach(layerId => {
                var layerOptions = colorLayerOptions(layerId);
                if (layerOptions) {
                    layerTable.layers[layerId] = layerOut(layerId, layerOptions.color);
                }
            });
            const tableName: DxfParser.TableNames = 'layer';
            doc.tables[tableName] = layerTable;
        }

        // ✅ STYLE table output (choose a Japanese-capable font)
        function stylesOut() {
            const styleTable: any = {
                styles: {
                    "STANDARD": { name: "STANDARD", fontFile: "txt.shx" },
                    // Choose what you want:
                    // - "MS Gothic" / "Yu Gothic" are Windows fonts, but DXF STYLE usually expects a font file name.
                    // - Many CADs accept TTF file names (e.g., "msgothic.ttc", "YuGothic.ttf") if available.
                    "JP": { name: "JP", fontFile: (opts as any).jpFontFile || "YuGothic.ttf" }
                }
            };
            doc.tables["style" as any] = styleTable;
        }

        function header() {
            if (opts.units) {
                var units = dxfUnit[opts.units];
                doc.header["$INSUNITS"] = units;
            }

            // Optional: Some CADs behave better when codepage is declared.
            // Our header writer supports strings (group code 3) below.
            // doc.header["$DWGCODEPAGE"] = (opts as any).codePage || "ANSI_932"; // Shift-JIS
        }

        function entities(walkedPaths: IWalkPath[], chains: IChainOnLayer[], captions: IDXFCaptionWithRoute[]) {
            const entityArray = doc.entities;

            entityArray.push.apply(entityArray, chains.map(polyline));
            walkedPaths.forEach((walkedPath: IWalkPath) => {
                var fn = map[walkedPath.pathContext.type];
                if (fn) {
                    const dimensionOwner = getDimensionOwner(walkedPath.routeKey);
                    if (dimensionOwner) {
                        const localOffset = dimensionOwner.dimensionData ? walkedPath.offset : point.subtract(walkedPath.offset, dimensionOwner.insertOffset);
                        const entity = fn(walkedPath.pathContext, localOffset, walkedPath.layer);
                        dimensionOwner.entities.push(entity);
                    } else {
                        const entity = fn(walkedPath.pathContext, walkedPath.offset, walkedPath.layer);
                        entityArray.push(entity);
                    }
                }
            });

            captions.forEach(caption => {
                const dimensionOwner = getDimensionOwner(caption.routeKey);
                if (dimensionOwner) {
                    const captionOrigin = dimensionOwner.dimensionData ? caption.anchor.origin : point.subtract(caption.anchor.origin, dimensionOwner.insertOffset);
                    const captionEnd = dimensionOwner.dimensionData ? caption.anchor.end : point.subtract(caption.anchor.end, dimensionOwner.insertOffset);
                    const localCaption: ICaption & { layer?: string } = {
                        text: caption.text,
                        layer: caption.layer,
                        anchor: new paths.Line(
                            captionOrigin,
                            captionEnd
                        )
                    };
                    dimensionOwner.entities.push(text(localCaption));
                } else {
                    entityArray.push(text(caption));
                }
            });
        }

        //fixup options

        if (!opts.units) {
            var units = tryGetModelUnits(itemToExport);
            if (units) {
                opts.units = units;
            }
        }

        //also pass back to options parameter
        extendObject(options, opts);

        //begin dxf output

        if (isModel(modelToExport)) {
            let dimensionBlockIndex = 0;
            model.walk(modelToExport, {
                beforeChildWalk: (walkedModel: IWalkModel) => {
                    const childModel: any = walkedModel.childModel;
                    if (childModel && (childModel.dimensionData || childModel.labelData)) {
                        const dimensionData = childModel.dimensionData;
                        const insertOffset = point.add(walkedModel.offset, childModel.origin || [0, 0]);
                        const layerId = walkedModel.layer || '0';
                        const blockName = dimensionData ? '*D' + dimensionBlockIndex++ : 'MKR_DIM_' + (++dimensionBlockIndex);
                        const blockInfo: IDXFDimensionBlockInfo = {
                            routeKey: walkedModel.routeKey,
                            blockName,
                            insertOffset,
                            entities: [],
                            layer: layerId,
                            dimensionData
                        };

                        dimensionBlocks.push(blockInfo);
                        addLayerId(layerId);

                        if (dimensionData) {
                            doc.entities.push(createDimensionEntity(blockName, dimensionData, insertOffset));
                        } else {
                            doc.entities.push({
                                type: 'INSERT',
                                name: blockName,
                                layer: layerId,
                                x: round(insertOffset[0], opts.accuracy),
                                y: round(insertOffset[1], opts.accuracy)
                            } as any);
                        }
                    }
                    return true;
                }
            });
        }

        const chainsOnLayers: IChainOnLayer[] = [];
        const walkedPaths: IWalkPath[] = [];
        if (opts.usePOLYLINE) {
            const cb: IChainCallback = function (chains: IChain[], loose: IWalkPath[], layer: string) {
                chains.forEach(c => {
                    if (c.endless && c.links.length === 1 && c.links[0].walkedPath.pathContext.type === pathType.Circle) {
                        //don't treat circles as lwpolylines
                        walkedPaths.push(c.links[0].walkedPath);
                        return;
                    }
                    const chainOnLayer: IChainOnLayer = { chain: c, layer };
                    chainsOnLayers.push(chainOnLayer);
                });
                walkedPaths.push.apply(walkedPaths, loose);
            }
            model.findChains(modelToExport, cb, { byLayers: true, pointMatchingDistance: opts.pointMatchingDistance });
        } else {
            var walkOptions: IWalkOptions = {
                onPath: (walkedPath: IWalkPath) => {
                    walkedPaths.push(walkedPath);
                }
            };
            model.walk(modelToExport, walkOptions);
        }
        entities(walkedPaths, chainsOnLayers, collectCaptionsWithRoute(modelToExport));

        if ((opts as any).texts && Array.isArray((opts as any).texts)) {
            (opts as any).texts.forEach((t: IDXFText) => {
                doc.entities.push(textFromOptions(t));
            });
        }


        header();

        lineTypesOut();
        layersOut();
        stylesOut(); // ✅ add STYLE table

        return outputDocument(doc, dimensionBlocks);
    }

    /**
     * @private
     */
    function outputDocument(doc: DxfParser.DXFDocument, dimensionBlocks: { blockName: string; entities: DxfParser.Entity[]; layer: string; dimensionData?: any; }[]) {

        const dxf: (string | number)[] = [];
        function append(...values: (string | number)[]) {
            dxf.push.apply(dxf, values);
        }

        function appendLineType(entity: any) {
            const lt = entity.lineType as string | undefined;
            if (lt) {
                append("6", lt);
            }
        }

        var map: { [entityType: string]: (entity: DxfParser.Entity) => void; } = {};

        map["LINE"] = function (line: DxfParser.EntityLINE) {
            append("0", "LINE",
                "8",
                line.layer
            );

            appendLineType(line);

            append(
                "10",
                line.vertices[0].x,
                "20",
                line.vertices[0].y,
                "11",
                line.vertices[1].x,
                "21",
                line.vertices[1].y
            );
        };

        map["CIRCLE"] = function (circle: DxfParser.EntityCIRCLE) {
            append("0", "CIRCLE",
                "8",
                circle.layer
            );

            appendLineType(circle);

            append(
                "10",
                circle.center.x,
                "20",
                circle.center.y,
                "40",
                circle.radius
            );
        };

        map["ARC"] = function (arc: DxfParser.EntityARC) {
            append("0", "ARC",
                "8",
                arc.layer
            );

            appendLineType(arc);

            append(
                "10",
                arc.center.x,
                "20",
                arc.center.y,
                "40",
                arc.radius,
                "50",
                arc.startAngle,
                "51",
                arc.endAngle
            );
        };

        //TODO - handle scenario if any bezier seeds get passed
        //map[pathType.BezierSeed]

        map["VERTEX"] = function (vertex: DxfParser.EntityVERTEX) {
            append("0", "VERTEX",
                "8",
                vertex.layer,
                "10",
                vertex.x,
                "20",
                vertex.y
            );

            if (vertex.bulge !== undefined) {
                append("42", vertex.bulge);
            }
        }

        map["POLYLINE"] = function (polyline: DxfParser.EntityPOLYLINE) {
            append("0", "POLYLINE",
                "8",
                polyline.layer
            );

            appendLineType(polyline);

            append(
                "66",
                1,
                "70",
                polyline.shape ? 1 : 0
            );

            polyline.vertices.forEach(vertex => map["VERTEX"](vertex));

            append("0", "SEQEND");
        }

        // ✅ TEXT: add STYLE with group code 7
        map["TEXT"] = function (text: DxfParser.EntityTEXT) {
            append(
                "0", "TEXT",
                "10", text.startPoint.x,
                "20", text.startPoint.y,
                "11", text.endPoint.x,
                "21", text.endPoint.y,
                "40", text.textHeight,
                "1", text.text,
                "50", text.rotation,
                "8", text.layer,
                "7", (text as any).styleName || "STANDARD", // ✅
                "72", text.halign,
                "73", text.valign
            );
        }

        map["DIMENSION"] = function (dim: DxfParser.EntityDIMENSION) {
            append(
                "0", "DIMENSION",
                "100", "AcDbEntity",
                "8", dim.layer || "DIMENSION",
                "100", "AcDbDimension",
                "2", dim.block || (dim as any).blockName || "*D0",
                "10", dim.anchorPoint ? dim.anchorPoint.x : 0,
                "20", dim.anchorPoint ? dim.anchorPoint.y : 0,
                "30", dim.anchorPoint ? (dim.anchorPoint.z || 0) : 0
            );

            if (dim.middleOfText) {
                append("11", dim.middleOfText.x, "21", dim.middleOfText.y, "31", dim.middleOfText.z || 0);
            }

            append("70", dim.dimensionType === undefined ? 32 : dim.dimensionType);

            if (dim.text !== undefined) {
                append("1", dim.text);
            }

            append(
                "71", dim.attachmentPoint || 5,
                "3", (dim as any).styleName || "STANDARD"
            );

            if (dim.actualMeasurement !== undefined) {
                append("42", dim.actualMeasurement);
            }

            if ((dim as any).textHeight !== undefined) {
                append("140", (dim as any).textHeight);
            }

            append("210", 0, "220", 0, "230", 1);

            if (dim.dimensionType === 34) {
                append("100", "AcDb2LineAngularDimension");
            } else if (dim.dimensionType === 35) {
                append("100", "AcDbDiametricDimension");
            } else if (dim.dimensionType === 36) {
                append("100", "AcDbRadialDimension");
            } else {
                append("100", "AcDbAlignedDimension");
            }

            if (dim.linearOrAngularPoint1) {
                append("13", dim.linearOrAngularPoint1.x, "23", dim.linearOrAngularPoint1.y, "33", dim.linearOrAngularPoint1.z || 0);
            }

            if (dim.linearOrAngularPoint2) {
                append("14", dim.linearOrAngularPoint2.x, "24", dim.linearOrAngularPoint2.y, "34", dim.linearOrAngularPoint2.z || 0);
            }

            if (dim.diameterOrRadiusPoint) {
                append("15", dim.diameterOrRadiusPoint.x, "25", dim.diameterOrRadiusPoint.y, "35", dim.diameterOrRadiusPoint.z || 0);
            }

            if (dim.arcPoint) {
                append("15", dim.arcPoint.x, "25", dim.arcPoint.y, "35", dim.arcPoint.z || 0);
            }

            if (dim.dimensionType === 32 || dim.dimensionType === 160) {
                append("100", "AcDbRotatedDimension");
                append("50", dim.angle || 0);
            }
        }

        map["INSERT"] = function (insert: any) {
            append(
                "0", "INSERT",
                "8", insert.layer || "0",
                "2", insert.name,
                "10", insert.x || 0,
                "20", insert.y || 0
            );
        }

        function section(sectionFn: () => void) {
            append("0", "SECTION");

            sectionFn();

            append("0", "ENDSEC");
        }

        function table(fn: Function) {
            append("0", "TABLE");
            fn();
            append("0", "ENDTAB");
        }

        function tables() {
            append("2", "TABLES");

            table(lineTypesOut);
            table(layersOut);
            table(stylesOut); // ✅ add
            if (dimensionBlocks.some(block => block.dimensionData)) {
                table(blockRecordsOut);
                table(dimStylesOut);
            }
        }

        function layerOut(layer: DxfParser.Layer) {
            const lt = ((layer as any).lineType || "CONTINUOUS") as string;

            append("0", "LAYER",
                "2",
                layer.name,
                "70",
                "0",
                "62",
                layer.color,
                "6",
                lt
            );
        }

        function lineTypeOut(lineType: DxfParser.LineType) {
            const elements: number[] = (((lineType as any).elements) || []) as number[];

            append("0", "LTYPE",
                "72", //72 Alignment code; value is always 65, the ASCII code for A
                "65",
                "70",
                "0",
                "2",
                lineType.name,
                "3",
                lineType.description,
                "73",
                elements.length,
                "40",
                lineType.patternLength
            );

            elements.forEach(e => append("49", e));
        }

        function lineTypesOut() {
            const lineTypeTableName: DxfParser.TableNames = 'lineType';
            const lineTypeTable = doc.tables[lineTypeTableName] as DxfParser.TableLTYPE;

            append("2", "LTYPE");

            for (let lineTypeId in lineTypeTable.lineTypes) {
                let lineType = lineTypeTable.lineTypes[lineTypeId];
                lineTypeOut(lineType);
            }
        }

        function layersOut() {
            const layerTableName: DxfParser.TableNames = 'layer';
            const layerTable = doc.tables[layerTableName] as DxfParser.TableLAYER;

            append("2", "LAYER");

            for (let layerId in layerTable.layers) {
                let layer = layerTable.layers[layerId];
                layerOut(layer);
            }
        }

        // ✅ STYLE table writer
        function stylesOut() {
            const styleTable = doc.tables["style" as any] as any;
            append("2", "STYLE");

            for (const styleId in styleTable.styles) {
                const st = styleTable.styles[styleId];
                append(
                    "0", "STYLE",
                    "2", st.name,
                    "70", "0",
                    "40", 0,
                    "41", 1,
                    "50", 0,
                    "71", 0,
                    "42", 0,
                    "3", st.fontFile || "txt.shx",
                    "4", ""
                );
            }
        }

        function blockRecordsOut() {
            append("2", "BLOCK_RECORD", "70", dimensionBlocks.length + 2);
            append("0", "BLOCK_RECORD", "2", "*Model_Space", "70", 0);
            append("0", "BLOCK_RECORD", "2", "*Paper_Space", "70", 0);

            dimensionBlocks.forEach(block => {
                append("0", "BLOCK_RECORD", "2", block.blockName, "70", 0);
            });
        }

        function dimStylesOut() {
            append(
                "2", "DIMSTYLE",
                "70", 1,
                "0", "DIMSTYLE",
                "2", "STANDARD",
                "70", 0,
                "40", 1,
                "41", 2.5,
                "42", 0.625,
                "44", 1.25,
                "140", 2.5
            );
        }

        // ✅ Header writer that supports strings and integers
        function header() {
            append("2", "HEADER");

            for (let key in doc.header) {
                const value = (doc.header as any)[key];

                // In DXF:
                // - string vars often use group code 3
                // - int vars often use group code 70
                if (typeof value === "string") {
                    append("9", key, "3", value);
                } else {
                    append("9", key, "70", value);
                }
            }
        }

        function entities(entityArray: DxfParser.Entity[]) {
            append("2", "ENTITIES");

            entityArray.forEach(entity => {
                const fn = map[entity.type];
                if (fn) {
                    fn(entity);
                }
            });
        }

        function blocks() {
            append("2", "BLOCKS");

            dimensionBlocks.forEach(block => {
                append(
                    "0", "BLOCK",
                    "8", block.layer || "0",
                    "2", block.blockName,
                    "70", block.dimensionData ? "1" : "0",
                    "10", 0,
                    "20", 0,
                    "3", block.blockName,
                    "1", ""
                );

                block.entities.forEach(entity => {
                    const fn = map[entity.type];
                    if (fn) {
                        fn(entity);
                    }
                });

                append(
                    "0", "ENDBLK",
                    "8", block.layer || "0"
                );
            });
        }

        //begin dxf output

        section(header);
        section(tables);
        if (dimensionBlocks.length) {
            section(blocks);
        }
        section(() => entities(doc.entities));

        append("0", "EOF");

        return dxf.join('\n');
    }

    /**
     * @private
     */
    var dxfUnit: { [unitType: string]: number } = {};

    //DXF format documentation:
    //http://images.autodesk.com/adsk/files/acad_dxf0.pdf
    //Default drawing units for AutoCAD DesignCenter blocks:
    //0 = Unitless; 1 = Inches; 2 = Feet; 3 = Miles; 4 = Millimeters; 5 = Centimeters; 6 = Meters; 7 = Kilometers; 8 = Microinches;

    dxfUnit[''] = 0;
    dxfUnit[unitType.Inch] = 1;
    dxfUnit[unitType.Foot] = 2;
    dxfUnit[unitType.Millimeter] = 4;
    dxfUnit[unitType.Centimeter] = 5;
    dxfUnit[unitType.Meter] = 6;

    /**
     * DXF layer options.
     */
    export interface IDXFLayerOptions {

        /**
         * DXF layer color.
         */
        color: number

        /**
         * Text size for TEXT entities.
         */
        fontSize?: number;

        /**
         * DXF linetype name for this layer.
         * Example: "CONTINUOUS", "DASHED", "DOTTED"
         */
        lineType?: 'CONTINUOUS' | 'DASHED' | 'DOTTED';
    }

    /**
     * DXF rendering options.
     */
    export interface IDXFRenderOptions extends IExportOptions, IPointMatchOptions {

        /**
         * Text size for TEXT entities.
         */
        fontSize?: number;

        /**
         * DXF options per layer.
         */
        layerOptions?: { [layerId: string]: IDXFLayerOptions };

        /**
         * Flag to use POLYLINE
         */
        usePOLYLINE?: boolean;

        // ✅ add this
        texts?: IDXFText[];

        // Optional extras (not required, but used by the code above if present)
        // jpFontFile?: string;   // e.g. "YuGothic.ttf" or "msgothic.ttc"
        // codePage?: string;     // e.g. "ANSI_932"
        // textStyleName?: string;// e.g. "JP"
    }

    /**
     * @private
     */
    interface IChainOnLayer {
        chain: IChain;
        layer: string;
    }
    export interface IDXFText {
        text: string;
        x: number;
        y: number;
        layer?: string;
        rotation?: number;   // degrees
        height?: number;     // text height
        halign?: number;     // 0/1/2/3/4/5 (DXF)
        valign?: number;     // 0..3 (DXF)
        styleName?: string;  // e.g. "JP"
    }

}

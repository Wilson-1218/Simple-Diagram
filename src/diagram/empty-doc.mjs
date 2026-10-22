/** Empty Simple Diagram document (formatVersion 1). */

export const CURRENT_FORMAT_VERSION = 1;
export const APP_VERSION = "13.5.26";

export const DEFAULT_LAYERS = {
  gridShow: true,
  gridLock: false,
  coordsShow: true,
  coordsLock: false,
  helpersShow: true,
  /** Marks/labels layer defaults locked: follow geometry until unlocked. */
  helpersLock: true,
};

/**
 * @param {Record<string, unknown>} [overrides]
 */
export function emptyDiagram(overrides = {}) {
  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    version: APP_VERSION,
    app: "simple-diagram",
    points: [],
    segments: [],
    labels: [],
    rightAngles: [],
    angleArcs: [],
    midTicks: [],
    parallelMarks: [],
    equalMarks: [],
    lengthLabels: [],
    circles: [],
    ellipses: [],
    sectors: [],
    fills: [],
    coordPlots: [],
    exportCrop: null,
    sectorMode: "arc",
    fillMode: "polygon",
    shapeMode: "square",
    circlePartMode: "chord",
    layers: { ...DEFAULT_LAYERS },
    nextLetter: "A",
    labelFontSize: 16,
    rightAngleSize: 10,
    activeParallelGroup: 0,
    activeEqualGroup: 0,
    activeArcGroup: 0,
    gridSnap: true,
    gridMode: "triangle",
    hideExportPoints: true,
    view: { x: 400, y: 300, scale: 2 },
    name: "simple-diagram.json",
    ...structuredClone(overrides),
  };
}

/** Deep clone a plain JSON-compatible document. */
export function cloneDoc(doc) {
  return structuredClone(doc);
}

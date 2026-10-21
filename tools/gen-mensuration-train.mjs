#!/usr/bin/env node
/**
 * Generate examples/train cases from Mensuration-clean.pdf picks (seed 20261021).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyOps,
  validateDiagram,
  summarizeDiagram,
  documentToSvg,
} from "../src/diagram/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trainDir = join(root, "examples/train");
const SEED = 20261021;
const PDF = "Mensuration-clean.pdf";

/** @type {Array<{nn:string, slug:string, id:string, part:string, q:number, page:number, title:string, promptZh:string, promptEn:string, ops:object[]}>} */
const CASES = [
  {
    nn: "01",
    slug: "tri-ade-abc-ratio",
    id: "A1",
    part: "A",
    q: 1,
    page: 1,
    title: "△ADE / △ABC with AD:DB and BE:EC",
    promptZh:
      "依圖畫直角三角形 ABC（直角在 B）。D 在 AB 上且 AD:DB = 3:1；E 在 BC 上且 BE:EC = 2:3。連 AE、DE，標 A–E。（計算面積可略；圖形意圖為主。）",
    promptEn:
      "Draw right △ABC (right angle at B). D on AB with AD:DB = 3:1; E on BC with BE:EC = 2:3. Join AE and DE; label A–E. (Area calc optional; diagram intent first.)",
    ops: (() => {
      const B = { x: 80, y: 260 };
      const A = { x: 80, y: 60 };
      const C = { x: 340, y: 260 };
      // AD:DB=3:1 → D divides AB with AD=3/4 of AB from A toward B
      const D = {
        x: A.x + (3 / 4) * (B.x - A.x),
        y: A.y + (3 / 4) * (B.y - A.y),
      };
      // BE:EC=2:3 → E is 2/5 along BC
      const E = {
        x: B.x + (2 / 5) * (C.x - B.x),
        y: B.y + (2 / 5) * (C.y - B.y),
      };
      return [
        { op: "addPoint", id: "A", ...A },
        { op: "addPoint", id: "B", ...B },
        { op: "addPoint", id: "C", ...C },
        { op: "addPoint", id: "D", ...D },
        { op: "addPoint", id: "E", ...E },
        { op: "addSegment", id: "AB", a: "A", b: "B" },
        { op: "addSegment", id: "BC", a: "B", b: "C" },
        { op: "addSegment", id: "CA", a: "C", b: "A" },
        { op: "addSegment", id: "AE", a: "A", b: "E" },
        { op: "addSegment", id: "DE", a: "D", b: "E" },
        { op: "addRightAngle", vertex: "B", arm1: "A", arm2: "C" },
        { op: "addLabel", pointId: "A", text: "A", ox: 0, oy: -16 },
        { op: "addLabel", pointId: "B", text: "B", ox: -16, oy: 12 },
        { op: "addLabel", pointId: "C", text: "C", ox: 14, oy: 12 },
        { op: "addLabel", pointId: "D", text: "D", ox: -16, oy: 0 },
        { op: "addLabel", pointId: "E", text: "E", ox: 0, oy: 16 },
        { op: "setMeta", name: "01-tri-ade-abc-ratio", hideExportPoints: true },
      ];
    })(),
  },
  {
    nn: "02",
    slug: "parallelogram-be-fc",
    id: "A4",
    part: "A",
    q: 4,
    page: 2,
    title: "Parallelogram ABCD, BE∩FC=G",
    promptZh:
      "畫平行四邊形 ABCD。E 在 DC 上 DE:EC = 4:3；F 在 AB 上 AF:FB = 2:5。連 BE、FC，交點標 G。",
    promptEn:
      "Draw parallelogram ABCD. E on DC with DE:EC = 4:3; F on AB with AF:FB = 2:5. Draw BE and FC; label their intersection G.",
    ops: (() => {
      const A = { x: 80, y: 260 };
      const B = { x: 340, y: 260 };
      const D = { x: 140, y: 100 };
      const C = { x: B.x + (D.x - A.x), y: B.y + (D.y - A.y) }; // = (400,100)
      const E = {
        x: D.x + (4 / 7) * (C.x - D.x),
        y: D.y + (4 / 7) * (C.y - D.y),
      };
      const F = {
        x: A.x + (2 / 7) * (B.x - A.x),
        y: A.y + (2 / 7) * (B.y - A.y),
      };
      // G = intersection BE ∩ FC
      const G = lineIntersect(B, E, F, C);
      return [
        { op: "addPoint", id: "A", ...A },
        { op: "addPoint", id: "B", ...B },
        { op: "addPoint", id: "C", ...C },
        { op: "addPoint", id: "D", ...D },
        { op: "addPoint", id: "E", ...E },
        { op: "addPoint", id: "F", ...F },
        { op: "addPoint", id: "G", ...G },
        { op: "addSegment", id: "AB", a: "A", b: "B" },
        { op: "addSegment", id: "BC", a: "B", b: "C" },
        { op: "addSegment", id: "CD", a: "C", b: "D" },
        { op: "addSegment", id: "DA", a: "D", b: "A" },
        { op: "addSegment", id: "BE", a: "B", b: "E" },
        { op: "addSegment", id: "FC", a: "F", b: "C" },
        { op: "addParallelMark", segmentId: "AB", group: 0 },
        { op: "addParallelMark", segmentId: "CD", group: 0 },
        { op: "addParallelMark", segmentId: "DA", group: 1 },
        { op: "addParallelMark", segmentId: "BC", group: 1 },
        { op: "addLabel", pointId: "A", text: "A", ox: -12, oy: 14 },
        { op: "addLabel", pointId: "B", text: "B", ox: 14, oy: 14 },
        { op: "addLabel", pointId: "C", text: "C", ox: 14, oy: -12 },
        { op: "addLabel", pointId: "D", text: "D", ox: -12, oy: -12 },
        { op: "addLabel", pointId: "E", text: "E", ox: 0, oy: -16 },
        { op: "addLabel", pointId: "F", text: "F", ox: 0, oy: 16 },
        { op: "addLabel", pointId: "G", text: "G", ox: -14, oy: -10 },
        { op: "setMeta", name: "02-parallelogram-be-fc", hideExportPoints: true },
      ];
    })(),
  },
  {
    nn: "03",
    slug: "parallelogram-abhg-lines",
    id: "A6",
    part: "A",
    q: 6,
    page: 2,
    title: "Parallelogram ABHG with collinear lines",
    promptZh:
      "畫平行四邊形 ABHG。ABC、CDEF、FGH 為直線；AB:BC = 1:3，FG:GH = 3:4。標 A–H（長度 DE 計算可略）。",
    promptEn:
      "Draw parallelogram ABHG. Keep ABC, CDEF, and FGH collinear; AB:BC = 1:3, FG:GH = 3:4. Label A–H (DE length calc optional).",
    ops: (() => {
      // ABHG parallelogram: A bottom-left, B top-left-ish, H top-right, G bottom-right
      const A = { x: 80, y: 220 };
      const B = { x: 120, y: 100 };
      const H = { x: 320, y: 100 };
      const G = { x: A.x + (H.x - B.x), y: A.y + (H.y - B.y) }; // (280,220)
      // C on AB extended: AB:BC=1:3 → BC = 3 AB, C beyond B from A... wait ABC straight with AB:BC=1:3 means B between A and C
      const C = {
        x: B.x + 3 * (B.x - A.x),
        y: B.y + 3 * (B.y - A.y),
      }; // extend past B
      // Actually if ABC is straight and B between A and C: C = A + (1+3)*(B-A)/1 = A + 4*(B-A)
      const C2 = {
        x: A.x + 4 * (B.x - A.x),
        y: A.y + 4 * (B.y - A.y),
      };
      // FGH straight, G between F and H? FG:GH=3:4. Text: FG:GH=3:4, FGH straight.
      // Typically F-G-H with FG:GH=3:4, or F beyond G. Figure has F below, G, H — F-G-H with G between F and H.
      // G divides FH with FG:GH=3:4 → G = F + 3/7 (H-F). Solve F from G,H:
      // G = F + (3/7)(H-F) → 7G = 7F + 3H - 3F → 4F = 7G - 3H → F = (7G-3H)/4
      const F = {
        x: (7 * G.x - 3 * H.x) / 4,
        y: (7 * G.y - 3 * H.y) / 4,
      };
      // CDEF collinear — place D,E on CF between C and F
      const D = {
        x: C2.x + 0.35 * (F.x - C2.x),
        y: C2.y + 0.35 * (F.y - C2.y),
      };
      const E = {
        x: C2.x + 0.55 * (F.x - C2.x),
        y: C2.y + 0.55 * (F.y - C2.y),
      };
      // Also need A-E-G? Looking at figure: AEG may be a line. Check if E on AG.
      // Force E = intersection of CF with AG for cleaner figure matching "AEG"
      const E2 = lineIntersect(C2, F, A, G);
      const D2 = {
        x: C2.x + 0.4 * (E2.x - C2.x),
        y: C2.y + 0.4 * (E2.y - C2.y),
      };
      return [
        { op: "addPoint", id: "A", ...A },
        { op: "addPoint", id: "B", ...B },
        { op: "addPoint", id: "C", ...C2 },
        { op: "addPoint", id: "D", ...D2 },
        { op: "addPoint", id: "E", ...E2 },
        { op: "addPoint", id: "F", ...F },
        { op: "addPoint", id: "G", ...G },
        { op: "addPoint", id: "H", ...H },
        { op: "addSegment", id: "AB", a: "A", b: "B" },
        { op: "addSegment", id: "BC", a: "B", b: "C" },
        { op: "addSegment", id: "BH", a: "B", b: "H" },
        { op: "addSegment", id: "AG", a: "A", b: "G" },
        { op: "addSegment", id: "CF", a: "C", b: "F" },
        { op: "addSegment", id: "FH", a: "F", b: "H" },
        { op: "addSegment", id: "GH", a: "G", b: "H" },
        { op: "addParallelMark", segmentId: "AB", group: 0 },
        { op: "addParallelMark", segmentId: "GH", group: 0 },
        { op: "addLabel", pointId: "A", text: "A", ox: -14, oy: 12 },
        { op: "addLabel", pointId: "B", text: "B", ox: -14, oy: -8 },
        { op: "addLabel", pointId: "C", text: "C", ox: 0, oy: -16 },
        { op: "addLabel", pointId: "D", text: "D", ox: 12, oy: -8 },
        { op: "addLabel", pointId: "E", text: "E", ox: -14, oy: 4 },
        { op: "addLabel", pointId: "F", text: "F", ox: 0, oy: 16 },
        { op: "addLabel", pointId: "G", text: "G", ox: 14, oy: 12 },
        { op: "addLabel", pointId: "H", text: "H", ox: 14, oy: -8 },
        { op: "setMeta", name: "03-parallelogram-abhg-lines", hideExportPoints: true },
      ];
    })(),
  },
  {
    nn: "04",
    slug: "tri-abc-bdef-ratios",
    id: "A7",
    part: "A",
    q: 7,
    page: 3,
    title: "△ABC with AE=EC, ratios",
    promptZh:
      "畫 △ABC。E 為 AC 中點（AE=EC，加等長記號）；D 在 AB 上 AD:DB = 1:3；F 在 BC 上 BF:FC = 3:5。連 DE、BE、EF。",
    promptEn:
      "Draw △ABC. E midpoint of AC (equal marks); D on AB with AD:DB = 1:3; F on BC with BF:FC = 3:5. Join DE, BE, EF.",
    ops: (() => {
      const A = { x: 220, y: 60 };
      const B = { x: 80, y: 280 };
      const C = { x: 380, y: 280 };
      const E = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };
      const D = {
        x: A.x + (1 / 4) * (B.x - A.x),
        y: A.y + (1 / 4) * (B.y - A.y),
      };
      const F = {
        x: B.x + (3 / 8) * (C.x - B.x),
        y: B.y + (3 / 8) * (C.y - B.y),
      };
      return [
        { op: "addPoint", id: "A", ...A },
        { op: "addPoint", id: "B", ...B },
        { op: "addPoint", id: "C", ...C },
        { op: "addPoint", id: "D", ...D },
        { op: "addPoint", id: "E", ...E },
        { op: "addPoint", id: "F", ...F },
        { op: "addSegment", id: "AB", a: "A", b: "B" },
        { op: "addSegment", id: "BC", a: "B", b: "C" },
        { op: "addSegment", id: "CA", a: "C", b: "A" },
        { op: "addSegment", id: "AE", a: "A", b: "E" },
        { op: "addSegment", id: "EC", a: "E", b: "C" },
        { op: "addSegment", id: "DE", a: "D", b: "E" },
        { op: "addSegment", id: "BE", a: "B", b: "E" },
        { op: "addSegment", id: "EF", a: "E", b: "F" },
        { op: "addEqualMark", segmentId: "AE", group: 0 },
        { op: "addEqualMark", segmentId: "EC", group: 0 },
        { op: "addLabel", pointId: "A", text: "A", ox: 0, oy: -16 },
        { op: "addLabel", pointId: "B", text: "B", ox: -14, oy: 14 },
        { op: "addLabel", pointId: "C", text: "C", ox: 14, oy: 14 },
        { op: "addLabel", pointId: "D", text: "D", ox: -16, oy: 0 },
        { op: "addLabel", pointId: "E", text: "E", ox: 14, oy: -8 },
        { op: "addLabel", pointId: "F", text: "F", ox: 0, oy: 16 },
        { op: "setMeta", name: "04-tri-abc-bdef-ratios", hideExportPoints: true },
      ];
    })(),
  },
  {
    nn: "05",
    slug: "parallelogram-bef-edf",
    id: "A8",
    part: "A",
    q: 8,
    page: 3,
    title: "Parallelogram ABCD, △BEF & △EDF",
    promptZh:
      "畫平行四邊形 ABCD。E 在 AB 上且 AE=EB（等長記號）；F 在 BC 上 BF:FC = 2:3。連 EF、ED、DF。",
    promptEn:
      "Draw parallelogram ABCD. E midpoint of AB (equal marks); F on BC with BF:FC = 2:3. Join EF, ED, DF.",
    ops: (() => {
      const A = { x: 140, y: 80 };
      const D = { x: 320, y: 80 };
      const B = { x: 80, y: 260 };
      const C = { x: B.x + (D.x - A.x), y: B.y + (D.y - A.y) };
      const E = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      const F = {
        x: B.x + (2 / 5) * (C.x - B.x),
        y: B.y + (2 / 5) * (C.y - B.y),
      };
      return [
        { op: "addPoint", id: "A", ...A },
        { op: "addPoint", id: "B", ...B },
        { op: "addPoint", id: "C", ...C },
        { op: "addPoint", id: "D", ...D },
        { op: "addPoint", id: "E", ...E },
        { op: "addPoint", id: "F", ...F },
        { op: "addSegment", id: "AB", a: "A", b: "B" },
        { op: "addSegment", id: "BC", a: "B", b: "C" },
        { op: "addSegment", id: "CD", a: "C", b: "D" },
        { op: "addSegment", id: "DA", a: "D", b: "A" },
        { op: "addSegment", id: "AE", a: "A", b: "E" },
        { op: "addSegment", id: "EB", a: "E", b: "B" },
        { op: "addSegment", id: "EF", a: "E", b: "F" },
        { op: "addSegment", id: "ED", a: "E", b: "D" },
        { op: "addSegment", id: "DF", a: "D", b: "F" },
        { op: "addEqualMark", segmentId: "AE", group: 0 },
        { op: "addEqualMark", segmentId: "EB", group: 0 },
        { op: "addParallelMark", segmentId: "DA", group: 0 },
        { op: "addParallelMark", segmentId: "BC", group: 0 },
        { op: "addLabel", pointId: "A", text: "A", ox: -10, oy: -14 },
        { op: "addLabel", pointId: "B", text: "B", ox: -14, oy: 14 },
        { op: "addLabel", pointId: "C", text: "C", ox: 14, oy: 14 },
        { op: "addLabel", pointId: "D", text: "D", ox: 10, oy: -14 },
        { op: "addLabel", pointId: "E", text: "E", ox: -16, oy: 0 },
        { op: "addLabel", pointId: "F", text: "F", ox: 0, oy: 16 },
        { op: "setMeta", name: "05-parallelogram-bef-edf", hideExportPoints: true },
      ];
    })(),
  },
  {
    nn: "06",
    slug: "sector-aob-shaded",
    id: "B1",
    part: "B",
    q: 1,
    page: 4,
    title: "Sector AOB shaded segment",
    promptZh:
      "畫扇形 AOB（圓心 O，半徑 9，∠AOB = 140°）。連弦 AB，並將弓形（弦 AB 與弧 AB 之間）淺填。標 O、A、B、半徑與角度。",
    promptEn:
      "Draw sector AOB (centre O, radius 9, angle AOB = 140°). Add chord AB and shade the segment between chord AB and arc AB. Label O, A, B, radius and angle.",
    ops: (() => {
      const O = { x: 220, y: 280 };
      const r = 140;
      const ang = (140 * Math.PI) / 180;
      const a0 = -Math.PI / 2 - ang / 2;
      const a1 = -Math.PI / 2 + ang / 2;
      const A = { x: O.x + r * Math.cos(a0), y: O.y + r * Math.sin(a0) };
      const B = { x: O.x + r * Math.cos(a1), y: O.y + r * Math.sin(a1) };
      return [
        { op: "addPoint", id: "O", ...O },
        { op: "addPoint", id: "A", ...A },
        { op: "addPoint", id: "B", ...B },
        { op: "addCircle", id: "c1", centerId: "O", throughId: "A" },
        { op: "addSegment", id: "OA", a: "O", b: "A" },
        { op: "addSegment", id: "OB", a: "O", b: "B" },
        { op: "addSegment", id: "AB", a: "A", b: "B" },
        { op: "addSector", id: "sec1", centerId: "O", startId: "A", endId: "B", mode: "arc" },
        {
          op: "addFill",
          kind: "segment",
          circleId: "c1",
          centerId: "O",
          startId: "A",
          endId: "B",
          opacity: 0.22,
        },
        { op: "addAngleArc", vertex: "O", arm1: "A", arm2: "B", text: "140°", size: 28 },
        { op: "addLengthLabel", segmentId: "OA", text: "9" },
        { op: "addLabel", pointId: "O", text: "O", ox: 0, oy: 18 },
        { op: "addLabel", pointId: "A", text: "A", ox: -16, oy: -8 },
        { op: "addLabel", pointId: "B", text: "B", ox: 16, oy: -8 },
        { op: "setMeta", name: "06-sector-aob-shaded", hideExportPoints: true },
      ];
    })(),
  },
  {
    nn: "07",
    slug: "square-sector-centre-b",
    id: "B3",
    part: "B",
    q: 3,
    page: 4,
    title: "Square ABCD + sector centre B",
    promptZh:
      "畫正方形 ABCD（邊長 8；A 左上、B 左下、C 右下、D 右上）。以 B 為圓心畫弧 AC；連對角線 BD，與弧交於 E。將由 E–D–C 與弧 CE 圍成的區域淺填。加直角記號。",
    promptEn:
      "Draw square ABCD (side 8; A top-left, B bottom-left, C bottom-right, D top-right). Arc AC centred at B; diagonal BD meets the arc at E. Shade region E–D–C–arc. Mark right angles.",
    ops: (() => {
      const s = 160;
      const B = { x: 100, y: 280 };
      const C = { x: B.x + s, y: B.y };
      const A = { x: B.x, y: B.y - s };
      const D = { x: B.x + s, y: B.y - s };
      // E = BD ∩ circle centre B radius BA. BD direction (1,-1); |BE|=s
      const E = {
        x: B.x + s / Math.SQRT2,
        y: B.y - s / Math.SQRT2,
      };
      return [
        { op: "addPoint", id: "A", ...A },
        { op: "addPoint", id: "B", ...B },
        { op: "addPoint", id: "C", ...C },
        { op: "addPoint", id: "D", ...D },
        { op: "addPoint", id: "E", ...E },
        { op: "addSegment", id: "AB", a: "A", b: "B" },
        { op: "addSegment", id: "BC", a: "B", b: "C" },
        { op: "addSegment", id: "CD", a: "C", b: "D" },
        { op: "addSegment", id: "DA", a: "D", b: "A" },
        { op: "addSegment", id: "BD", a: "B", b: "D" },
        { op: "addCircle", id: "cB", centerId: "B", throughId: "A" },
        { op: "addSector", id: "arcAC", centerId: "B", startId: "A", endId: "C", mode: "arc" },
        {
          op: "addFill",
          kind: "segment",
          circleId: "cB",
          centerId: "B",
          startId: "E",
          endId: "C",
          opacity: 0.2,
        },
        { op: "addRightAngle", vertex: "A", arm1: "B", arm2: "D" },
        { op: "addRightAngle", vertex: "B", arm1: "A", arm2: "C" },
        { op: "addRightAngle", vertex: "C", arm1: "B", arm2: "D" },
        { op: "addRightAngle", vertex: "D", arm1: "A", arm2: "C" },
        { op: "addLengthLabel", segmentId: "CD", text: "8" },
        { op: "addLabel", pointId: "A", text: "A", ox: -14, oy: -10 },
        { op: "addLabel", pointId: "B", text: "B", ox: -14, oy: 14 },
        { op: "addLabel", pointId: "C", text: "C", ox: 14, oy: 14 },
        { op: "addLabel", pointId: "D", text: "D", ox: 14, oy: -10 },
        { op: "addLabel", pointId: "E", text: "E", ox: 12, oy: -12 },
        { op: "setMeta", name: "07-square-sector-centre-b", hideExportPoints: true },
      ];
    })(),
  },
  {
    nn: "08",
    slug: "two-sectors-perpendicular",
    id: "B6",
    part: "B",
    q: 6,
    page: 5,
    title: "Identical sectors OAB & BOC, right angles",
    promptZh:
      "畫正方形 OACB（O 左下、B 右下、C 右上、A 左上）。以 O 為圓心畫四分圓弧 AB；以 B 為圓心畫四分圓弧 CO。在 O、B 加直角記號；將靠近頂邊的兩塊「扇外」區域淺填。",
    promptEn:
      "Draw square OACB (O bottom-left, B bottom-right, C top-right, A top-left). Quarter-arc AB centred at O; quarter-arc CO centred at B. Right-angle marks at O and B; shade the two outer corner regions near the top.",
    ops: (() => {
      const s = 180;
      const O = { x: 100, y: 280 };
      const B = { x: O.x + s, y: O.y };
      const A = { x: O.x, y: O.y - s };
      const C = { x: O.x + s, y: O.y - s };
      return [
        { op: "addPoint", id: "O", ...O },
        { op: "addPoint", id: "A", ...A },
        { op: "addPoint", id: "C", ...C },
        { op: "addPoint", id: "B", ...B },
        { op: "addSegment", id: "OA", a: "O", b: "A" },
        { op: "addSegment", id: "AC", a: "A", b: "C" },
        { op: "addSegment", id: "CB", a: "C", b: "B" },
        { op: "addSegment", id: "BO", a: "B", b: "O" },
        { op: "addCircle", id: "cO", centerId: "O", throughId: "A" },
        { op: "addCircle", id: "cB", centerId: "B", throughId: "C" },
        { op: "addSector", id: "arcAB", centerId: "O", startId: "A", endId: "B", mode: "arc" },
        { op: "addSector", id: "arcCO", centerId: "B", startId: "C", endId: "O", mode: "arc" },
        {
          op: "addFill",
          kind: "segment",
          circleId: "cO",
          centerId: "O",
          startId: "A",
          endId: "B",
          opacity: 0.18,
        },
        {
          op: "addFill",
          kind: "segment",
          circleId: "cB",
          centerId: "B",
          startId: "C",
          endId: "O",
          opacity: 0.18,
        },
        { op: "addRightAngle", vertex: "O", arm1: "A", arm2: "B" },
        { op: "addRightAngle", vertex: "B", arm1: "C", arm2: "O" },
        { op: "addLabel", pointId: "O", text: "O", ox: -14, oy: 14 },
        { op: "addLabel", pointId: "A", text: "A", ox: -14, oy: -12 },
        { op: "addLabel", pointId: "C", text: "C", ox: 14, oy: -12 },
        { op: "addLabel", pointId: "B", text: "B", ox: 14, oy: 14 },
        { op: "setMeta", name: "08-two-sectors-perpendicular", hideExportPoints: true },
      ];
    })(),
  },
  {
    nn: "09",
    slug: "semicircle-acb-shaded",
    id: "B8",
    part: "B",
    q: 8,
    page: 6,
    title: "Semicircle ACB diameter 12, AC=6",
    promptZh:
      "畫半圓 ACB，直徑 AB = 12（中點 O），C 在弧上且 AC = 6。連 AC、OC。將半圓區域淺填（或依考題陰影意圖）。標 A、B、C、O。",
    promptEn:
      "Draw semicircle ACB with diameter AB = 12 (midpoint O); C on the arc with AC = 6. Join AC and OC. Shade the semicircle region. Label A, B, C, O.",
    ops: (() => {
      const O = { x: 220, y: 260 };
      const r = 120; // 12 cm → 120 px
      const A = { x: O.x - r, y: O.y };
      const B = { x: O.x + r, y: O.y };
      // AC=6 → half radius; C on upper semicircle: angle from OA
      // Place C so AC=r/2. Chord length 2 r sin(θ/2)=r/2 → sin(θ/2)=1/4 → θ/2=arcsin(0.25)
      const theta = 2 * Math.asin(0.25);
      const C = {
        x: O.x + r * Math.cos(Math.PI - theta),
        y: O.y - r * Math.sin(Math.PI - theta),
      };
      return [
        { op: "addPoint", id: "A", ...A },
        { op: "addPoint", id: "O", ...O },
        { op: "addPoint", id: "B", ...B },
        { op: "addPoint", id: "C", ...C },
        { op: "addSegment", id: "AB", a: "A", b: "B" },
        { op: "addSegment", id: "AC", a: "A", b: "C" },
        { op: "addSegment", id: "OC", a: "O", b: "C" },
        { op: "addCircle", id: "c1", centerId: "O", throughId: "A" },
        { op: "addSector", id: "semi", centerId: "O", startId: "A", endId: "B", mode: "arc" },
        {
          op: "addFill",
          kind: "sector",
          circleId: "c1",
          centerId: "O",
          startId: "A",
          endId: "B",
          opacity: 0.16,
        },
        { op: "addLengthLabel", segmentId: "AB", text: "12" },
        { op: "addLengthLabel", segmentId: "AC", text: "6" },
        { op: "addLabel", pointId: "A", text: "A", ox: -14, oy: 14 },
        { op: "addLabel", pointId: "B", text: "B", ox: 14, oy: 14 },
        { op: "addLabel", pointId: "O", text: "O", ox: 0, oy: 16 },
        { op: "addLabel", pointId: "C", text: "C", ox: 0, oy: -16 },
        { op: "setMeta", name: "09-semicircle-acb-shaded", hideExportPoints: true },
      ];
    })(),
  },
  {
    nn: "10",
    slug: "square-shaded-perimeter",
    id: "B9",
    part: "B",
    q: 9,
    page: 6,
    title: "Square ABCD shaded perimeter 15",
    promptZh:
      "畫正方形 ABCD（A 左上、B 右上、C 右下、D 左下）。以 D 為圓心畫四分圓弧 AC；以 C 為圓心畫四分圓弧 BD。兩弧交於 X；連 DX、CX。將兩弓形（DX 與弧、CX 與弧）淺填。加直角記號於 D。",
    promptEn:
      "Draw square ABCD (A top-left … D bottom-left). Quarter-arc AC centred at D; quarter-arc BD centred at C; intersection X; join DX, CX. Shade the two circular segments. Right-angle mark at D.",
    ops: (() => {
      const s = 180;
      const D = { x: 100, y: 280 };
      const C = { x: D.x + s, y: D.y };
      const A = { x: D.x, y: D.y - s };
      const B = { x: D.x + s, y: D.y - s };
      // X: intersection of circles centre D radius s and centre C radius s → equilateral → 60°
      const X = {
        x: D.x + s * 0.5,
        y: D.y - s * Math.sqrt(3) / 2,
      };
      return [
        { op: "addPoint", id: "A", ...A },
        { op: "addPoint", id: "B", ...B },
        { op: "addPoint", id: "C", ...C },
        { op: "addPoint", id: "D", ...D },
        { op: "addPoint", id: "X", ...X },
        { op: "addSegment", id: "AB", a: "A", b: "B" },
        { op: "addSegment", id: "BC", a: "B", b: "C" },
        { op: "addSegment", id: "CD", a: "C", b: "D" },
        { op: "addSegment", id: "DA", a: "D", b: "A" },
        { op: "addSegment", id: "DX", a: "D", b: "X" },
        { op: "addSegment", id: "CX", a: "C", b: "X" },
        { op: "addCircle", id: "cD", centerId: "D", throughId: "A" },
        { op: "addCircle", id: "cC", centerId: "C", throughId: "B" },
        { op: "addSector", id: "arcAC", centerId: "D", startId: "A", endId: "C", mode: "arc" },
        { op: "addSector", id: "arcBD", centerId: "C", startId: "B", endId: "D", mode: "arc" },
        {
          op: "addFill",
          kind: "segment",
          circleId: "cC",
          centerId: "C",
          startId: "D",
          endId: "X",
          opacity: 0.22,
        },
        {
          op: "addFill",
          kind: "segment",
          circleId: "cD",
          centerId: "D",
          startId: "C",
          endId: "X",
          opacity: 0.22,
        },
        { op: "addRightAngle", vertex: "D", arm1: "A", arm2: "C" },
        { op: "addLabel", pointId: "A", text: "A", ox: -12, oy: -12 },
        { op: "addLabel", pointId: "B", text: "B", ox: 12, oy: -12 },
        { op: "addLabel", pointId: "C", text: "C", ox: 14, oy: 14 },
        { op: "addLabel", pointId: "D", text: "D", ox: -14, oy: 14 },
        { op: "addLabel", pointId: "X", text: "X", ox: 0, oy: -16 },
        { op: "setMeta", name: "10-square-shaded-perimeter", hideExportPoints: true },
      ];
    })(),
  },
];

function lineIntersect(p1, p2, p3, p4) {
  const a1 = p2.y - p1.y;
  const b1 = p1.x - p2.x;
  const c1 = a1 * p1.x + b1 * p1.y;
  const a2 = p4.y - p3.y;
  const b2 = p3.x - p4.x;
  const c2 = a2 * p3.x + b2 * p3.y;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-9) throw new Error("parallel lines");
  return { x: (b2 * c1 - b1 * c2) / det, y: (a1 * c2 - a2 * c1) / det };
}

mkdirSync(trainDir, { recursive: true });
const indexCases = [];

for (const c of CASES) {
  const dir = join(trainDir, `${c.nn}-${c.slug}`);
  mkdirSync(dir, { recursive: true });
  const meta = {
    sourcePdf: PDF,
    seed: SEED,
    part: c.part,
    question: c.q,
    page: c.page,
    id: c.id,
    slug: c.slug,
    title: c.title,
  };
  const prompt = `# ${c.nn} · ${c.title}

**Source:** \`${PDF}\` · Part ${c.part} Q${c.q} · page ${c.page} · pick seed \`${SEED}\`

## ZH
${c.promptZh}

## EN
${c.promptEn}

## Hints
Reconstruct with Simple Diagram ops (\`addPoint\` / \`addSegment\` / marks / \`addSector\` / fills). Prefer solid edges; use dashed only for hidden edges if any. Skip pure numerical answers — diagram fidelity first.
`;
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  writeFileSync(join(dir, "prompt.md"), prompt);
  writeFileSync(join(dir, "ops.json"), JSON.stringify(c.ops, null, 2) + "\n");

  const doc = applyOps(null, c.ops);
  const v = validateDiagram(doc);
  if (!v.ok) {
    console.error(`FAIL ${c.nn}:`, v.errors);
    process.exit(1);
  }
  const sum = summarizeDiagram(doc);
  const svg = documentToSvg(doc, { scale: 2 });
  writeFileSync(join(dir, "golden.json"), JSON.stringify(doc, null, 2) + "\n");
  writeFileSync(join(dir, "summary.json"), JSON.stringify(sum, null, 2) + "\n");
  writeFileSync(join(dir, "target.svg"), svg);
  indexCases.push(`${c.nn}-${c.slug}`);
  console.log(`ok ${c.nn}-${c.slug} pts=${doc.points.length}`);
}

writeFileSync(
  join(trainDir, "index.json"),
  JSON.stringify(
    {
      version: "1",
      seed: SEED,
      sourcePdf: PDF,
      description: "Mensuration exam AI train pack (10 random diagram-worthy items)",
      cases: indexCases,
    },
    null,
    2
  ) + "\n"
);
console.log("Wrote", indexCases.length, "cases");

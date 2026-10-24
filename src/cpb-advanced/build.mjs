// Builds ../../cpb-advanced.html with the anatomy skill's kit (github.com/wheresryan22/anatomy, MIT).
// Clone it to src/anatomy, or point ANATOMY_DIR at a copy, then: node src/cpb-advanced/build.mjs [--audit]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, process.env.ANATOMY_DIR ?? "../anatomy");
const kit = (path) => import(pathToFileURL(join(KIT, path)).href);
const k = await kit("kit/iso-kit.mjs");
const G = await kit("kit/lathe.mjs");
const { tubePieces, tubeSvg } = await kit("kit/tube.mjs");
const A = await kit("kit/audit.mjs");
const { kitScript } = await kit("scripts/inline-kit.mjs");
// light is the default; the page follows the reader's system theme on load
const THEME = process.argv.includes("--dark") ? "dark" : "light";
const DEG = Math.PI / 180;

const W = 960;
const H = 860;
const AZIMUTH = 52;
const ELEVATION = 28;

// ---------- world layout ----------
const PLATE = { x: -254, y: -84, w: 520, d: 156, r: 10 };
const PLATE_H = 12;
const FOOT_H = 6;
const CAB = { x: -236, y: -62, w: 326, d: 104, r: 6 };
const CAB_Z0 = 28;
const CAB_Z1 = 80;
const DECK_Z = 83;
const MOD_Z1 = 105;
const RACE_H = 12;
const RACE_Z1 = MOD_Z1 + RACE_H;

// Four roller pumps in a row, raceways open to +x. Boots enter and leave through that opening:
// "in" is the leg blood arrives by, so the rollers turn from it, round the far side, to the other leg.
// The cardioplegia head carries two boots, one above the other: 1/4 inch blood under 1/8 inch crystalloid.
const ROW_Y = -13.4;
const SMALL = { s: 46, rin: 15, tube: 1.6, roller: 3, hub: 4.2 };
const PUMPS = {
  sucker: { ...SMALL, c: [-207, ROW_Y], label: "SUCKER", inLeg: "front", stroke: M.SMALL_STROKE_ML },
  rootvent: { ...SMALL, c: [-143, ROW_Y], label: "ROOT VENT", inLeg: "front", stroke: M.SMALL_STROKE_ML },
  vent: { ...SMALL, c: [-79, ROW_Y], label: "LV VENT", inLeg: "front", stroke: M.SMALL_STROKE_ML },
  cardio: { ...SMALL, c: [-15, ROW_Y], label: "BLOOD CP 4:1", inLeg: "back", stroke: M.CP_STROKE_ML },
};
for (const pump of Object.values(PUMPS)) {
  pump.tc = pump.rin - pump.tube; // tube centreline radius
  pump.rc = pump.tc - pump.tube - pump.roller; // the roller presses the tube shut against the raceway
  pump.tz = MOD_Z1 + pump.tube + 0.4; // tube centre on the raceway floor
  pump.x1 = pump.c[0] + pump.s / 2;
  pump.riser = pump.x1 + 8; // where its tubes turn up, in the gap beside it
  pump.front = pump.c[1] + pump.tc;
  pump.back = pump.c[1] - pump.tc;
  pump.dir = pump.inLeg === "front" ? 1 : -1; // + turns the rotor counter-clockwise seen from above
}
const CP = PUMPS.cardio;
// the two cardioplegia boots: the crystalloid rides above the blood and turns up first
const CP_TUBES = {
  blood: { r: 1.6, tz: CP.tz, riser: CP.x1 + 14 },
  crystal: { r: 0.8, tz: CP.tz + 3.8, riser: CP.x1 + 8 },
};
const LANE_Y = PUMPS.sucker.front; // the table lines run in this plane, straight down onto the pumps' front legs
const RETURN_Y = PUMPS.sucker.back; // vented and sucked blood goes back to the reservoir along this plane, behind the pumps

// the centrifugal arterial pump: its drive and console stand on the deck under the reservoir
const DRIVE = { c: [46, -14], s: 40 };
const MAST = [80, -42];
const MAST_R = 4.5;
const MAST_TOP = 286;
const UP = [0, 0, 1];
const VERT = (x, y) => G.frameOf([x, y, 0], UP, [1, 0, 0], [0, 1, 0]);

// the cannulation-site panel: one port per site, each with an engraved plate; top lanes reach the farthest pumps
const PANEL = { x: 170, y: -2, w: 88, d: 4, r: 1.2 };
const PANEL_Z0 = 226;
const PANEL_Z1 = 336;
const SITES = {
  field: { z: 318, zh: "心包腔", en: "Pericardial field" },
  rootvent: { z: 306, zh: "主動脈根部 · 減壓", en: "Aortic root vent" },
  vent: { z: 294, zh: "右上肺靜脈 → 左心室", en: "RSPV → LV vent" },
  root: { z: 282, zh: "主動脈根部 · 順行", en: "Aortic root, antegrade" },
  cs: { z: 270, zh: "冠狀竇 · 逆行", en: "Coronary sinus, retrograde" },
  svc: { z: 258, zh: "上腔靜脈", en: "Superior vena cava" },
  ivc: { z: 246, zh: "下腔靜脈", en: "Inferior vena cava" },
  aorta: { z: 234, zh: "升主動脈", en: "Ascending aorta" },
};

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [MAST[0], MAST[1], MAST_TOP + 6], [PANEL.x, 0, PANEL_Z1 + 2], [PANEL.x + PANEL.w, 0, PANEL_Z1 + 2], [PUMPS.sucker.riser, 0, SITES.field.z + 8]],
  W,
  H,
  { pad: 24, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const RIGHT = G.unit3([Math.sin(AZIMUTH * DEG), -Math.cos(AZIMUTH * DEG), 0]); // screen right, on the floor
const TOWARD = [Math.cos(AZIMUTH * DEG), Math.sin(AZIMUTH * DEG), 0];

// ---------- recorder and helpers ----------
const R = A.recorder(P);
const { nameFor } = R;
const record = R.solid;
function put(name, ref, svg, { bias = 0, shapes = [], route, chunk } = {}) {
  return R.put({ piece: name.split(".")[0], at: ref, bias, svg, shapes, name, route, chunk });
}
function box(name, plan, z, h, style = {}, { extra = "", inner = "", bias = 0, steps = 3, bevel = 0.5, owner } = {}) {
  const id = nameFor(name);
  const shape = record(A.slab(plan, z, h, { name: id, owner }, steps));
  put(id, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "hi", ...style, inner }) + extra, { bias, shapes: [shape] });
  return shape;
}
function cyl(name, cx, cy, r, z, h, style = {}, { extra = "", inner = "", bias = 0, steps = 32, bevel = 0, owner } = {}) {
  const id = nameFor(name);
  const shape = record(A.cylinder(cx, cy, r, z, h, { name: id, owner }));
  put(id, [cx, cy, z + h / 2], S(k.cylinder(cx, cy, r, z, h, P, steps, bevel), { tone: "hi", ...style, inner }) + extra, { bias, shapes: [shape] });
  return shape;
}
function disc(name, F, s0, s1, r, style = {}, { extra = "", bias = 0, bevel = 0, owner, seated, cut } = {}) {
  const id = nameFor(name);
  const shape = record(A.disc(F, s0, s1, r, { name: id, owner, seated, cut }));
  put(id, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.disc(s0, s1, r, F, P, { bevel }), { tone: "hi", ...style }) + extra, { bias, shapes: [shape] });
  return shape;
}
function ringAround(name, F, s0, s1, rIn, rOut, style = {}, { extra = "", bias = 0, owner } = {}) {
  const id = nameFor(name);
  const shape = record(A.ring(F, s0, s1, rIn, rOut, { name: id, owner }));
  put(id, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.ringBand(s0, s1, rIn, rOut, F, P), { tone: "hi", ...style }) + extra, { bias, shapes: [shape] });
  return shape;
}
function turned(name, F, profile, style = {}, { extra = "", inner = "", bias = 0, smooth, steps, rims, owner } = {}) {
  const id = nameFor(name);
  const soft = smooth ?? profile.some((point) => point[2]);
  const paths = G.solidOf(profile, F, P, { smooth: soft === true ? { rows: 4 } : soft, ...(steps ? { steps } : {}), ...(rims ? { rims } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const shape = record(A.solid(F, profile, { name: id, owner, curve: soft && !soft.slope ? profile : undefined }));
  put(id, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "hi", ...style, inner }) + extra, { bias, shapes: [shape] });
  return shape;
}
function prism(name, ring, z, h, style = {}, { extra = "", inner = "", bias = 0, convex = false, bevel = 0, owner } = {}) {
  const id = nameFor(name);
  const cx = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
  const cy = ring.reduce((sum, [, y]) => sum + y, 0) / ring.length;
  const shape = record(A.extruded(ring, z, h, { name: id, owner }));
  put(id, [cx, cy, z + h / 2], S(k.extrude(ring, z, h, P, { convex, bevel }), { tone: "hi", ...style, inner }) + extra, { bias, shapes: [shape] });
  return shape;
}
function ballAt(name, centre, r, style = {}, { bias = 0, owner, seated, cut } = {}) {
  const id = nameFor(name);
  const shape = record(A.ball(centre, r, { name: id, owner, seated, cut }));
  put(id, centre, S(G.sphereOf(centre, r, P, { steps: G.stepsFor(r, 32) }), { tone: "hi", ...style }), { bias, shapes: [shape] });
  return shape;
}
// A pad whose base follows a curved host and whose face is flat: where a port or a vessel leaves a round body.
function padOn(name, hosts, point, outward, a, height, style = {}, { bias = 0.1, owner, extra = "", clear, within } = {}) {
  const list = [hosts].flat();
  const inside = within ?? ((p) => list.some((shape) => A.sdf(shape, p) < 0));
  const axis = G.unit3(outward);
  const F = G.frameAlong(point, axis);
  let h = height + 4 * a;
  const start = (angle) => {
    let lo = -2.5 * a;
    let hi = h;
    if (!inside(G.pointOf(F, lo, a, angle))) return 0;
    for (let step = 0; step < 40; step++) {
      const mid = (lo + hi) / 2;
      if (inside(G.pointOf(F, mid, a, angle))) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  const starts = Array.from({ length: 48 }, (_, index) => start((index / 48) * Math.PI * 2));
  const low = Math.min(...starts);
  // the face stands clear of the host all round, so whatever leaves it starts in the open
  h = clear === undefined ? height : Math.max(height, Math.max(...starts) + clear);
  const id = nameFor(name);
  const shape = record(A.disc(F, low - 0.05, h, a, { name: id, owner, seated: true, cut: list }));
  put(id, G.add3(point, G.mul3(axis, h / 2)), S(G.saddleOf(F, a, start, h, P), { tone: "hi", ...style }) + extra, { bias, shapes: [shape] });
  return { end: G.add3(point, G.mul3(axis, h)), axis, F, shape };
}
const ROUTES = {};
// the wallpaper draws every line the Prismaflex way: a pale tube in its circuit's colour with a dashed flow mark down the middle
const FLOW = process.argv.includes("--wallpaper");
const kindOf = (name, cls) => (cls ? cls.split(" ")[0].replace("cpb-", "") : name.startsWith("hc.water") ? "water" : name.startsWith("gas.") ? "gas" : name.startsWith("vavd.") ? "vac" : "");
const screenLength = (points) => points.reduce((sum, point, index) => (index ? sum + Math.hypot(...at(point).map((v, j) => v - at(points[index - 1])[j])) : 0), 0);
function flowMark(route, part, r) {
  const lead = screenLength(G.cut(route, 0, Math.max(0.001, part.from)));
  const w = r * KS;
  return `<path class="cpb-flow" style="--o:${lead.toFixed(2)};--w:${(w * 0.42).toFixed(2)};--da:${(w * 0.75).toFixed(2)};--ga:${(w * 2.25).toFixed(2)}" d="${k.pathOf(part.points.map(at))}"/>`;
}
function tubeItems(name, route, r, { tone = "hi", bias = 0, maxLength = 14, spacing = 1.2, owner, touch, limp = false, breaks = [], gaps = [], caps = true, rims, cls = "", ends = [true, true], into } = {}) {
  const id = nameFor(name);
  R.route(id, route, r, { owner: owner ?? id, touch, limp, gaps, rims, ends, piece: id.split(".")[0] });
  ROUTES[id] = route;
  const kind = kindOf(name, cls);
  const groupCls = [cls, kind && `cpb-k-${kind}`].filter(Boolean).join(" ");
  tubePieces(route, r, P, { maxLength, spacing, breaks, gaps, caps }).forEach((part, index) => {
    const body = tubeSvg(part, { tone }) + (FLOW && kind ? flowMark(route, part, r) : "");
    const svg = groupCls ? `<g class="${groupCls}">${body}</g>` : body;
    if (into && into.test(part)) into.items.push({ key: G.dot3(part.mid, V), svg, shapes: [A.tube(part.points, part.radii)] });
    else put(`${id}:${index}`, part.mid, svg, { bias, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] });
  });
  return id;
}
// a barbed connector: a collar the tube slides over, ending flush on the port face
function line(name, control, r, { bend = 2.8, cls, tone = "hi", ends, touch, into, maxLength = 14 } = {}) {
  const route = G.fillet(control, Math.max(r * bend, 3), r > 2 ? 16 : 10, { P, tube: r });
  return { id: tubeItems(name, route, r, { cls, tone, ends, touch, into, maxLength }), route };
}

// ---------- the plinth ----------
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
for (const [x, y] of byDepth([...k.corners(PLATE, 24), [PLATE.x + PLATE.w / 2, PLATE.y + 24], [PLATE.x + PLATE.w / 2, PLATE.y + PLATE.d - 24]])) {
  back.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
}
back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
record(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate" }));
back.push(Ln(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
const PLATE_SCREWS = k.corners(PLATE, 11);
back.push(Ln(PLATE_SCREWS.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(PLATE_SCREWS.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
const STRIP = { x: -214, y: PLATE.y + PLATE.d - 16, w: 280, d: 7, r: 1 };
back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const TICKS = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 4, 5, STRIP.y + 0.8, 0.6, [2, 3.6], P);
back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
back.push(Dots([at([STRIP.x + 2, STRIP.y + 3.5, 0.6]), at([STRIP.x + STRIP.w - 2, STRIP.y + 3.5, 0.6])], { size: 0.45 }));
const LABEL = { x: PLATE.x + PLATE.w - 22, y: -70, w: 12, d: 64, r: 1.5 };
back.push(S(k.slabOf(LABEL, 0, 1, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.8), 1, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 7.6, LABEL.y + LABEL.d - 5], 1, P, "y"), "CPB · HLM", { size: 4, tone: "lo" }));
back.push(Ln([0, 1].map((row) => k.onTop([[LABEL.x + 3 + row * 2.2, LABEL.y + 5], [LABEL.x + 3 + row * 2.2, LABEL.y + (row ? 16 : 22)]], 1, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + LABEL.w / 2, LABEL.y + 2.6, 1]), at([LABEL.x + LABEL.w / 2, LABEL.y + LABEL.d - 2.6, 1])], { size: 0.45 }));
back.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CAB, 4), 0, 0.1, P)}"/>`);

// ---------- console cabinet on casters ----------
for (const [x, y] of k.corners(CAB, 15)) {
  const WHEEL_R = 8.5;
  const axle = G.frameOf([x, y, WHEEL_R], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  box("cab.fork", { x: x - 4, y: y - 6.4, w: 8, d: 1.4, r: 0.5 }, 4, CAB_Z0 - 9.5 - 4, { tone: "mid" }, { bevel: 0.3 });
  disc("cab.wheel", axle, -4.4, 4.4, WHEEL_R, { tone: "mid" }, { bevel: 0.8 });
  disc("cab.hub", axle, 4.4, 5, 3.2, { tone: "mid" });
  box("cab.fork", { x: x - 4, y: y + 5, w: 8, d: 1.4, r: 0.5 }, 4, CAB_Z0 - 9.5 - 4, { tone: "mid" }, { bevel: 0.3 });
  box("cab.yoke", { x: x - 4.5, y: y - 6.4, w: 9, d: 12.8, r: 1.2 }, CAB_Z0 - 9.5, 3, { tone: "mid" });
  cyl("cab.stem", x, y, 2.4, CAB_Z0 - 6.5, 4, { tone: "mid" }, { steps: 16 });
  box("cab.swivel", { x: x - 7, y: y - 7, w: 14, d: 14, r: 1.5 }, CAB_Z0 - 2.5, 2.5, { tone: "lo" });
}
const CAB_FRONT = CAB.y + CAB.d;
const CAB_RIGHT = CAB.x + CAB.w;
const front = (points, y = CAB_FRONT) => k.pathOf(points.map(([x, z]) => at([x, y, z])));
const faceRect = (x, z, w, h, r, y = CAB_FRONT) => k.pathOf(k.roundedPlan({ x, y: z, w, d: h, r }, 3).map(([px, pz]) => at([px, y, pz])), true);
const DOORS = [0, 1, 2].map((index) => [CAB.x + 10 + index * 80, CAB.x + 86 + index * 80]);
const slots = [];
for (let index = 0; index < 7; index++) slots.push(faceRect(CAB.x + 256 + index * 7, CAB_Z0 + 16, 2.2, 24, 1.1));
box("cab.body", CAB, CAB_Z0, CAB_Z1 - CAB_Z0, { tone: "mid" }, {
  steps: 6,
  bevel: 1.2,
  inner: Ln(k.sideSeam(CAB, CAB_Z0 + 8, P, 6) + k.sideSeam(CAB, CAB_Z1 - 6, P, 6), { tone: "faint" }),
  extra:
    Ln(DOORS.map(([x0, x1]) => faceRect(x0, CAB_Z0 + 12, x1 - x0, CAB_Z1 - CAB_Z0 - 22, 2)).join(""), { tone: "lo" }) +
    Ln(slots.join(""), { tone: "lo" }) +
    Ln(DOORS.map(([, x1]) => front([[x1 - 10, CAB_Z0 + 34], [x1 - 10, CAB_Z0 + 22]])).join(""), { tone: "mid" }) +
    Dots(DOORS.flatMap(([, x1]) => [at([x1 - 10, CAB_FRONT, CAB_Z0 + 34]), at([x1 - 10, CAB_FRONT, CAB_Z0 + 22])]), { size: 0.55, tone: "hi" }) +
    // battery and mains panel on the right side
    Ln(k.pathOf(k.roundedPlan({ x: -50, y: CAB_Z0 + 14, w: 40, d: 26, r: 2 }, 3).map(([py, pz]) => at([CAB_RIGHT, py, pz])), true), { tone: "lo" }) +
    Dots([[-46, CAB_Z0 + 18], [-14, CAB_Z0 + 18], [-46, CAB_Z0 + 36], [-14, CAB_Z0 + 36]].map(([py, pz]) => at([CAB_RIGHT, py, pz])), { size: 0.45 }),
});
box("cab.deck", k.insetPlan(CAB, -1.5), CAB_Z1, DECK_Z - CAB_Z1, { tone: "mid" }, { steps: 6, bevel: 0.8 });

// ---------- roller pumps ----------
function horseshoe([cx, cy], s, rin, steps = 48) {
  const half = s / 2;
  const x1 = cx + half;
  const ring = [];
  const r = 3;
  ring.push([x1, cy + rin]);
  for (const [qx, qy, start] of [
    [x1 - r, cy + half - r, 0],
    [cx - half + r, cy + half - r, 90],
    [cx - half + r, cy - half + r, 180],
    [x1 - r, cy - half + r, 270],
  ]) {
    for (let step = 0; step <= 4; step++) {
      const a = (start + (90 * step) / 4) * DEG;
      ring.push([qx + r * Math.cos(a), qy + r * Math.sin(a)]);
    }
  }
  ring.push([x1, cy - rin]);
  ring.push([cx, cy - rin]);
  for (let step = 1; step < steps; step++) {
    const a = (-90 - (180 * step) / steps) * DEG;
    ring.push([cx + rin * Math.cos(a), cy + rin * Math.sin(a)]);
  }
  ring.push([cx, cy + rin]);
  return ring;
}
// the part of the raceway nearer the viewer than the rotor: drawn again over it, clipped to its own footprint
function frontClip([cx, cy], s, rin) {
  const half = s / 2;
  const pts = [];
  for (let step = 0; step <= 16; step++) {
    const a = (AZIMUTH - 90 + (180 * step) / 16) * DEG;
    pts.push([cx + rin * Math.cos(a), cy + rin * Math.sin(a)]);
  }
  pts.push([cx - half - 2, cy + half + 2], [cx + half + 2, cy + half + 2]);
  const flat = [];
  for (const [x, y] of pts) for (const z of [MOD_Z1, RACE_Z1 + 0.6]) flat.push(at([x, y, z]));
  return k.pathOf(hull2(flat), true);
}
function hull2(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const WELLS = {};
function pointerPath(F, s, r0, r1, turn) {
  const a = -Math.PI * 0.75 + turn * Math.PI * 1.5;
  return k.pathOf([at(G.pointOf(F, s, r0, a)), at(G.pointOf(F, s, r1, a))]);
}
const knobPointer = (F, turn) => pointerPath(F, 6.65, 1.2, 3.9, turn);
function pumpModule(id, pump) {
  const { c, s } = pump;
  const [cx, cy] = c;
  const plan = { x: cx - s / 2, y: cy - s / 2, w: s, d: s, r: 3 };
  const face = cy + s / 2;
  const win = { x0: cx - s / 2 + 6, x1: cx + 4, z0: DECK_Z + 8, z1: DECK_Z + 17 };
  const winPath = k.pathOf(k.roundedPlan({ x: win.x0, y: win.z0, w: win.x1 - win.x0, d: win.z1 - win.z0, r: 1.2 }, 3).map(([x, z]) => at([x, face, z])), true);
  const textAt = k.sideMatrix([win.x1 - 1.6, face], win.z0 + 2.1, P, "left");
  const digits = `<text class="cpb-digit" data-digits="${id}" transform="${textAt}" font-size="${((win.z1 - win.z0) * 0.6).toFixed(2)}" text-anchor="end">0.00</text>`;
  const tag = k.faceTextSvg(k.sideMatrix([win.x0, face], DECK_Z + 3.2, P, "left"), pump.label, { size: pump.label.length > 9 ? 2 : 2.4, tone: "lo" });
  box(`${id}.body`, plan, DECK_Z, MOD_Z1 - DECK_Z, { tone: "mid" }, {
    bevel: 0.6,
    inner: Ln(k.sideSeam(plan, DECK_Z + 20, P, 3), { tone: "faint" }),
    extra: `<path class="cpb-lcd" d="${winPath}"/>${digits}` + Ln(winPath, { tone: "lo" }) + tag,
  });
  // speed knob, its pointer turning with the set speed
  const KF = G.frameOf([cx + s / 2 - 10, face, DECK_Z + 12.5], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  disc(`${id}.knob-collar`, KF, 0, 1.2, 6.6, { tone: "mid" });
  turned(`${id}.knob`, KF, [[1.2, 0], [1.2, 5.4], [5.4, 5.4], [6.6, 4.4], [6.6, 0]], { tone: "hi" }, {
    extra: k.fadedSvg(G.ribsOf(KF, 1.2, 5.4, 5.4, 36, P, { fade: [0.1, 0.55] }), { tone: "lo" }) + `<path class="iso-line" data-tone="hi" data-knob="${id}" data-free="end" d="${knobPointer(KF, 0)}"/>`,
  });
  pump.knob = KF;
  // the raceway and the rotor live in one well group, sorted inside as the rollers turn
  const well = { items: [], test: (part) => part.mid[0] < pump.x1 - 0.5 && Math.abs(part.mid[0] - cx) < s / 2 && Math.abs(part.mid[1] - cy) < s / 2 };
  const ring = horseshoe(c, s, pump.rin);
  const raceShape = record(A.extruded(ring, MOD_Z1, RACE_H, { name: `${id}.race` }));
  const raceSvg = S(k.extrude(ring, MOD_Z1, RACE_H, P, { convex: false, bevel: 0.5 }), { tone: "mid" });
  const hubShape = record(A.cylinder(cx, cy, pump.hub, MOD_Z1, RACE_H + 0.6, { name: `${id}.hub` }));
  WELLS[id] = { pump, well, raceSvg, raceShape, hubShape, clip: frontClip(c, s, pump.rin) };
  // tube inserts: a thumb lever on each arm beside the opening
  for (const side of [-1, 1]) {
    const ax = cx + s / 2 - 5;
    const ay = cy + side * (pump.rin + (s / 2 - pump.rin) / 2);
    cyl(`${id}.insert`, ax, ay, 2.4, RACE_Z1, 2.4, { tone: "mid" }, { steps: 18, extra: Ln(k.knurl(ax, ay, 2.4, RACE_Z1, RACE_Z1 + 2.4, 14, P), { tone: "lo" }) });
  }
}
for (const [id, pump] of Object.entries(PUMPS)) pumpModule(id, pump);

// the boot: in through one leg of the opening, round the far side of the raceway, out through the other
function bootOf(pump, tz = pump.tz) {
  const [cx, cy] = pump.c;
  const arc = [];
  for (let step = 0; step <= 24; step++) {
    const a = (90 + 180 * (step / 24)) * DEG * (pump.inLeg === "front" ? 1 : -1);
    arc.push([cx + pump.tc * Math.cos(a), cy + pump.tc * Math.sin(a), tz]);
  }
  return arc; // from the "in" leg at x = cx to the "out" leg at x = cx
}
const legY = (pump, leg) => (leg === "front" ? pump.front : pump.back);
const outLeg = (pump) => (pump.inLeg === "front" ? "back" : "front");

// rotor geometry, shared with the page
function rotorParts(pump, phi) {
  const [cx, cy] = pump.c;
  const rollers = [0, 1].map((index) => {
    const a = phi + index * Math.PI;
    return [cx + pump.rc * Math.cos(a), cy + pump.rc * Math.sin(a)];
  });
  const reach = pump.rc + pump.roller * 0.4;
  const half = pump.roller * 0.75;
  const ux = Math.cos(phi);
  const uy = Math.sin(phi);
  const bar = [
    [cx - ux * reach - uy * half, cy - uy * reach + ux * half],
    [cx + ux * reach - uy * half, cy + uy * reach + ux * half],
    [cx + ux * reach + uy * half, cy + uy * reach - ux * half],
    [cx - ux * reach + uy * half, cy - uy * reach - ux * half],
  ];
  return { rollers, bar };
}
// ---------- mast and holders ----------
cyl("mast.foot", MAST[0], MAST[1], 9, DECK_Z, 4, { tone: "mid" }, { bevel: 0.6, extra: Dots(G.dotsOf(VERT(...MAST), DECK_Z + 4, 7, 6, P, { all: true }), { size: 0.4 }) });
const CLAMPS = { oxy: 120, filter: 131, hemo: 168, res: 211, vavd: 230, gas: 244 };
const CLAMP_H = 10;
{
  const cuts = Object.values(CLAMPS).sort((a, b) => a - b);
  let from = DECK_Z + 4;
  for (const z of [...cuts, MAST_TOP]) {
    if (z - from > 0.2) cyl("mast.pole", MAST[0], MAST[1], MAST_R, from, z - from, { tone: "mid" }, { steps: 24 });
    from = z + CLAMP_H;
  }
}
cyl("mast.cap", MAST[0], MAST[1], 5.6, MAST_TOP, 3, { tone: "mid" }, { bevel: 0.5 });
function mastClamp(name, side = "front") {
  const z = CLAMPS[name];
  const h = CLAMP_H;
  const plan = { x: MAST[0] - 6, y: MAST[1] - 6, w: 12, d: 12, r: 2 };
  box(`${name}.clamp`, plan, z, h, { tone: "mid" }, { bevel: 0.5 });
  // thumb screw on the near side
  const TF = side === "front" ? G.frameOf([MAST[0], MAST[1] + 6, z + h / 2], [0, 1, 0], [1, 0, 0], [0, 0, 1]) : G.frameOf([MAST[0] + 6, MAST[1], z + h / 2], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  disc(`${name}.screw-neck`, TF, 0, 2.4, 1.3, { tone: "mid" });
  turned(`${name}.screw`, TF, [[2.4, 0], [2.4, 3], [6, 3], [6.6, 2.4], [6.6, 0]], { tone: "mid" }, { extra: k.fadedSvg(G.ribsOf(TF, 2.4, 6, 3, 16, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
}

// ---------- centrifugal pump: console on the deck, the drive and its pump head on top ----------
const DPLAN = { x: DRIVE.c[0] - DRIVE.s / 2, y: DRIVE.c[1] - DRIVE.s / 2, w: DRIVE.s, d: DRIVE.s, r: 3 };
const dFace = DPLAN.y + DPLAN.d;
const dWin = (z0) => k.pathOf(k.roundedPlan({ x: DPLAN.x + 4, y: z0, w: 24, d: 7.5, r: 1 }, 3).map(([x, z]) => at([x, dFace, z])), true);
const D_RPM_Z = DECK_Z + 12;
const D_FLOW_Z = DECK_Z + 3;
const dText = (z, key, text) => `<text class="cpb-digit" data-digits="${key}" transform="${k.sideMatrix([DPLAN.x + 27, dFace], z + 1.5, P, "left")}" font-size="5" text-anchor="end">${text}</text>`;
box("drive.console", DPLAN, DECK_Z, MOD_Z1 - DECK_Z, { tone: "mid" }, {
  bevel: 0.6,
  inner: Ln(k.sideSeam(DPLAN, DECK_Z + 20, P, 3), { tone: "faint" }),
  extra:
    `<path class="cpb-lcd" d="${dWin(D_RPM_Z)}"/><path class="cpb-lcd" d="${dWin(D_FLOW_Z)}"/>` +
    dText(D_RPM_Z, "drive-rpm", "0") +
    dText(D_FLOW_Z, "drive-flow", "0.00") +
    Ln(dWin(D_RPM_Z) + dWin(D_FLOW_Z), { tone: "lo" }) +
    k.faceTextSvg(k.sideMatrix([DPLAN.x + 29.5, dFace], D_RPM_Z + 2.4, P, "left"), "RPM", { size: 2, tone: "lo" }) +
    k.faceTextSvg(k.sideMatrix([DPLAN.x + 29.5, dFace], D_FLOW_Z + 2.4, P, "left"), "L/MIN", { size: 2, tone: "lo" }),
});
// the speed knob on the side, the line-clamp lamp on the face
const DK = G.frameOf([DPLAN.x + DPLAN.w, DPLAN.y + DPLAN.d - 9, DECK_Z + 11.5], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
disc("drive.knob-collar", DK, 0, 1.2, 5.6, { tone: "mid" });
turned("drive.knob", DK, [[1.2, 0], [1.2, 4.6], [4.6, 4.6], [5.6, 3.8], [5.6, 0]], { tone: "hi" }, {
  extra: k.fadedSvg(G.ribsOf(DK, 1.2, 4.6, 4.6, 32, P, { fade: [0.1, 0.55] }), { tone: "lo" }) + `<path class="iso-line" data-tone="hi" data-knob="drive" data-free="end" d="${pointerPath(DK, 5.65, 1, 3.4, 0)}"/>`,
});
const LAMP = G.frameOf([DPLAN.x + DPLAN.w - 4, dFace, DECK_Z + 16], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
disc("drive.lamp", LAMP, 0, 1, 1.8, { tone: "mid" }, { extra: `<path class="cpb-lamp" data-lamp="clamp" d="${k.pathOf(Array.from({ length: 16 }, (_, i) => at(G.pointOf(LAMP, 1, 1.2, (i / 16) * Math.PI * 2))), true)}"/>` });
// the drive motor; the disposable pump head sits in it, inlet up the middle, outlet out the side
const DRIVEF = VERT(...DRIVE.c);
cyl("drive.motor", DRIVE.c[0], DRIVE.c[1], 12, MOD_Z1, 7, { tone: "mid" }, { bevel: 0.6, inner: Ln(G.arcOf(DRIVEF, MOD_Z1 + 3.5, 12, P), { tone: "faint" }) });
const HEAD_Z = MOD_Z1 + 7;
// impeller vanes seen through the clear cone, drawn only where the cone faces the viewer; the page turns them
const VANE_SLOPES = [[3.6, HEAD_Z + 14], [7, HEAD_Z + 11], [12, HEAD_Z + 7]];
function vanesPath(phi) {
  let d = "";
  for (let vane = 0; vane < 4; vane++) {
    let run = [];
    for (let step = 0; step <= 12; step++) {
      const rho = 4.4 + (step / 12) * 7;
      const [[r0, z0], [r1, z1]] = rho < 7 ? [VANE_SLOPES[0], VANE_SLOPES[1]] : [VANE_SLOPES[1], VANE_SLOPES[2]];
      const slope = (z0 - z1) / (r1 - r0);
      const z = z0 - (rho - r0) * slope;
      const th = phi + (vane * Math.PI) / 2 + 0.9 * (step / 12);
      const facing = G.dot3([slope * Math.cos(th), slope * Math.sin(th), 1], V) > 0.05;
      if (facing) run.push(at([DRIVE.c[0] + rho * Math.cos(th), DRIVE.c[1] + rho * Math.sin(th), z]));
      if (!facing || step === 12) {
        if (run.length > 1) d += k.pathOf(run);
        run = [];
      }
    }
  }
  return d;
}
const headShape = turned("drive.head", DRIVEF, [[HEAD_Z, 13.5], [HEAD_Z + 5, 13.5], [HEAD_Z + 7, 12, 1], [HEAD_Z + 11, 7], [HEAD_Z + 14, 3.6]], { tone: "hi", lit: true }, {
  extra: `<path class="iso-line" data-tone="mid" data-free="" data-vanes d="${vanesPath(0)}"/>`,
});
disc("drive.inlet", DRIVEF, HEAD_Z + 14, HEAD_Z + 18, 3.2, { tone: "hi" });
const pumpInTop = [DRIVE.c[0], DRIVE.c[1], HEAD_Z + 18];

// ---------- venous reservoir: hard shell, the blood level shows through it ----------
const RES = [...DRIVE.c]; // right over the pump head: a centrifugal pump has to be filled from above
const RES_R = 19;
const RES_Z0 = 158;
const RES_Z1 = 214;
const STEM_Z = RES_Z0 - 22; // the outlet stem's lower end
const RESF = VERT(...RES);
const levelZ = (ml) => RES_Z0 + ((RES_Z1 - RES_Z0 - 3) * Math.max(0, ml - 300)) / (M.RES_MAX_ML - 300);
const resShell = record(A.cylinder(RES[0], RES[1], RES_R, RES_Z0, RES_Z1 - RES_Z0, { name: "res.shell" }));
turned("res.cone", RESF, [[RES_Z0 - 14, 3.4], [RES_Z0 - 12, 4.6], [RES_Z0, RES_R]], { tone: "hi", className: "cpb-blood" });
disc("res.stem", RESF, STEM_Z, RES_Z0 - 14, 3.2, { tone: "hi", className: "cpb-blood" });
// a printed scale: a closed decal outline with the ticks hanging from its edge
const GRAD_A = Math.atan2(TOWARD[1], TOWARD[0]) - 0.45;
const GRAD_W = 0.26;
const arcAt = (z, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => at(G.pointOf(RESF, z, RES_R, a0 + ((a1 - a0) * i) / n)));
const gradRule = k.pathOf([...arcAt(RES_Z0 + 2, GRAD_A, GRAD_A + GRAD_W), ...arcAt(RES_Z1 - 3, GRAD_A + GRAD_W, GRAD_A)], true);
const gradTicks = [];
for (let ml = 500; ml <= 4000; ml += 250) {
  const z = levelZ(ml);
  if (z > RES_Z1 - 5) break;
  const big = ml % 1000 === 0;
  gradTicks.push(k.pathOf(Array.from({ length: 5 }, (_, i) => at(G.pointOf(RESF, z, RES_R, GRAD_A + (i / 4) * (big ? 0.19 : 0.12))))));
}
function resSvg(z) {
  const blood = S(k.cylinder(RES[0], RES[1], RES_R, RES_Z0, z - RES_Z0, P, 56), { tone: "hi", className: "cpb-blood" });
  const empty = S(k.cylinder(RES[0], RES[1], RES_R, z, RES_Z1 - z, P, 56), { tone: "hi", crease: "lo" });
  return `<g data-blood>${blood}</g><g data-empty>${empty}</g>` + Ln(gradRule, { tone: "mid" }) + Ln(gradTicks.join(""), { tone: "mid" });
}
put("res.shell", [RES[0], RES[1], (RES_Z0 + RES_Z1) / 2], `<g data-res>${resSvg(levelZ(M.PRIME_ML))}</g>`, { shapes: [resShell] });
disc("res.lid", RESF, RES_Z1, RES_Z1 + 4, RES_R + 1.5, { tone: "mid" }, { bevel: 0.6 });
mastClamp("res");
box("res.arm", { x: RES[0] + 2, y: RES[1] - RES_R - 1.5 - 4.1, w: MAST[0] - 6 - RES[0] - 2, d: 4, r: 1 }, RES_Z1 + 0.5, 3, { tone: "mid" });
// lid: the venous inlet in the middle, the vacuum port, the pressure-relief valve and a capped spare luer
const vPortTop = RES_Z1 + 12;
disc("res.venous-port", RESF, RES_Z1 + 4, vPortTop, 4.4, { tone: "hi" }, { extra: Ln(G.circleOf(RESF, vPortTop, 2.9, P), { tone: "faint" }) });
const VAC_AT = [MAST[0] - 6 - 16 + 3.2, RES[1] + 6];
const vacTop = RES_Z1 + 10;
disc("res.vac-port", VERT(...VAC_AT), RES_Z1 + 4, vacTop, 2, { tone: "hi" });
const RELIEF = VERT(RES[0] - 13, RES[1] + 7);
disc("res.relief", RELIEF, RES_Z1 + 4, RES_Z1 + 7, 3.4, { tone: "mid" }, { bevel: 0.3 });
turned("res.relief-cap", RELIEF, [[RES_Z1 + 7, 0], [RES_Z1 + 7, 2.6], [RES_Z1 + 9.4, 2.6], [RES_Z1 + 10.4, 1.8], [RES_Z1 + 10.4, 0]], { tone: "hi" });
{
  const F = VERT(RES[0] + 4, RES[1] + 15);
  disc("res.port", F, RES_Z1 + 4, RES_Z1 + 8, 2.4, { tone: "hi" });
  disc("res.cap", F, RES_Z1 + 8, RES_Z1 + 10, 2.9, { tone: "mid" }, { bevel: 0.3 });
}
// cardiotomy inlets on the left of the shell: the sucker and both vents come home here
const RETURN_PORT = {};
const RET_Z = { sucker: RES_Z1 - 8, rootvent: RES_Z1 - 18, vent: RES_Z1 - 28 };
for (const [id, z] of Object.entries(RET_Z)) {
  const side = Math.sqrt(RES_R ** 2 - (RETURN_Y - RES[1]) ** 2);
  RETURN_PORT[id] = padOn(`res.${id}-in`, resShell, [RES[0] - side + 0.6, RETURN_Y, z], [-1, 0, 0], 2.2, 4).end;
}

// ---------- membrane oxygenator with heat exchanger ----------
const OXY = [90, -10];
const OXY_R = 14;
const OXYF = VERT(...OXY);
disc("oxy.base", OXYF, 98, 102, OXY_R + 1.5, { tone: "mid" }, { bevel: 0.5 });
const oxyBody = [
  turned("oxy.body", OXYF, [[102, OXY_R], [122, OXY_R]], { tone: "hi" }, { inner: Ln(G.arcOf(OXYF, 112, OXY_R, P), { tone: "faint" }) }),
  disc("oxy.band", OXYF, 122, 128, OXY_R + 2.4, { tone: "mid" }),
  turned("oxy.body", OXYF, [[128, OXY_R], [152, OXY_R]], { tone: "hi" }, { inner: Ln(G.arcOf(OXYF, 140, OXY_R, P), { tone: "faint" }) }),
];
const oxyTop = disc("oxy.top", OXYF, 152, 156, OXY_R + 1.5, { tone: "mid" }, { bevel: 0.5 });
const toGas = [Math.cos(-38 * DEG), Math.sin(-38 * DEG), 0];
const gasIn = padOn("oxy.gas-in", oxyTop, G.add3([OXY[0], OXY[1], 154], G.mul3(toGas, OXY_R + 1.1)), toGas, 1.3, 3);
disc("oxy.exhaust", OXYF, 92, 98, 2.6, { tone: "hi" });
// pump head to oxygenator: one straight run between the two ports
const PUMP_Z = HEAD_Z + 2.5;
const toOxy = G.unit3([OXY[0] - DRIVE.c[0], OXY[1] - DRIVE.c[1], 0]);
const driveOut = padOn("drive.outlet", headShape, G.add3([DRIVE.c[0], DRIVE.c[1], PUMP_Z], G.mul3(toOxy, 13.5 - 0.4)), toOxy, 3.4, 4);
const oxyIn = padOn("oxy.inlet", oxyBody, G.add3([OXY[0], OXY[1], PUMP_Z], G.mul3(toOxy, -(OXY_R - 0.6))), G.mul3(toOxy, -1), 3.4, 4);
// the arterial line rises straight across the screen from the filter, so both its bends face the viewer
const RISER = [134, LANE_Y];
const FIL = [RISER[0] - RIGHT[0] * 24, RISER[1] - RIGHT[1] * 24];
const FZ = 7;
const toFilter = G.unit3([FIL[0] - OXY[0], FIL[1] - OXY[1], 0]);
const oxyOut = padOn("oxy.outlet", oxyBody, G.add3([OXY[0], OXY[1], 140 + FZ], G.mul3(toFilter, OXY_R - 0.6)), toFilter, 3.2, 5);
// oxygenated blood for the cardioplegia, drawn off the arterial side and led back behind the reservoir stem
const CPB_Z = 135;
const toCp = [Math.cos(200 * DEG), Math.sin(200 * DEG), 0];
const oxyCp = padOn("oxy.cp-port", oxyBody, G.add3([OXY[0], OXY[1], CPB_Z], G.mul3(toCp, OXY_R - 0.6)), toCp, 2.2, 4);
const CPB_P1 = G.add3(oxyCp.end, G.mul3(toCp, (oxyCp.end[1] - PUMPS.cardio.back) / -toCp[1]));
// and blood for the hemoconcentrator, behind
const HEMO = [64, -50];
const HEMO_IN_Z = 145.5;
const toHemo = G.unit3([HEMO[0] - OXY[0], HEMO[1] - OXY[1], 0]);
const oxyHemo = padOn("oxy.hemo-port", oxyBody, G.add3([OXY[0], OXY[1], HEMO_IN_Z], G.mul3(toHemo, OXY_R - 0.6)), toHemo, 2.2, 4);
mastClamp("oxy", "side");
// the mast stands behind the oxygenator: one straight arm from the clamp's front face to the band
box("oxy.arm", { x: OXY[0] - 8, y: MAST[1] + 6, w: 4, d: OXY[1] - Math.sqrt((OXY_R + 2.4) ** 2 - 16) - 0.1 - (MAST[1] + 6), r: 1 }, 122, 6, { tone: "mid" });

// ---------- heater-cooler: water through the oxygenator's heat exchanger ----------
const HC = { x: 104, y: 22, w: 56, d: 38, r: 3 };
const HC_Z0 = 4;
const HC_Z1 = 48;
for (const [x, y] of k.corners(HC, 6)) cyl("stand.hc-foot", x, y, 3, 0, HC_Z0, { tone: "lo" }, { steps: 16 });
const hcFront = HC.y + HC.d;
const hcRect = (x, z, w, h, r) => k.pathOf(k.roundedPlan({ x, y: z, w, d: h, r }, 3).map(([px, pz]) => at([px, hcFront, pz])), true);
const hcWin = hcRect(HC.x + 7, HC_Z0 + 24, 26, 11, 1.2);
const hcSlots = [];
for (let index = 0; index < 5; index++) hcSlots.push(k.pathOf(k.roundedPlan({ x: HC.y + 8 + index * 5, y: HC_Z0 + 8, w: 1.8, d: 18, r: 0.9 }, 3).map(([py, pz]) => at([HC.x + HC.w, py, pz])), true));
box("hc.body", HC, HC_Z0, HC_Z1 - HC_Z0, { tone: "mid" }, {
  steps: 4,
  bevel: 0.9,
  inner: Ln(k.sideSeam(HC, HC_Z0 + 5, P, 4), { tone: "faint" }),
  extra:
    `<path class="cpb-lcd" d="${hcWin}"/>` +
    `<text class="cpb-digit" transform="${k.sideMatrix([HC.x + 31.4, hcFront], HC_Z0 + 26.6, P, "left")}" font-size="6.4" text-anchor="end">37.0</text>` +
    Ln(hcWin, { tone: "lo" }) +
    Ln(hcSlots.join(""), { tone: "lo" }) +
    k.faceTextSvg(k.sideMatrix([HC.x + 7, hcFront], HC_Z0 + 19.5, P, "left"), "HEATER-COOLER", { size: 2.4, tone: "lo" }),
});
const HC_KNOB = G.frameOf([HC.x + 44, hcFront, HC_Z0 + 29], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
disc("hc.knob-collar", HC_KNOB, 0, 1, 5.4, { tone: "mid" });
turned("hc.knob", HC_KNOB, [[1, 0], [1, 4.4], [4.4, 4.4], [5.2, 3.6], [5.2, 0]], { tone: "hi" }, { extra: k.fadedSvg(G.ribsOf(HC_KNOB, 1, 4.4, 4.4, 30, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
for (const x of [HC.x + 26, HC.x + 46]) box("hc.handle-post", { x: x - 1.5, y: HC.y + HC.d / 2 - 1.5, w: 3, d: 3, r: 0.8 }, HC_Z1, 5, { tone: "mid" }, { bevel: 0.2 });
box("hc.handle", { x: HC.x + 23, y: HC.y + HC.d / 2 - 2, w: 26, d: 4, r: 1.8 }, HC_Z1 + 5, 2.6, { tone: "mid" }, { bevel: 0.3 });
[70, 100].forEach((angle, index) => {
  const n = [Math.cos(angle * DEG), Math.sin(angle * DEG), 0];
  const port = padOn("oxy.water", oxyBody, G.add3([OXY[0], OXY[1], 116], G.mul3(n, OXY_R - 0.4)), n, 2.2, 4);
  const cx = HC.x + 8;
  const cy = HC.y + 10 + index * 10;
  disc("hc.coupling", VERT(cx, cy), HC_Z1, HC_Z1 + 4, 2.8, { tone: "hi" }, { bevel: 0.3 });
  line("hc.water", [port.end, G.add3(port.end, G.mul3(n, 6)), [cx, cy, 72 - index * 4], [cx, cy, HC_Z1 + 4]], 1.6, { tone: "mid", bend: 4 });
});

// ---------- arterial filter ----------
const FILF = VERT(...FIL);
const filterBody = [
  turned("filter.body", FILF, [[112 + FZ, 2.2], [118 + FZ, 2.2], [120 + FZ, 7.2], [122 + FZ, 8], [126 + FZ, 8]], { tone: "hi" }),
  disc("filter.band", FILF, 126 + FZ, 130 + FZ, 10, { tone: "mid" }),
  turned("filter.body", FILF, [[130 + FZ, 8], [144 + FZ, 8], [146 + FZ, 7.2], [148 + FZ, 3]], { tone: "hi" }, { inner: Ln(G.arcOf(FILF, 138 + FZ, 8, P), { tone: "faint" }) }),
];
disc("filter.purge", FILF, 148 + FZ, 152 + FZ, 1.2, { tone: "hi" });
disc("filter.stopcock", FILF, 152 + FZ, 156 + FZ, 2.2, { tone: "mid" }, { bevel: 0.3 });
box("filter.stopcock-lever", { x: FIL[0] - 1, y: FIL[1] - 6, w: 2, d: 12, r: 0.8 }, 156 + FZ, 1.4, { tone: "mid" }, { bevel: 0.2 });
const filIn = padOn("filter.inlet", filterBody, G.add3([FIL[0], FIL[1], 140 + FZ], G.mul3(toFilter, -7.6)), G.mul3(toFilter, -1), 2.8, 4);
mastClamp("filter");
box("filter.arm", { x: MAST[0] + 6, y: MAST[1] - 2, w: FIL[0] + 2 - MAST[0] - 6, d: 4, r: 1 }, FZ + 126, 4, { tone: "mid" });
box("filter.arm2", { x: FIL[0] - 2, y: MAST[1] + 2, w: 4, d: FIL[1] - 10 - MAST[1] - 2.1, r: 1 }, FZ + 126, 4, { tone: "mid" });

// ---------- gas blender and flowmeter on the mast ----------
const BLEND = { x: MAST[0] + 6, y: MAST[1] - 9, w: 16, d: 18, r: 2 };
box("gas.blender", BLEND, 236, 26, { tone: "mid" }, { bevel: 0.6, inner: Ln(k.sideSeam(BLEND, 258, P, 3), { tone: "faint" }) });
mastClamp("gas");
const KNOB_F = G.frameOf([BLEND.x + BLEND.w, BLEND.y + 12, 246], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
turned("gas.fio2", KNOB_F, [[0, 0], [0, 4.2], [3.4, 4.2], [4.2, 3.4], [4.2, 0]], { tone: "hi" }, { extra: k.fadedSvg(G.ribsOf(KNOB_F, 0, 3.4, 4.2, 28, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
const FMF = VERT(BLEND.x + BLEND.w - 4.5, BLEND.y + BLEND.d + 2.6);
disc("gas.fm-foot", FMF, 238.5, 240.5, 2.6, { tone: "mid" });
turned("gas.fm-tube", FMF, [[240.5, 1.8], [257, 1.8]], { tone: "hi" }, { inner: Ln(G.arcOf(FMF, 245, 1.8, P) + G.arcOf(FMF, 250, 1.8, P) + G.arcOf(FMF, 255, 1.8, P), { tone: "faint" }) });
disc("gas.fm-cap", FMF, 257, 259, 2.6, { tone: "mid" });
const FLOAT = G.pointOf(FMF, 248, 0, 0);
put("gas.float", FLOAT, S(G.sphereOf(FLOAT, 1.3, P, { steps: 24 }), { tone: "hi" }), { bias: 0.4, shapes: [record(A.ball(FLOAT, 1.3, { name: "gas.float", owner: "gas.fm-tube" }))] });
const GAS_OUT = G.frameOf([BLEND.x + 12, BLEND.y + 4, 0], UP, [1, 0, 0], [0, 1, 0]);
disc("gas.out", GAS_OUT, 232, 236, 1.6, { tone: "mid" });

// ---------- vacuum regulator for assisted venous drainage, on the left of the mast ----------
const VAVD = { x: MAST[0] - 6 - 16, y: MAST[1] - 8, w: 16, d: 16, r: 1.6 };
const VAVD_Z0 = 226;
const VAVD_Z1 = 244;
box("vavd.body", VAVD, VAVD_Z0, VAVD_Z1 - VAVD_Z0, { tone: "mid" }, {
  bevel: 0.5,
  inner: Ln(k.sideSeam(VAVD, VAVD_Z0 + 3, P, 2), { tone: "faint" }),
  extra: k.faceTextSvg(k.sideMatrix([VAVD.x + 1.6, VAVD.y + VAVD.d], VAVD_Z0 + 1.2, P, "left"), "VAVD", { size: 1.8, tone: "lo" }),
});
mastClamp("vavd");
// the vacuum gauge on its face: a dial whose needle shows the vacuum on the reservoir
const GAUGE = G.frameOf([VAVD.x + VAVD.w - 5, VAVD.y + VAVD.d, VAVD_Z0 + 11], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const GAUGE_R = 4.2;
const needleAngle = (mm) => Math.PI * 1.25 - (mm / 100) * Math.PI * 1.5;
function needlePath(mm) {
  return k.pathOf([at(G.pointOf(GAUGE, 1.6, 0.4, needleAngle(mm) + Math.PI)), at(G.pointOf(GAUGE, 1.6, GAUGE_R - 1.4, needleAngle(mm)))]);
}
const gaugeTicks = [];
for (let mm = 0; mm <= 100; mm += 10) {
  const a = needleAngle(mm);
  gaugeTicks.push(k.pathOf([at(G.pointOf(GAUGE, 1.6, GAUGE_R - 0.9, a)), at(G.pointOf(GAUGE, 1.6, GAUGE_R - (mm % 50 ? 1.6 : 2.3), a))]));
}
disc("vavd.gauge", GAUGE, 0, 1.6, GAUGE_R, { tone: "hi" }, {
  bevel: 0.3,
  extra: Ln(gaugeTicks.join(""), { tone: "lo", free: true }) + `<path class="iso-line" data-tone="hi" data-needle="vavd" data-free="end" d="${needlePath(0)}"/>` + Dots([at(G.pointOf(GAUGE, 1.6, 0, 0))], { size: 0.5 }),
});
VAVD.gauge = GAUGE;
const VK = G.frameOf([VAVD.x + 5, VAVD.y + 8, VAVD_Z1], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
turned("vavd.knob", VK, [[0, 0], [0, 3], [2.4, 3], [3, 2.4], [3, 0]], { tone: "hi" }, { extra: k.fadedSvg(G.ribsOf(VK, 0, 2.4, 3, 20, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
const VAC_PORT_X = VAVD.x + 3.2;
const VAC_OUT = G.frameOf([VAC_PORT_X, VAVD.y + VAVD.d, VAVD_Z0 + 8], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
disc("vavd.port", VAC_OUT, 0, 4, 1.8, { tone: "hi" });

// ---------- hemoconcentrator: arterial blood through hollow fibres, water out, back to the reservoir ----------
const HEMOF = VERT(...HEMO);
const hemoBody = [
  turned("hemo.cap", HEMOF, [[142, 0], [142, 5], [143, 5.5], [148, 5.5]], { tone: "mid" }),
  turned("hemo.body", HEMOF, [[148, 5], [190, 5]], { tone: "hi" }, { inner: Ln(G.arcOf(HEMOF, 162, 5, P) + G.arcOf(HEMOF, 176, 5, P), { tone: "faint" }) }),
  turned("hemo.cap", HEMOF, [[190, 5.5], [195, 5.5], [196, 5], [196, 0]], { tone: "mid" }),
];
const hemoIn = padOn("hemo.inlet", hemoBody, G.add3([HEMO[0], HEMO[1], HEMO_IN_Z], G.mul3(toHemo, -(5.5 - 0.4))), G.mul3(toHemo, -1), 2.2, 4);
const toRes = G.unit3([RES[0] - HEMO[0], RES[1] - HEMO[1], 0]);
const HEMO_OUT_Z = 193;
const hemoOut = padOn("hemo.outlet", hemoBody, G.add3([HEMO[0], HEMO[1], HEMO_OUT_Z], G.mul3(toRes, 5.5 - 0.4)), toRes, 2.2, 4);
const resHemo = padOn("res.hemo-in", resShell, G.add3([RES[0], RES[1], HEMO_OUT_Z], G.mul3(toRes, -(RES_R - 0.6))), G.mul3(toRes, -1), 2.2, 4);
const hemoUf = padOn("hemo.uf-port", hemoBody, [HEMO[0] - 5 + 0.4, HEMO[1], 154], [-1, 0, 0], 1.6, 4);
mastClamp("hemo");
box("hemo.arm", { x: HEMO[0] + 5, y: HEMO[1], w: MAST[0] - 6 - HEMO[0] - 5, d: 4, r: 1 }, CLAMPS.hemo + 3, 4, { tone: "mid" });
// the ultrafiltrate collects in a canister on the deck
const UF = [46, HEMO[1]];
const UFF = VERT(...UF);
cyl("uf.canister", UF[0], UF[1], 6, DECK_Z, 28, { tone: "hi" }, { bevel: 0.5, inner: Ln(G.arcOf(UFF, DECK_Z + 8, 6, P) + G.arcOf(UFF, DECK_Z + 16, 6, P), { tone: "faint" }) });
disc("uf.lid", UFF, DECK_Z + 28, DECK_Z + 30, 6.6, { tone: "mid" }, { bevel: 0.3 });
disc("uf.port", UFF, DECK_Z + 30, DECK_Z + 34, 1.6, { tone: "hi" });
const ufTop = [UF[0], UF[1], DECK_Z + 34];

// ---------- cardioplegia: crystalloid bag, the 4:1 head, a mixing manifold, heat exchanger and bubble trap ----------
// the bag hangs behind the head, left of the reservoir; its pole stands off to the left so the line drops clear of it
const BAG_X = CP.c[0] - 15;
const BAG_POLE = [BAG_X - 14, -58];
cyl("cp.pole-foot", BAG_POLE[0], BAG_POLE[1], 4, DECK_Z, 2.5, { tone: "mid" }, { bevel: 0.3 });
cyl("cp.pole", BAG_POLE[0], BAG_POLE[1], 1.6, DECK_Z + 2.5, 252 - DECK_Z - 2.5, { tone: "mid" }, { steps: 16 });
const BAG = { x: BAG_X - 12, y: BAG_POLE[1] + 3.6, w: 24, d: 5, r: 2.4 };
box("cp.hook", { x: BAG_POLE[0] - 1.2, y: BAG_POLE[1] - 1.2, w: BAG_X + 1.2 - BAG_POLE[0] + 1.2, d: 2.4, r: 0.8 }, 252, 2.4, { tone: "mid" }, { bevel: 0.2 });
box("cp.hook", { x: BAG_X - 1.2, y: BAG_POLE[1] + 1.2, w: 2.4, d: BAG.y + 3.9 - BAG_POLE[1] - 1.2, r: 0.8 }, 252, 2.4, { tone: "mid" }, { bevel: 0.2 });
box("cp.hanger", { x: BAG_X - 1.6, y: BAG.y + 1.5, w: 3.2, d: 2, r: 0.6 }, 244, 8, { tone: "mid" }, { bevel: 0.2 });
const bagFront = BAG.y + BAG.d;
const bagRules = [0, 1, 2].map((row) => k.pathOf([at([BAG.x + 5, bagFront, 234 - row * 3.4]), at([BAG.x + (row === 1 ? 15 : 19), bagFront, 234 - row * 3.4])]));
box("cp.bag", BAG, 206, 38, { tone: "hi" }, {
  steps: 4,
  bevel: 0.8,
  extra: Ln(bagRules.join(""), { tone: "lo", free: true }) + k.faceTextSvg(k.sideMatrix([BAG.x + 5, bagFront], 238.5, P, "left"), "CRYSTALLOID", { size: 1.9, tone: "mid" }),
});
const SPIKE = VERT(BAG_X, BAG.y + BAG.d / 2);
disc("cp.spike", SPIKE, 200, 206, 1.4, { tone: "mid" });
const bagOut = [BAG_X, BAG.y + BAG.d / 2, 200];
// the two boots come out of the head side by side and meet in a mixing manifold just above the deck
const MANI = { x: CP.x1 + 4, y: LANE_Y - 3, w: 14, d: 6, r: 1.2 };
const MANI_Z0 = 122;
const MANI_Z1 = 128;
const maniShape = box("cp.manifold", MANI, MANI_Z0, MANI_Z1 - MANI_Z0, { tone: "hi" }, { bevel: 0.4 });
const MANI_IN = {};
for (const [id, tube] of Object.entries(CP_TUBES)) MANI_IN[id] = padOn(`cp.manifold-${id}`, maniShape, [tube.riser, LANE_Y, MANI_Z0 + 0.4], [0, 0, -1], tube.r + 0.6, 3).end;
const HX_X = MANI.x + MANI.w / 2;
const maniOut = padOn("cp.manifold-out", maniShape, [HX_X, LANE_Y, MANI_Z1 - 0.4], [0, 0, 1], 2.2, 3).end;
const HX = VERT(HX_X, LANE_Y);
const HX_Z = [150, 180];
turned("cp.hx", HX, [[HX_Z[0], 2.2], [HX_Z[0] + 3, 2.2], [HX_Z[0] + 5, 5.4, 1], [HX_Z[0] + 7, 6], [HX_Z[1] - 7, 6], [HX_Z[1] - 5, 5.4, 1], [HX_Z[1] - 3, 2.2], [HX_Z[1], 2.2]], { tone: "hi" }, {
  inner: Ln(G.arcOf(HX, (HX_Z[0] + HX_Z[1]) / 2, 6, P), { tone: "faint" }),
});

// ---------- the cannulation-site panel ----------
const PANEL_X = [PANEL.x + PANEL.w / 2, 0];
cyl("stand.panel-foot", PANEL_X[0], PANEL_X[1], 16, 0, 3, { tone: "mid" }, { bevel: 0.8, extra: Dots(G.dotsOf(VERT(...PANEL_X), 3, 13, 8, P, { all: true }), { size: 0.4 }) });
cyl("stand.panel-collar", PANEL_X[0], PANEL_X[1], 5, 3, 5, { tone: "mid" });
cyl("stand.panel-rod", PANEL_X[0], PANEL_X[1], 2.8, 8, PANEL_Z0 - 8, { tone: "mid" }, { steps: 20 });
const panelFront = PANEL.y + PANEL.d;
box("panel.board", PANEL, PANEL_Z0, PANEL_Z1 - PANEL_Z0, { tone: "mid" }, {
  steps: 3,
  bevel: 0.6,
  extra:
    Dots([[PANEL.x + 4, PANEL_Z1 - 4], [PANEL.x + PANEL.w - 4, PANEL_Z1 - 4], [PANEL.x + 4, PANEL_Z0 + 4], [PANEL.x + PANEL.w - 4, PANEL_Z0 + 4]].map(([x, z]) => at([x, panelFront, z])), { size: 0.5 }) +
    k.faceTextSvg(k.sideMatrix([PANEL.x + 6, panelFront], PANEL_Z1 - 9.4, P, "left"), "插管位置 · CANNULATION SITES", { size: 3.6, tone: "lo" }),
});
const SITE_PORT = {};
for (const [id, site] of Object.entries(SITES)) {
  const F = G.frameOf([PANEL.x, 0, site.z], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
  disc(`panel.${id}-boss`, F, 0, 2.6, 3.6, { tone: "mid" }, { bevel: 0.3 });
  disc(`panel.${id}-conn`, F, 2.6, 6.4, 2.9, { tone: "hi" });
  SITE_PORT[id] = [PANEL.x - 6.4, 0, site.z];
  const plate = { x: PANEL.x + 6, y: panelFront, w: PANEL.w - 12, d: 0.8, r: 0.4 };
  box(`panel.${id}-plate`, plate, site.z - 5.4, 10.8, { tone: "mid" }, {
    steps: 2,
    bevel: 0.2,
    extra:
      k.faceTextSvg(k.sideMatrix([plate.x + 2.6, plate.y + plate.d], site.z + 0.5, P, "left"), site.zh, { size: 5, tone: "hi" }) +
      k.faceTextSvg(k.sideMatrix([plate.x + 2.6, plate.y + plate.d], site.z - 4, P, "left"), site.en, { size: 3.4, tone: "hi" }),
  });
}
// near the panel: the cardioplegia line splits for the aortic root and the coronary sinus,
// and the two caval lines join into one venous line
const SPLIT_X = PANEL.x - 20;
const split = cyl("cp.splitter", SPLIT_X, 0, 3.5, SITES.cs.z - 4, SITES.root.z - SITES.cs.z + 10, { tone: "hi" }, { bevel: 0.4 });
const splitIn = padOn("cp.split-in", split, [SPLIT_X - 3.1, 0, SITES.root.z], [-1, 0, 0], 2.2, 4).end;
const splitOut = {
  root: padOn("cp.split-root", split, [SPLIT_X + 3.1, 0, SITES.root.z], [1, 0, 0], 2.2, 4).end,
  cs: padOn("cp.split-cs", split, [SPLIT_X + 3.1, 0, SITES.cs.z], [1, 0, 0], 2.2, 4).end,
};
const vman = cyl("venous.y", SPLIT_X, 0, 3.8, SITES.ivc.z - 6, SITES.svc.z - SITES.ivc.z + 12, { tone: "hi" }, { bevel: 0.4 });
const V_JOIN_Z = (SITES.svc.z + SITES.ivc.z) / 2;
const vmanIn = {
  svc: padOn("venous.y-svc", vman, [SPLIT_X + 3.4, 0, SITES.svc.z], [1, 0, 0], 2.8, 4).end,
  ivc: padOn("venous.y-ivc", vman, [SPLIT_X + 3.4, 0, SITES.ivc.z], [1, 0, 0], 2.8, 4).end,
};
const vmanOut = padOn("venous.y-out", vman, [SPLIT_X - 3.4, 0, V_JOIN_Z], [-1, 0, 0], 3.4, 4).end;

// ---------- the circuit ----------
// one route per line, filleted at every corner; the boots are part of the lines that run through the pumps
const routeOf = (control, r, bend = 2.8) => G.fillet(control, Math.max(r * bend, 3), r > 2 ? 16 : 10, { P, tube: r });
// cut a pumped line's chunks where it passes the raceway's open mouth, so none sits half in the well
function crossingsAt(route, x) {
  const out = [];
  let s = 0;
  for (let index = 0; index < route.length - 1; index++) {
    const a = route[index];
    const b = route[index + 1];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if ((a[0] - x) * (b[0] - x) < 0) out.push(s + (length * (x - a[0])) / (b[0] - a[0]));
    s += length;
  }
  return out;
}
function pumped(pump, before, after, { riser = pump.riser, tz = pump.tz } = {}) {
  const inY = legY(pump, pump.inLeg);
  const outY = legY(pump, outLeg(pump));
  return [...before, [riser, inY, tz], ...bootOf(pump, tz), [riser, outY, tz], ...after];
}
// field sucker, aortic root vent and LV vent: down from the panel onto the pump's front leg, out of the back leg, up and home to the reservoir
for (const id of ["sucker", "rootvent", "vent"]) {
  const pump = PUMPS[id];
  const site = id === "sucker" ? "field" : id;
  const control = pumped(pump, [SITE_PORT[site], [pump.riser, LANE_Y, SITES[site].z]], [[pump.riser, RETURN_Y, RET_Z[id]], RETURN_PORT[id]]);
  const route = routeOf(control, pump.tube);
  tubeItems(`circuit.${id}`, route, pump.tube, { cls: "cpb-v", into: WELLS[id].well, touch: [`${id}.race`, `${id}.body`], breaks: crossingsAt(route, pump.x1 + 1.5) });
}
// cardioplegia, crystalloid: bag, down behind the head, in over the blood boot, out and up into the manifold
{
  const t = CP_TUBES.crystal;
  const control = pumped(CP, [bagOut, [bagOut[0], bagOut[1], 150], [t.riser, CP.back, 128]], [MANI_IN.crystal], t);
  const route = routeOf(control, t.r);
  tubeItems("circuit.cp-crystal", route, t.r, { cls: "cpb-c", into: WELLS.cardio.well, touch: ["cardio.race", "cardio.body"], breaks: crossingsAt(route, CP.x1 + 1.5) });
}
// cardioplegia, blood: off the oxygenator, across in front of the reservoir stem, down behind the head, in under the crystalloid
{
  const t = CP_TUBES.blood;
  const control = pumped(CP, [oxyCp.end, CPB_P1, [t.riser, CP.back, CPB_Z]], [MANI_IN.blood], t);
  const route = routeOf(control, t.r);
  tubeItems("circuit.cp-blood", route, t.r, { cls: "cpb-a", into: WELLS.cardio.well, touch: ["cardio.race", "cardio.body"], breaks: crossingsAt(route, CP.x1 + 1.5) });
}
// mixed 4:1 cardioplegia: manifold, heat exchanger, up and across to the splitter, then root or coronary sinus
line("circuit.cp-mix", [maniOut, [HX_X, LANE_Y, HX_Z[0]]], 1.6, { cls: "cpb-m" });
line("circuit.cp-line", [[HX_X, LANE_Y, HX_Z[1]], [HX_X, LANE_Y, SITES.root.z], splitIn], 1.6, { cls: "cpb-m" });
const CP_LIMB = {};
for (const id of ["root", "cs"]) CP_LIMB[id] = line(`circuit.cp-${id}`, [splitOut[id], SITE_PORT[id]], 1.6, { cls: `cpb-m cpb-limb-${id}` });
// venous: the two caval lines join, then downhill back to the reservoir and straight down into its lid
for (const id of ["svc", "ivc"]) line(`circuit.${id}`, [SITE_PORT[id], vmanIn[id]], 2.2, { cls: "cpb-v" });
const vTop = [RES[0], RES[1], vPortTop];
const V_OVER = vPortTop + 26;
line("circuit.venous", [vmanOut, [vmanOut[0] - 6, LANE_Y, V_OVER], [RES[0] + 24, RES[1], V_OVER], [RES[0], RES[1], V_OVER], vTop], 2.8, { cls: "cpb-v" });
// reservoir stem straight down into the pump head's inlet, pump head to oxygenator
line("circuit.pump-in", [[RES[0], RES[1], STEM_Z], pumpInTop], 2.6, { cls: "cpb-v" });
line("circuit.pump-out", [driveOut.end, oxyIn.end], 2.6, { cls: "cpb-v" });
// oxygenator to arterial filter
line("circuit.oxy-filter", [oxyOut.end, filIn.end], 2.2, { cls: "cpb-a" });
// arterial line: filter outlet, along under the panel, up into the ascending-aorta port
const filOut = [FIL[0], FIL[1], 112 + FZ];
const LOW = 104;
line("circuit.arterial", [filOut, [FIL[0], FIL[1], LOW], [RISER[0], RISER[1], LOW], [RISER[0], RISER[1], SITES.aorta.z], SITE_PORT.aorta], 2.2, { cls: "cpb-a" });
// hemoconcentrator: arterial blood in, concentrated blood back to the reservoir, ultrafiltrate down to the canister
line("circuit.hemo-in", [oxyHemo.end, hemoIn.end], 1.6, { cls: "cpb-a" });
line("circuit.hemo-out", [hemoOut.end, resHemo.end], 1.6, { cls: "cpb-a" });
line("circuit.uf", [hemoUf.end, [UF[0], UF[1], hemoUf.end[2]], ufTop], 1.2, { cls: "cpb-uf" });
// vacuum: regulator down to the reservoir lid
const vacFrom = G.add3(VAC_OUT.o, [0, 4, 0]);
line("vavd.line", [vacFrom, [VAC_AT[0], VAC_AT[1], vacFrom[2]], [VAC_AT[0], VAC_AT[1], vacTop]], 1.2, { tone: "mid", bend: 4 });
// sweep gas: blender down past the reservoir to the oxygenator
line("gas.line", [[GAS_OUT.o[0], GAS_OUT.o[1], 232], [GAS_OUT.o[0], GAS_OUT.o[1], 168], G.add3(gasIn.end, G.mul3(toGas, 5)), gasIn.end], 1.0, { tone: "mid", bend: 4 });

// ---------- the pump wells, now that their tubes are in ----------
for (const [id, { pump, well, raceSvg, raceShape, hubShape, clip }] of Object.entries(WELLS)) {
  const [cx, cy] = pump.c;
  const rotor = rotorParts(pump, 0.6);
  const lit = false;
  const rollerSvg = rotor.rollers.map(([x, y], index) => `<g data-roller="${index}" data-k="${G.dot3([x, y, MOD_Z1 + 6], V).toFixed(2)}">${S(k.cylinder(x, y, pump.roller, MOD_Z1 + 0.6, RACE_H, P, 24), { tone: "hi", lit })}</g>`);
  const mids = well.items.map((item) => `<g data-k="${item.key.toFixed(2)}">${item.svg}</g>`);
  const hubSvg = `<g data-k="${G.dot3([cx, cy, MOD_Z1 + 6], V).toFixed(2)}">${S(k.cylinder(cx, cy, pump.hub, MOD_Z1, RACE_H + 0.6, P, 28), { tone: "hi" })}</g>`;
  const sorted = [...mids, ...rollerSvg, hubSvg].sort((a, b) => Number(a.match(/data-k="([-\d.]+)"/)[1]) - Number(b.match(/data-k="([-\d.]+)"/)[1]));
  const clipId = `cpb-front-${id}`;
  const top = RACE_Z1 + 0.6;
  const svg = [
    `<g data-pump="${id}">`,
    raceSvg,
    `<g data-mid>${sorted.join("")}</g>`,
    `<clipPath id="${clipId}"><path d="${clip}"/></clipPath><g clip-path="url(#${clipId})">${raceSvg}</g>`,
    `<g data-bar>${S(k.extrude(rotor.bar, top, 2.4, P, { bevel: 0.3 }), { tone: "hi", lit })}</g>`,
    S(k.cylinder(cx, cy, pump.hub * 0.62, top + 2.4, 2.6, P, 24, 0.3), { tone: "mid" }),
    Ln(k.knurl(cx, cy, pump.hub * 0.62, top + 2.4, top + 5, 18, P), { tone: "lo" }),
    `<g data-caps>${Dots(rotor.rollers.map(([x, y]) => at([x, y, top + 2.4])), { size: 0.55, tone: "hi" })}</g>`,
    `</g>`,
  ].join("");
  put(`${id}.well`, [cx, cy, MOD_Z1 + RACE_H / 2], svg, { shapes: [raceShape, hubShape, ...well.items.flatMap((item) => item.shapes)] });
}

// ---------- assemble ----------
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item) => `<g class="it">${item.svg}</g>`);

const LABEL_TEXT =
  "人工心肺機進階配置的等角剖析圖：推車式主機上一排四個滾輪泵 (roller pump)——抽吸泵、主動脈根部減壓泵、左心減壓泵、4:1 血液心麻痺液泵——以及離心動脈泵 (centrifugal pump) 的控制台與驅動器；立柱上有硬殼靜脈儲血槽、膜式氧合器、動脈過濾器、血液濃縮器、氣體混合器與負壓輔助靜脈引流調節器。右側標示板列出八個插管位置：心包腔、主動脈根部減壓、右上肺靜脈到左心室、主動脈根部順行灌注、冠狀竇逆行灌注、上腔靜脈、下腔靜脈、升主動脈。";
const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: [...back, ...groups] });

const DATA = {
  P,
  V,
  M: {
    RPM_MAX: M.RPM_MAX,
    RPM_FULL: M.RPM_FULL,
    RPM_ZERO: M.RPM_ZERO,
    HEAD_A: M.HEAD_A,
    LOSS_K: M.LOSS_K,
    MAP: M.MAP,
    BSA: M.BSA,
    CI_FULL: M.CI_FULL,
    CP_BLOOD_ML: M.CP_BLOOD_ML,
    CP_CRYSTAL_ML: M.CP_CRYSTAL_ML,
    GRAVITY_MMHG: M.GRAVITY_MMHG,
    GRAVITY_FLOW: M.GRAVITY_FLOW,
    VAVD_MMHG: M.VAVD_MMHG,
    PRIME_ML: M.PRIME_ML,
    LAG_S: M.LAG_S,
    RES_MAX_ML: M.RES_MAX_ML,
    RPM: { cardio: M.RPM_CP_ANTEGRADE, retro: M.RPM_CP_RETROGRADE, vent: M.RPM_VENT, rootvent: M.RPM_ROOT_VENT, sucker: M.RPM_SUCKER },
  },
  res: { x: RES[0], y: RES[1], r: RES_R, z0: RES_Z0, z1: RES_Z1, span: RES_Z1 - RES_Z0 - 3 },
  pumps: Object.fromEntries(
    Object.entries(PUMPS).map(([id, p]) => [id, { c: p.c, rc: p.rc, roller: p.roller, hub: p.hub, z0: MOD_Z1 + 0.6, h: RACE_H, top: RACE_Z1 + 0.6, dir: p.dir, stroke: p.stroke, knob: { o: p.knob.o, a: p.knob.a, u: p.knob.u, v: p.knob.v } }]),
  ),
  drive: { c: DRIVE.c, head: HEAD_Z, knob: { o: DK.o, a: DK.a, u: DK.u, v: DK.v } },
  gauge: { o: GAUGE.o, a: GAUGE.a, u: GAUGE.u, v: GAUGE.v, r: GAUGE_R },
};
const CSS = readFileSync(join(HERE, "cpb.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const f1 = (value) => value.toFixed(1);
const f2 = (value) => value.toFixed(2);
const r0 = (value) => Math.round(value);
const r10 = (value) => Math.round(value / 10) * 10;
const caption =
  `這是成人心臟手術常見的完整配置。和基本四泵機相比有六處不同。` +
  `一、動脈泵改用離心泵 (centrifugal pump)：靠葉輪 (impeller) 旋轉產生壓力，不是壓閉式 (non-occlusive)，所以流量取決於轉速與阻力。` +
  `泵頭壓力與轉速平方成正比 (affinity law)；以 Rotaflow 在 ${M.RPM_MAX} rpm 可達 806 mmHg、最大流量約 9 L/min 推算，平均動脈壓 (mean arterial pressure, MAP) ${M.MAP} mmHg 時全流量 ${f2(M.FLOW_FULL)} L/min 約需 ${r10(M.RPM_FULL)} rpm；` +
  `轉速低於約 ${r10(M.RPM_ZERO)} rpm 時泵頭壓力撐不住病人的血壓，血液會倒流回機器，所以停泵或低轉速前要先夾住動脈管路。MAP 升高時，同一轉速的流量會下降。` +
  `二、血液心麻痺液 (blood cardioplegia) 4:1：同一個滾輪泵頭裝兩條管，1/4 吋血液管與 1/8 吋晶體液管被同一對滾輪擠壓，每轉推出的量就是管腔面積比 (1/4 ÷ 1/8)² = 4:1（血液 ${f1(M.CP_BLOOD_ML)} mL + 晶體液 ${f1(M.CP_CRYSTAL_ML)} mL）。` +
  `血液取自氧合器出口，兩路在混合器會合後經熱交換器與氣泡過濾，再分成順行（主動脈根部，${M.RPM_CP_ANTEGRADE} rpm，${f2((M.RPM_CP_ANTEGRADE * M.CP_STROKE_ML) / 1000)} L/min）與逆行（冠狀竇 coronary sinus，${M.RPM_CP_RETROGRADE} rpm，${f2((M.RPM_CP_RETROGRADE * M.CP_STROKE_ML) / 1000)} L/min，冠狀竇壓通常維持在 40 mmHg 以下）。` +
  `三、上下腔靜脈雙插管 (bicaval cannulation)：上腔與下腔各一支插管，在 Y 接頭會合成一條靜脈管，打開右心房 (right atrium) 時可束緊兩條腔靜脈，常用於二尖瓣、三尖瓣與心房中膈手術。` +
  `四、負壓輔助靜脈引流 (vacuum-assisted venous drainage, VAVD)：密閉的硬殼儲血槽接上調壓負壓，儲血槽蓋上有正負壓釋放閥 (relief valve)。這裡假設單靠重力（約 ${M.GRAVITY_MMHG} mmHg 落差）最多引流 ${f1(M.GRAVITY_FLOW)} L/min；加上 −${M.VAVD_MMHG} mmHg 後，引流上限依壓差平方根增加到 ${f1(M.drainCap(M.VAVD_MMHG))} L/min。` +
  `五、主動脈根部減壓 (aortic root vent)：灌完順行心麻痺液後，用同一支根部插管的側支抽出主動脈根部的血與空氣，與左心減壓、抽吸一起回到儲血槽。` +
  `六、血液濃縮器 (hemoconcentrator)：從動脈側引一小股血流過中空纖維，濾出水分與小分子 (ultrafiltrate) 到收集罐，濃縮後的血回到儲血槽。` +
  `儲血槽液面為簡化模型：靜脈回流以 ${M.LAG_S} 秒時間常數追上進入病人的量，但不超過當下的引流上限，差額暫存在病人血管內；晶體心麻痺液會讓液面慢慢升高。實際參數依器材與各院體外循環常規。`;
const swatch = (cls) => `<svg class="iso-swatch ${cls}" viewBox="0 0 16 10" aria-hidden="true"><path d="M1.5 5h13"/></svg>`;
const KEYS = [
  [`<svg class="iso-swatch" data-mark="lit" viewBox="0 0 16 10" aria-hidden="true"><path d="M2 4.5 8 1.5 14 4.5 14 6 8 9 2 6Z"/><path class="iso-swatch-crease" d="M2 4.5 8 7.5 14 4.5"/></svg>`, `離心泵泵頭：${r10(M.RPM_FULL)} rpm ≈ ${f2(M.FLOW_FULL)} L/min`],
  [swatch("cpb-swatch-v"), "靜脈血：上下腔靜脈、減壓、抽吸 → 儲血槽 → 離心泵 → 氧合器"],
  [swatch("cpb-swatch-a"), "動脈血：氧合器 → 過濾器 → 升主動脈；也供應心麻痺液與血液濃縮器"],
  [swatch("cpb-swatch-c"), "晶體心麻痺液"],
  [swatch("cpb-swatch-m"), "4:1 血液心麻痺液 → 主動脈根部或冠狀竇"],
];
const legend = `<figcaption class="iso-legend"><span class="iso-keys">${KEYS.map(([mark, label]) => `<span class="iso-key">${mark}${label}</span>`).join("")}</span><span class="iso-caption">${caption}</span></figcaption>`;
const plate = k
  .plateHtml({
    fig: "Fig 2",
    title: "進階配置 · advanced CPB circuit",
    hint: "拖曳 ← → 離心泵 · 點泵頭開關",
    readout: `停機 · 0 rpm · 0.00 L/min · CI 0.00 · MAP ${M.MAP}`,
    keys: [],
    body: `<div class="iso-stage cpb-stage" tabindex="0" role="slider" aria-label="進階人工心肺機：左右方向鍵調整離心泵轉速（按住 Shift 一次 500 rpm），End 全流量，Home 全部停機；K 夾住或放開動脈管路；C 開關心麻痺液泵，R 切換順行與逆行；V 左心減壓泵，O 主動脈根部減壓泵，S 抽吸泵；A 開關負壓輔助引流；在圖上左右拖曳也可調整離心泵轉速，點滾輪泵頭可開關" aria-valuemin="0" aria-valuemax="${M.RPM_MAX}" aria-valuenow="0" aria-valuetext="停機">${svg}</div>`,
  })
  .replace(/<\/figure>$/, `${legend}</figure>`);
const intro = `<header class="cpb-head"><p class="cpb-back"><a href="./">← 回到目錄</a></p><h1>人工心肺機：進階配置</h1><p>離心動脈泵、4:1 血液心麻痺液（順行與逆行）、上下腔靜脈雙插管、負壓輔助靜脈引流、主動脈根部減壓與血液濃縮器。右側標示板標出八條管路各自接在病人身上的位置。在圖上左右拖曳或用方向鍵調整離心泵轉速；K 夾管，C／R 心麻痺液與灌注方向，V／O／S 三個減壓與抽吸泵，A 負壓引流。</p></header>`;
const body = intro + plate;
// lock-screen wallpaper: the figure alone, every line in its colour, the machine running at full flow
if (process.argv.includes("--wallpaper")) {
  const light = process.argv.includes("--light");
  const wall = `<style>${CSS}</style><div class="iso-stage cpb-stage cpb-wall">${svg}</div><div class="cpb-hidden"><span data-readout></span></div>`;
  const name = join(process.env.CPB_WALL_DIR ?? join(HERE, "..", "..", "wallpaper"), light ? "wallpaper-light.html" : "wallpaper.html");
  const html = k
    .pageHtml({ title: "人工心肺機桌布", theme: light ? "light" : "dark", body: wall, script: kitScript() + LIVE, width: 402 })
    .replace('<html lang="en">', '<html lang="zh-Hant">')
    .replace('<body class="iso"', '<body class="iso cpb-soft" data-wallpaper');
  mkdirSync(dirname(name), { recursive: true });
  writeFileSync(name, html);
  console.log("wrote", name);
  process.exit(0);
}
const OUT = process.env.CPB_OUT ?? join(HERE, "..", "..", "cpb-advanced.html");
const page = k
  .pageHtml({ title: "人工心肺機進階配置 · Advanced CPB circuit", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + LIVE, width: 1000 })
  .replace('<html lang="en">', '<html lang="zh-Hant">')
  // one file for both themes: follow the reader's system setting, light when unknown
  .replace(/(<body class="iso" data-theme=")[a-z]+(">)/, `$1${THEME}$2<script>try{const m=matchMedia("(prefers-color-scheme: dark)");const t=()=>{document.body.dataset.theme=m.matches?"dark":"light"};t();m.addEventListener("change",t)}catch(e){}</script>`)
  .replace("html{color-scheme:dark}", "html{color-scheme:light dark}");
writeFileSync(OUT, page);
console.log("wrote", OUT, `${R.items.length} items`, `${R.solids.length} solids`, `${R.tubes.length} tubes`);
A.auditOrExit(R, P, { allow: [] });

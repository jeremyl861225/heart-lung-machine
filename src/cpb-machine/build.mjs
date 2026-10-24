// Builds ../../cpb-machine.html with the anatomy skill's kit (github.com/wheresryan22/anatomy, MIT).
// Clone it to src/anatomy, or point ANATOMY_DIR at a copy, then: node src/cpb-machine/build.mjs [--audit]
import { readFileSync, writeFileSync } from "node:fs";
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
const H = 820;
const AZIMUTH = 52;
const ELEVATION = 28;

// ---------- world layout ----------
const PLATE = { x: -254, y: -84, w: 474, d: 156, r: 10 };
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
const ROW_Y = -13.4;
const SMALL = { s: 46, rin: 15, tube: 1.6, roller: 3, hub: 4.2 };
const PUMPS = {
  sucker: { ...SMALL, c: [-201, ROW_Y], label: "SUCKER", inLeg: "front", stroke: M.SMALL_STROKE_ML },
  vent: { ...SMALL, c: [-137, ROW_Y], label: "LV VENT", inLeg: "front", stroke: M.SMALL_STROKE_ML },
  cardio: { ...SMALL, c: [-73, ROW_Y], label: "CARDIOPLEGIA", inLeg: "back", stroke: M.SMALL_STROKE_ML },
  arterial: { s: 64, rin: 22, tube: 2.6, roller: 4, hub: 5.6, c: [0, ROW_Y], label: "ARTERIAL", inLeg: "back", stroke: M.STROKE_ML },
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
const ART = PUMPS.arterial;
const LANE_Y = PUMPS.sucker.front; // the table lines run in this plane, straight down onto the pumps' front legs
const RETURN_Y = PUMPS.sucker.back; // sucker and vent blood goes back to the reservoir along this plane, behind the pumps
const MAST = [70, -52];
const MAST_R = 4.5;
const MAST_TOP = 272;
const UP = [0, 0, 1];
const VERT = (x, y) => G.frameOf([x, y, 0], UP, [1, 0, 0], [0, 1, 0]);

// the cannulation-site panel: one port per site, each with an engraved plate
const PANEL = { x: 146, y: -2, w: 88, d: 4, r: 1.2 };
const PANEL_Z0 = 224;
const PANEL_Z1 = 310;
const SITES = {
  field: { z: 290, zh: "心包腔", en: "Pericardial field" },
  vent: { z: 276, zh: "右上肺靜脈 → 左心室", en: "RSPV → LV" },
  root: { z: 262, zh: "主動脈根部", en: "Aortic root" },
  ra: { z: 248, zh: "右心房", en: "Right atrium" },
  aorta: { z: 234, zh: "升主動脈", en: "Ascending aorta" },
};

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [MAST[0], MAST[1], MAST_TOP + 6], [PANEL.x, 0, PANEL_Z1 + 2], [PANEL.x + PANEL.w, 0, PANEL_Z1 + 2], [-160, 0, SITES.field.z + 8]],
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
function tubeItems(name, route, r, { tone = "hi", bias = 0, maxLength = 14, spacing = 1.2, owner, touch, limp = false, breaks = [], gaps = [], caps = true, rims, cls = "", ends = [true, true], into } = {}) {
  const id = nameFor(name);
  R.route(id, route, r, { owner: owner ?? id, touch, limp, gaps, rims, ends, piece: id.split(".")[0] });
  ROUTES[id] = route;
  tubePieces(route, r, P, { maxLength, spacing, breaks, gaps, caps }).forEach((part, index) => {
    const svg = cls ? `<g class="${cls}">${tubeSvg(part, { tone })}</g>` : tubeSvg(part, { tone });
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
function knobPointer(F, turn) {
  const a = -Math.PI * 0.75 + turn * Math.PI * 1.5;
  return k.pathOf([at(G.pointOf(F, 6.65, 1.2, a)), at(G.pointOf(F, 6.65, 3.9, a))]);
}
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
function bootOf(pump) {
  const [cx, cy] = pump.c;
  const arc = [];
  for (let step = 0; step <= 24; step++) {
    const a = (90 + 180 * (step / 24)) * DEG * (pump.inLeg === "front" ? 1 : -1);
    arc.push([cx + pump.tc * Math.cos(a), cy + pump.tc * Math.sin(a), pump.tz]);
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
const CLAMPS = { oxy: 120, filter: 131, res: 191, gas: 244 };
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

// ---------- venous reservoir: hard shell, the blood level shows through it ----------
const RES = [ART.x1 + 14, ART.back]; // right over the arterial pump's inlet leg
const RES_R = 19;
const RES_Z0 = 138;
const RES_Z1 = 194;
const STEM_Z = RES_Z0 - 22; // the outlet stem's lower end, where the pump line slides on
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
box("res.arm", { x: RES[0] - 4, y: RES[1] - RES_R - 1.5 - 4.1, w: MAST[0] - 6 - RES[0] + 4, d: 4, r: 1 }, RES_Z1 + 0.5, 3, { tone: "mid" });
// lid: the venous inlet in the middle, two capped spare luers
const vPortTop = RES_Z1 + 12;
disc("res.venous-port", RESF, RES_Z1 + 4, vPortTop, 4.4, { tone: "hi" }, { extra: Ln(G.circleOf(RESF, vPortTop, 2.9, P), { tone: "faint" }) });
for (const [dx, dy] of [
  [11, 7],
  [-9, 10],
]) {
  const F = VERT(RES[0] + dx, RES[1] + dy);
  disc("res.port", F, RES_Z1 + 4, RES_Z1 + 8, 2.4, { tone: "hi" });
  disc("res.cap", F, RES_Z1 + 8, RES_Z1 + 10, 2.9, { tone: "mid" }, { bevel: 0.3 });
}
// cardiotomy inlets on the left of the shell: the sucker and vent lines come home here
const RETURN_PORT = {};
const RET_Z = { sucker: RES_Z1 - 10, vent: RES_Z1 - 22 };
for (const [id, z] of Object.entries(RET_Z)) {
  const side = Math.sqrt(RES_R ** 2 - (RETURN_Y - RES[1]) ** 2);
  RETURN_PORT[id] = padOn(`res.${id}-in`, resShell, [RES[0] - side + 0.6, RETURN_Y, z], [-1, 0, 0], 2.2, 4).end;
}

// ---------- membrane oxygenator with heat exchanger ----------
const OXY = [66, ART.front];
const OXY_R = 14;
const OXYF = VERT(...OXY);
disc("oxy.base", OXYF, 98, 102, OXY_R + 1.5, { tone: "mid" }, { bevel: 0.5 });
const oxyBody = [
  turned("oxy.body", OXYF, [[102, OXY_R], [122, OXY_R]], { tone: "hi" }, { inner: Ln(G.arcOf(OXYF, 112, OXY_R, P), { tone: "faint" }) }),
  disc("oxy.band", OXYF, 122, 128, OXY_R + 2.4, { tone: "mid" }),
  turned("oxy.body", OXYF, [[128, OXY_R], [152, OXY_R]], { tone: "hi" }, { inner: Ln(G.arcOf(OXYF, 140, OXY_R, P), { tone: "faint" }) }),
];
disc("oxy.top", OXYF, 152, 156, OXY_R + 1.5, { tone: "mid" }, { bevel: 0.5 });
disc("oxy.gas-in", OXYF, 156, 161, 2, { tone: "hi" });
const gasIn = [OXY[0], OXY[1], 161];
disc("oxy.exhaust", OXYF, 92, 98, 2.6, { tone: "hi" });
const oxyIn = padOn("oxy.inlet", oxyBody, G.pointOf(OXYF, ART.tz, OXY_R - 0.6, Math.PI), [-1, 0, 0], 3.6, 5);
// the arterial line rises straight across the screen from the filter, so both its bends face the viewer
const RISER = [124, LANE_Y];
const FIL = [RISER[0] - RIGHT[0] * 24, RISER[1] - RIGHT[1] * 24];
const FZ = 7;
const toFilter = G.unit3([FIL[0] - OXY[0], FIL[1] - OXY[1], 0]);
const oxyOut = padOn("oxy.outlet", oxyBody, G.add3([OXY[0], OXY[1], 140 + FZ], G.mul3(toFilter, OXY_R - 0.6)), toFilter, 3.2, 5);
mastClamp("oxy", "side");
// the mast stands right behind the oxygenator: one straight arm from the clamp's front face to the band
box("oxy.arm", { x: OXY[0] + 4, y: MAST[1] + 6, w: 4, d: OXY[1] - Math.sqrt((OXY_R + 2.4) ** 2 - 16) - 0.1 - (MAST[1] + 6), r: 1 }, 122, 6, { tone: "mid" });

// ---------- heater-cooler: water through the oxygenator's heat exchanger ----------
const HC = { x: 96, y: 12, w: 56, d: 40, r: 3 };
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
const toHc = G.unit3([HC.x + HC.w / 2 - OXY[0], HC.y + HC.d / 2 - OXY[1], 0]);
const hcAngle = Math.atan2(toHc[1], toHc[0]);
[-0.3, 0.3].forEach((da, index) => {
  const n = [Math.cos(hcAngle + da), Math.sin(hcAngle + da), 0];
  const port = padOn("oxy.water", oxyBody, G.add3([OXY[0], OXY[1], 116], G.mul3(n, OXY_R - 0.4)), n, 2.2, 4);
  const cx = port.end[0] + toHc[0] * 28;
  const cy = port.end[1] + toHc[1] * 28;
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
const GAS_OUT = G.frameOf([BLEND.x + 12, BLEND.y + BLEND.d - 4, 0], UP, [1, 0, 0], [0, 1, 0]);
disc("gas.out", GAS_OUT, 232, 236, 1.6, { tone: "mid" });

// ---------- cardioplegia: crystalloid bag, pump, heat exchanger and bubble trap ----------
const CP = PUMPS.cardio;
// the bag hangs straight over the pump's riser; its pole stands off to the left so the line drops clear of it
const BAG_X = CP.riser;
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
  extra: Ln(bagRules.join(""), { tone: "lo", free: true }) + k.faceTextSvg(k.sideMatrix([BAG.x + 5, bagFront], 238.5, P, "left"), "CARDIOPLEGIA", { size: 1.9, tone: "mid" }),
});
const SPIKE = VERT(BAG_X, BAG.y + BAG.d / 2);
disc("cp.spike", SPIKE, 200, 206, 2, { tone: "mid" });
const bagOut = [BAG_X, BAG.y + BAG.d / 2, 200];
// the heat exchanger and bubble trap rides on the delivery line just above the pump
const HX = VERT(CP.riser, LANE_Y);
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
  box(`panel.${id}-plate`, plate, site.z - 6, 12, { tone: "mid" }, {
    steps: 2,
    bevel: 0.2,
    extra:
      k.faceTextSvg(k.sideMatrix([plate.x + 2.6, plate.y + plate.d], site.z + 0.6, P, "left"), site.zh, { size: 5.6, tone: "hi" }) +
      k.faceTextSvg(k.sideMatrix([plate.x + 2.6, plate.y + plate.d], site.z - 4.4, P, "left"), site.en, { size: 3.8, tone: "hi" }),
  });
}

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
function pumped(pump, before, after) {
  const inY = legY(pump, pump.inLeg);
  const outY = legY(pump, outLeg(pump));
  return [...before, [pump.riser, inY, pump.tz], ...bootOf(pump), [pump.riser, outY, pump.tz], ...after];
}
// field sucker and LV vent: down from the panel onto the pump's front leg, out of the back leg, up and home to the reservoir
for (const [id, pumpId] of [
  ["sucker", "sucker"],
  ["vent", "vent"],
]) {
  const pump = PUMPS[pumpId];
  const site = id === "sucker" ? "field" : "vent";
  const lane = SITES[site].z;
  const control = pumped(
    pump,
    [SITE_PORT[site], [pump.riser, LANE_Y, lane]],
    [[pump.riser, RETURN_Y, RET_Z[id]], RETURN_PORT[id]],
  );
  const route = routeOf(control, pump.tube);
  tubeItems(`circuit.${id}`, route, pump.tube, { cls: "cpb-v", into: WELLS[pumpId].well, touch: [`${pumpId}.race`, `${pumpId}.body`], breaks: crossingsAt(route, pump.x1 + 1.5) });
}
// cardioplegia: bag, down behind the pump, through the boot, up through the heat exchanger to the aortic root
{
  const control = pumped(CP, [bagOut, [bagOut[0], bagOut[1], 142], [CP.riser, CP.back, 128]], [[CP.riser, LANE_Y, HX_Z[0]]]);
  const route = routeOf(control, CP.tube);
  tubeItems("circuit.cardioplegia", route, CP.tube, { cls: "cpb-c", into: WELLS.cardio.well, touch: ["cardio.race", "cardio.body"], breaks: crossingsAt(route, CP.x1 + 1.5) });
  line("circuit.cardioplegia-root", [[CP.riser, LANE_Y, HX_Z[1]], [CP.riser, LANE_Y, SITES.root.z], SITE_PORT.root], CP.tube, { cls: "cpb-c" });
}
// venous line: right atrium, downhill back to the reservoir, then straight down into its lid
const vTop = [RES[0], RES[1], vPortTop];
const V_OVER = vPortTop + 14;
line("circuit.venous", [SITE_PORT.ra, [SITE_PORT.ra[0] - 8, LANE_Y, SITES.ra.z], [RES[0] + 24, RES[1], V_OVER], [RES[0], RES[1], V_OVER], vTop], 2.8, { cls: "cpb-v" });
// pump line: reservoir outlet, through the arterial pump's raceway, to the oxygenator inlet
{
  const control = pumped(ART, [[RES[0], RES[1], STEM_Z], [RES[0], RES[1], ART.tz]], [oxyIn.end]);
  const route = G.fillet(control, 7, 14, { P, tube: ART.tube });
  tubeItems("circuit.pump", route, ART.tube, { cls: "cpb-v", into: WELLS.arterial.well, touch: ["arterial.race", "arterial.body"], breaks: crossingsAt(route, ART.x1 + 1.5) });
}
// oxygenator to arterial filter
line("circuit.oxy-filter", [oxyOut.end, filIn.end], 2.2, { cls: "cpb-a" });
// arterial line: filter outlet, along under the panel, up into the ascending-aorta port
const filOut = [FIL[0], FIL[1], 112 + FZ];
const LOW = 104;
line("circuit.arterial", [filOut, [FIL[0], FIL[1], LOW], [RISER[0], RISER[1], LOW], [RISER[0], RISER[1], SITES.aorta.z], SITE_PORT.aorta], 2.2, { cls: "cpb-a" });
// sweep gas: blender down past the reservoir to the oxygenator
line("gas.line", [[GAS_OUT.o[0], GAS_OUT.o[1], 232], [GAS_OUT.o[0], GAS_OUT.o[1], 184], [OXY[0], OXY[1], 178], gasIn], 1.0, { tone: "mid", bend: 6 });

// ---------- the pump wells, now that their tubes are in ----------
for (const [id, { pump, well, raceSvg, raceShape, hubShape, clip }] of Object.entries(WELLS)) {
  const [cx, cy] = pump.c;
  const rotor = rotorParts(pump, 0.6);
  const lit = id === "arterial";
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
  "人工心肺機 (heart-lung machine) 的等角剖析圖：推車式主機上一排四個滾輪泵 (roller pump)——抽吸泵、左心減壓泵、心麻痺液泵、動脈泵；立柱上掛著硬殼靜脈儲血槽、膜式氧合器、動脈過濾器與氣體混合器，旁邊是心麻痺液袋與熱交換器、變溫水箱。右側標示板列出各條管路接到病人身上的位置：升主動脈、主動脈根部、右心房、右上肺靜脈到左心室、心包腔。";
const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: [...back, ...groups] });

const DATA = {
  P,
  V,
  RPM_FULL: M.RPM_FULL,
  RPM_MAX: M.RPM_MAX,
  RPM: { cardio: M.RPM_CARDIOPLEGIA, vent: M.RPM_VENT, sucker: M.RPM_SUCKER },
  BSA: M.BSA,
  PRIME_ML: M.PRIME_ML,
  LAG_S: M.LAG_S,
  RES_MAX_ML: M.RES_MAX_ML,
  res: { x: RES[0], y: RES[1], r: RES_R, z0: RES_Z0, z1: RES_Z1, span: RES_Z1 - RES_Z0 - 3 },
  pumps: Object.fromEntries(
    Object.entries(PUMPS).map(([id, p]) => [id, { c: p.c, rc: p.rc, roller: p.roller, hub: p.hub, z0: MOD_Z1 + 0.6, h: RACE_H, top: RACE_Z1 + 0.6, dir: p.dir, stroke: p.stroke, knob: { o: p.knob.o, a: p.knob.a, u: p.knob.u, v: p.knob.v } }]),
  ),
};
const CSS = readFileSync(join(HERE, "cpb.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const f1 = (value) => value.toFixed(1);
const f2 = (value) => value.toFixed(2);
const caption =
  `人工心肺機 (heart-lung machine) 在體外循環 (cardiopulmonary bypass, CPB) 時暫代心與肺。四個滾輪泵 (roller pump) 由左到右：` +
  `抽吸泵 (cardiotomy sucker) 把心包腔的出血吸回儲血槽；左心減壓泵 (LV vent) 經右上肺靜脈 (right superior pulmonary vein, RSPV) 放進左心室的導管抽血減壓，同樣回到儲血槽；` +
  `心麻痺液泵 (cardioplegia pump) 把液袋裡的心麻痺液推過熱交換器與氣泡過濾 (heat exchanger / bubble trap)，從主動脈根部 (aortic root) 順行灌進冠狀動脈；` +
  `動脈泵 (arterial pump) 從靜脈儲血槽 (venous reservoir) 抽血，推過膜式氧合器 (membrane oxygenator)——氣體混合器 (gas blender) 送進掃氣 (sweep gas)，變溫水箱 (heater-cooler) 的水流過內建熱交換器控制血溫——再經動脈過濾器 (arterial filter) 由主動脈插管 (aortic cannula) 送回升主動脈 (ascending aorta)。靜脈血則靠重力從右心房經靜脈插管 (venous cannula) 流回儲血槽。` +
  `滾輪泵是完全壓閉式 (occlusive)：每轉推出一整圈管腔，π × (管內半徑)² × 2π × 管路中心半徑。動脈泵 1/2 吋管在 ${M.RACEWAY_D_MM} mm 滾道每轉 ${f1(M.STROKE_ML)} mL；其餘三泵 1/4 吋管在 ${M.SMALL_D_MM} mm 滾道每轉 ${f1(M.SMALL_STROKE_ML)} mL。` +
  `以體表面積 (body surface area, BSA) ${M.BSA} m²、心指數 (cardiac index, CI) ${M.CI_FULL} L/min/m² 計，全流量 ${f2(M.FLOW_FULL)} L/min 約需 ${Math.round(M.RPM_FULL)} rpm；導覽中減壓泵 ${M.RPM_VENT} rpm（${f2(M.smallFlowOf(M.RPM_VENT))} L/min）、抽吸泵 ${M.RPM_SUCKER} rpm（${f2(M.smallFlowOf(M.RPM_SUCKER))} L/min）、心麻痺液 ${M.RPM_CARDIOPLEGIA} rpm（${f2(M.smallFlowOf(M.RPM_CARDIOPLEGIA))} L/min）。` +
  `此圖以晶體心麻痺液 (crystalloid cardioplegia) 為例；血液心麻痺液 (blood cardioplegia) 會另從氧合器出口取氧合血，與晶體液以約 4:1 在同一泵頭混合。逆行灌注則改接冠狀竇 (coronary sinus)。` +
  `儲血槽液面是簡化模型：假設靜脈回流以 ${M.LAG_S} 秒時間常數追上進入病人的量，差額暫存在病人血管內；灌心麻痺液時晶體液會讓液面慢慢升高。實際每轉排出量依管路與壓閉度校正，臨床流量與灌注目標依各院體外循環常規。`;
const swatch = (cls) => `<svg class="iso-swatch ${cls}" viewBox="0 0 16 10" aria-hidden="true"><path d="M1.5 5h13"/></svg>`;
const KEYS = [
  [`<svg class="iso-swatch" data-mark="lit" viewBox="0 0 16 10" aria-hidden="true"><path d="M2 4.5 8 1.5 14 4.5 14 6 8 9 2 6Z"/><path class="iso-swatch-crease" d="M2 4.5 8 7.5 14 4.5"/></svg>`, `動脈泵轉子 (rotor)：每轉 ${f1(M.STROKE_ML)} mL`],
  [swatch("cpb-swatch-v"), "靜脈血 (deoxygenated)：右心房、左心減壓、心包腔抽吸 → 儲血槽 → 動脈泵 → 氧合器"],
  [swatch("cpb-swatch-a"), "動脈血 (oxygenated)：氧合器 → 過濾器 → 升主動脈"],
  [swatch("cpb-swatch-c"), "心麻痺液 (cardioplegia)：液袋 → 心麻痺液泵 → 熱交換器 → 主動脈根部"],
];
const legend = `<figcaption class="iso-legend"><span class="iso-keys">${KEYS.map(([mark, label]) => `<span class="iso-key">${mark}${label}</span>`).join("")}</span><span class="iso-caption">${caption}</span></figcaption>`;
const plate = k
  .plateHtml({
    fig: "Fig 1",
    title: "人工心肺機 · heart-lung machine",
    hint: "拖曳 ← → 動脈泵 · 點泵頭開關",
    readout: "停機 · 0 rpm · 0.00 L/min · CI 0.00",
    keys: [],
    body: `<div class="iso-stage cpb-stage" tabindex="0" role="slider" aria-label="人工心肺機：左右方向鍵調整動脈泵轉速（按住 Shift 一次 10 rpm），Home 全部停機，End 動脈泵全流量；C、V、S 分別開關心麻痺液泵、左心減壓泵、抽吸泵；在圖上左右拖曳也可調整動脈泵轉速，點其他泵頭可開關" aria-valuemin="0" aria-valuemax="${M.RPM_MAX}" aria-valuenow="0" aria-valuetext="停機">${svg}</div>`,
  })
  .replace(/<\/figure>$/, `${legend}</figure>`);
const intro = `<header class="cpb-head"><p class="cpb-back"><a href="./">← 回到目錄</a></p><h1>人工心肺機：四個泵與插管位置</h1><p>體外循環 (cardiopulmonary bypass) 的四個滾輪泵各管一條路：動脈泵送氧合血回升主動脈、心麻痺液泵灌主動脈根部、左心減壓泵從右上肺靜脈抽左心室、抽吸泵回收心包腔出血。右側標示板標出每條管路接在病人身上的位置。在圖上左右拖曳或用方向鍵調整動脈泵轉速；點其他泵頭（或按 C／V／S）開關心麻痺液泵、左心減壓泵、抽吸泵。</p></header>`;
const body = intro + plate;
const OUT = process.env.CPB_OUT ?? join(HERE, "..", "..", "cpb-machine.html");
const page = k
  .pageHtml({ title: "人工心肺機 · Heart-lung machine", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + LIVE, width: 1000 })
  .replace('<html lang="en">', '<html lang="zh-Hant">')
  // one file for both themes: follow the reader's system setting, light when unknown
  .replace(/(<body class="iso" data-theme=")[a-z]+(">)/, `$1${THEME}$2<script>try{const m=matchMedia("(prefers-color-scheme: dark)");const t=()=>{document.body.dataset.theme=m.matches?"dark":"light"};t();m.addEventListener("change",t)}catch(e){}</script>`)
  .replace("html{color-scheme:dark}", "html{color-scheme:light dark}");
writeFileSync(OUT, page);
console.log("wrote", OUT, `${R.items.length} items`, `${R.solids.length} solids`, `${R.tubes.length} tubes`);
A.auditOrExit(R, P, { allow: [] });

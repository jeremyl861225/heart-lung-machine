const D = __DATA__;
const P = D.P;
const stage = document.querySelector(".cpb-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ---- solids rebuilt in place ----
function setSolid(group, paths) {
  const q = (selector) => group.querySelector(selector);
  q(".iso-fill").setAttribute("d", paths.fill);
  const shades = group.querySelectorAll(".iso-shade");
  const byShade = {};
  shades.forEach((node) => (byShade[node.dataset.shade] = node));
  paths.shades.forEach((d, index) => {
    let node = byShade[index];
    if (!node && d) {
      node = document.createElementNS("http://www.w3.org/2000/svg", "path");
      node.setAttribute("class", "iso-shade");
      node.dataset.shade = String(index);
      q(".iso-top").before(node);
      byShade[index] = node;
    }
    if (node) node.setAttribute("d", d || "");
  });
  q(".iso-top").setAttribute("d", paths.top);
  const crease = q(".iso-crease");
  if (crease) crease.setAttribute("d", paths.crease || "");
  const bevel = q(".iso-bevel");
  if (bevel) bevel.setAttribute("d", paths.bevel || "");
  q(".iso-edge").setAttribute("d", paths.outline);
}

// ---- pumps ----
const pumps = Object.entries(D.pumps).map(([id, pump]) => {
  const node = svg.querySelector(`[data-pump="${id}"]`);
  return {
    id,
    pump,
    node,
    mid: node.querySelector("[data-mid]"),
    rollers: [...node.querySelectorAll("[data-roller]")],
    bar: node.querySelector("[data-bar] .iso-solid"),
    caps: node.querySelector("[data-caps]"),
    digits: svg.querySelector(`[data-digits="${id}"]`),
    pointer: svg.querySelector(`[data-knob="${id}"]`),
    phi: { sucker: 0.3, vent: 1.2, cardio: 2.1, arterial: 0.6 }[id],
    rpm: 0,
  };
});
const arterial = pumps.find((entry) => entry.id === "arterial");

function placeRotor(entry) {
  const { pump, phi } = entry;
  const [cx, cy] = pump.c;
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
  setSolid(entry.bar, extrude(bar, pump.top, 2.4, P, { bevel: 0.3 }));
  const centres = [0, 1].map((index) => [cx + pump.rc * Math.cos(phi + index * Math.PI), cy + pump.rc * Math.sin(phi + index * Math.PI)]);
  entry.rollers.forEach((node, index) => {
    const [x, y] = centres[index];
    setSolid(node.querySelector(".iso-solid"), cylinder(x, y, pump.roller, pump.z0, pump.h, P, 24));
    node.dataset.k = dot([x, y, pump.z0 + pump.h / 2], D.V).toFixed(2);
  });
  const circles = entry.caps.querySelectorAll("circle");
  centres.forEach(([x, y], index) => {
    const [sx, sy] = iso([x, y, pump.top + 2.4], P);
    circles[index].setAttribute("cx", sx.toFixed(1));
    circles[index].setAttribute("cy", sy.toFixed(1));
  });
  // re-append the well's middle layer only when its order changes
  const kids = [...entry.mid.children];
  const order = [...kids].sort((a, b) => Number(a.dataset.k) - Number(b.dataset.k));
  if (order.some((node, index) => node !== kids[index])) entry.mid.append(...order);
}

function knobAt(entry, turn) {
  const { o, a, u, v } = entry.pump.knob;
  const angle = -Math.PI * 0.75 + turn * Math.PI * 1.5;
  const point = (s, r) => [0, 1, 2].map((i) => o[i] + a[i] * s + (u[i] * Math.cos(angle) + v[i] * Math.sin(angle)) * r);
  const p0 = iso(point(6.65, 1.2), P);
  const p1 = iso(point(6.65, 3.9), P);
  entry.pointer.setAttribute("d", `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`);
}

// ---- reservoir ----
const res = svg.querySelector("[data-res]");
const blood = res.querySelector("[data-blood] .iso-solid");
const empty = res.querySelector("[data-empty] .iso-solid");
const levelZ = (ml) => D.res.z0 + (D.res.span * Math.max(0, ml - 300)) / (D.RES_MAX_ML - 300);
function placeLevel(ml) {
  const z = clamp(levelZ(ml), D.res.z0 + 0.5, D.res.z1 - 0.5);
  setSolid(blood, cylinder(D.res.x, D.res.y, D.res.r, D.res.z0, z - D.res.z0, P, 56));
  setSolid(empty, cylinder(D.res.x, D.res.y, D.res.r, z, D.res.z1 - z, P, 56));
}

// ---- model: every pump turns at whole rpm on its display, and every number comes from that ----
const NAMES = { arterial: "動脈泵", cardio: "心麻痺液泵", vent: "左心減壓泵", sucker: "抽吸泵" };
const RUN = { arterial: D.RPM_FULL, cardio: D.RPM.cardio, vent: D.RPM.vent, sucker: D.RPM.sucker };
pumps.forEach((entry) => Object.assign(entry, { knob: 0, target: 0 }));
const byId = Object.fromEntries(pumps.map((entry) => [entry.id, entry]));
const state = { venous: 0, volume: D.PRIME_ML };
const shown = (entry) => Math.round(entry.knob);
const flowOf = (entry, rpm = shown(entry)) => (rpm * entry.pump.stroke) / 1000;
const phaseOf = () => {
  const art = byId.arterial;
  if (pumps.every((entry) => shown(entry) === 0)) return "停機";
  if (shown(byId.cardio) > 0) return "灌心麻痺液";
  if (Math.abs(art.target - art.knob) > 0.5) return art.target > art.knob ? "加流量" : "減流量";
  const share = shown(art) / D.RPM_FULL;
  if (share > 0.97) return "全流量";
  if (share === 0) return "動脈泵停";
  return `部分流量 ${Math.round(share * 100)}%`;
};
function say() {
  const art = byId.arterial;
  const flow = flowOf(art);
  const text = `${phaseOf()} · ${shown(art)} rpm · ${flow.toFixed(2)} L/min · CI ${(flow / D.BSA).toFixed(2)}`;
  if (readout.textContent !== text) readout.textContent = text;
  pumps.forEach((entry) => {
    const digits = flowOf(entry).toFixed(2);
    if (entry.digits.textContent !== digits) entry.digits.textContent = digits;
  });
}
function describe() {
  const parts = pumps.filter((entry) => entry.target > 0).map((entry) => `${NAMES[entry.id]} ${Math.round(entry.target)} 轉每分，${flowOf(entry, Math.round(entry.target)).toFixed(2)} 公升每分`);
  stage.setAttribute("aria-valuenow", String(Math.round(byId.arterial.target)));
  stage.setAttribute("aria-valuetext", parts.length ? parts.join("；") : "全部停機");
}

// ---- tour: go on bypass with vent and sucker, give a dose of cardioplegia, wean, come off ----
const TOUR = [
  [0, { arterial: 0, cardio: 0, vent: 0, sucker: 0 }],
  [1.2, { arterial: RUN.arterial, vent: RUN.vent, sucker: RUN.sucker }],
  [5, { cardio: RUN.cardio }],
  [11, { cardio: 0 }],
  [15, { arterial: RUN.arterial * 0.5, vent: 0, sucker: 0 }],
  [19, { arterial: 0 }],
  [22, {}],
];
const tourAt = (t) => {
  const time = t % TOUR[TOUR.length - 1][0];
  const targets = {};
  for (const [from, set] of TOUR) if (time >= from) Object.assign(targets, set);
  return targets;
};

let frame = 0;
let last = 0;
let clock = 0;
let touring = !still.matches;
let visible = false;
let idleTimer = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    const targets = tourAt(clock);
    let changed = false;
    for (const entry of pumps) {
      if (targets[entry.id] !== undefined && targets[entry.id] !== entry.target) {
        entry.target = targets[entry.id];
        changed = true;
      }
    }
    if (changed) describe();
  }
  let moving = false;
  for (const entry of pumps) {
    // the perfusionist turns each knob over about a second; the pump follows its knob
    entry.knob = calm ? entry.target : entry.knob + (entry.target - entry.knob) * (1 - Math.exp(-dt / 0.6));
    if (Math.abs(entry.knob - entry.target) < 0.2) entry.knob = entry.target;
    if (!calm) entry.phi += entry.pump.dir * (entry.knob / 60) * Math.PI * 2 * dt;
    placeRotor(entry);
    knobAt(entry, entry.knob / (entry.id === "arterial" ? D.RPM_MAX : 60));
    if (entry.knob !== entry.target || entry.knob > 0) moving = true;
  }
  // venous return catches up with what went into the patient: arterial flow plus crystalloid cardioplegia
  const delivered = flowOf(byId.arterial) + flowOf(byId.cardio);
  state.venous += (delivered - state.venous) * (calm ? 1 : 1 - Math.exp(-dt / D.LAG_S));
  state.volume += ((state.venous - flowOf(byId.arterial)) * 1000 * dt) / 60;
  if (calm) state.volume = D.PRIME_ML - (flowOf(byId.arterial) * 1000 * D.LAG_S) / 60;
  placeLevel(state.volume);
  say();
  const settled = !touring && !moving && Math.abs(state.venous - delivered) < 1e-3;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
const takeOver = () => {
  if (touring) pumps.forEach((entry) => (entry.target = Math.round(entry.knob)));
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    touring = !still.matches;
    clock = 0;
    run();
  }, 6000);
};
const setTarget = (id, value) => {
  takeOver();
  const entry = byId[id];
  entry.target = clamp(value, 0, id === "arterial" ? D.RPM_MAX : 60);
  describe();
  run();
};
const toggle = (id) => {
  takeOver();
  setTarget(id, byId[id].target > 0 ? 0 : RUN[id]);
};
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

// drag across the figure to set the arterial pump; tap a pump head to start or stop it
let dragging = null;
const dragTo = (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.15) / 0.7, 0, 1);
  setTarget("arterial", Math.round(share * D.RPM_MAX));
};
stage.addEventListener("pointerdown", (event) => {
  const head = event.target.closest("[data-pump]");
  if (head && head.dataset.pump !== "arterial") {
    toggle(head.dataset.pump);
    return;
  }
  dragging = event.pointerId;
  stage.setPointerCapture(event.pointerId);
  dragTo(event);
});
stage.addEventListener("pointermove", (event) => {
  if (dragging === event.pointerId) dragTo(event);
});
const release = (event) => {
  if (dragging === event.pointerId) dragging = null;
};
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("keydown", (event) => {
  const art = byId.arterial;
  const step = event.shiftKey ? 10 : 2;
  const from = touring ? Math.round(art.knob) : art.target;
  const key = event.key.toLowerCase();
  if (key === "c" || key === "v" || key === "s") {
    event.preventDefault();
    toggle({ c: "cardio", v: "vent", s: "sucker" }[key]);
    return;
  }
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = from + step;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = from - step;
  if (event.key === "End") to = D.RPM_FULL;
  if (event.key === " " || event.key === "Enter") to = from > 0 ? 0 : D.RPM_FULL;
  if (event.key === "Home" || event.key === "Escape") {
    event.preventDefault();
    takeOver();
    pumps.forEach((entry) => (entry.target = 0));
    describe();
    run();
    return;
  }
  if (to === null) return;
  event.preventDefault();
  setTarget("arterial", to);
});
if (still.matches) touring = false;
pumps.forEach(placeRotor);
placeLevel(state.volume);
describe();
say();

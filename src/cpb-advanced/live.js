const D = __DATA__;
const M = D.M;
const P = D.P;
const stage = document.querySelector(".cpb-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const path = (points) => points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");

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
// a point on a frame: s along its axis, r out at angle a
const onFrame = (F, s, r, a) => [0, 1, 2].map((i) => F.o[i] + F.a[i] * s + (F.u[i] * Math.cos(a) + F.v[i] * Math.sin(a)) * r);
const pointer = (F, s, r0, r1, turn) => {
  const a = -Math.PI * 0.75 + turn * Math.PI * 1.5;
  return path([iso(onFrame(F, s, r0, a), P), iso(onFrame(F, s, r1, a), P)]);
};

// ---- roller pumps ----
const NAMES = { sucker: "抽吸泵", rootvent: "主動脈根部減壓泵", vent: "左心減壓泵", cardio: "心麻痺液泵" };
const pumps = Object.entries(D.pumps).map(([id, pump]) => {
  const node = svg.querySelector(`[data-pump="${id}"]`);
  return {
    id,
    pump,
    mid: node.querySelector("[data-mid]"),
    rollers: [...node.querySelectorAll("[data-roller]")],
    bar: node.querySelector("[data-bar] .iso-solid"),
    caps: node.querySelector("[data-caps]"),
    digits: svg.querySelector(`[data-digits="${id}"]`),
    pointer: svg.querySelector(`[data-knob="${id}"]`),
    phi: { sucker: 0.3, rootvent: 2.4, vent: 1.2, cardio: 2.1 }[id],
    knob: 0,
    target: 0,
  };
});
const byId = Object.fromEntries(pumps.map((entry) => [entry.id, entry]));
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

// ---- centrifugal pump: impeller vanes on the clear cone, knob, displays, clamp lamp ----
const drive = {
  vanes: svg.querySelector("[data-vanes]"),
  pointer: svg.querySelector('[data-knob="drive"]'),
  rpmText: svg.querySelector('[data-digits="drive-rpm"]'),
  flowText: svg.querySelector('[data-digits="drive-flow"]'),
  lamp: svg.querySelector('[data-lamp="clamp"]'),
  phi: 0,
  knob: 0,
  target: 0,
};
const H0 = D.drive.head;
const SLOPES = [[3.6, H0 + 14], [7, H0 + 11], [12, H0 + 7]];
function placeVanes(phi) {
  const [cx, cy] = D.drive.c;
  let d = "";
  for (let vane = 0; vane < 4; vane++) {
    let run = [];
    for (let step = 0; step <= 12; step++) {
      const rho = 4.4 + (step / 12) * 7;
      const [[r0, z0], [r1, z1]] = rho < 7 ? [SLOPES[0], SLOPES[1]] : [SLOPES[1], SLOPES[2]];
      const slope = (z0 - z1) / (r1 - r0);
      const z = z0 - (rho - r0) * slope;
      const th = phi + (vane * Math.PI) / 2 + 0.9 * (step / 12);
      const facing = dot([slope * Math.cos(th), slope * Math.sin(th), 1], D.V) > 0.05;
      if (facing) run.push(iso([cx + rho * Math.cos(th), cy + rho * Math.sin(th), z], P));
      if (!facing || step === 12) {
        if (run.length > 1) d += path(run);
        run = [];
      }
    }
  }
  drive.vanes.setAttribute("d", d);
}

// ---- vacuum gauge ----
const needle = svg.querySelector('[data-needle="vavd"]');
const GAUGE_F = D.gauge;
function placeNeedle(mm) {
  const a = Math.PI * 1.25 - (mm / 100) * Math.PI * 1.5;
  needle.setAttribute("d", path([iso(onFrame(GAUGE_F, 1.6, 0.4, a + Math.PI), P), iso(onFrame(GAUGE_F, 1.6, GAUGE_F.r - 1.4, a), P)]));
}

// ---- reservoir ----
const res = svg.querySelector("[data-res]");
const blood = res.querySelector("[data-blood] .iso-solid");
const empty = res.querySelector("[data-empty] .iso-solid");
const levelZ = (ml) => D.res.z0 + (D.res.span * Math.max(0, ml - 300)) / (M.RES_MAX_ML - 300);
function placeLevel(ml) {
  const z = clamp(levelZ(ml), D.res.z0 + 0.5, D.res.z1 - 0.5);
  setSolid(blood, cylinder(D.res.x, D.res.y, D.res.r, D.res.z0, z - D.res.z0, P, 56));
  setSolid(empty, cylinder(D.res.x, D.res.y, D.res.r, z, D.res.z1 - z, P, 56));
}

// ---- the model: every number on the page comes from these ----
const state = { clamped: true, vavd: false, vacuum: 0, map: M.MAP, mapTarget: M.MAP, route: "antegrade", venLag: 0, pool: 0, volume: M.PRIME_ML };
const rpmOf = () => Math.round(drive.knob / 10) * 10;
// a centrifugal pump: head rises with speed squared, losses with flow squared; below the head that matches MAP, blood runs back
const arterialFlow = () => {
  if (state.clamped) return 0;
  const head = M.HEAD_A * rpmOf() ** 2 - Math.round(state.map);
  return Math.sign(head) * Math.sqrt(Math.abs(head) / M.LOSS_K);
};
const rollerRpm = (entry) => Math.round(entry.knob);
const rollerFlow = (entry, rpm = rollerRpm(entry)) => (rpm * entry.pump.stroke) / 1000;
const crystalFlow = () => (rollerRpm(byId.cardio) * M.CP_CRYSTAL_ML) / 1000;
const drainCap = () => M.GRAVITY_FLOW * Math.sqrt((M.GRAVITY_MMHG + state.vacuum) / M.GRAVITY_MMHG);
const RUN = { cardio: M.RPM.cardio, vent: M.RPM.vent, rootvent: M.RPM.rootvent, sucker: M.RPM.sucker };
const cpRun = () => (state.route === "antegrade" ? M.RPM.cardio : M.RPM.retro);

const phaseOf = () => {
  const flow = arterialFlow();
  if (drive.knob < 1 && pumps.every((entry) => rollerRpm(entry) === 0)) return "停機";
  if (flow < -0.05) return "逆流！先夾管";
  if (state.clamped && drive.knob >= 1) return "動脈管夾住";
  if (rollerRpm(byId.cardio) > 0) return state.route === "antegrade" ? "順行心麻痺液" : "逆行心麻痺液";
  if (Math.abs(state.map - M.MAP) > 2) return state.map > M.MAP ? "血壓升高，流量下降" : "血壓下降，流量上升";
  if (Math.abs(drive.target - drive.knob) > 20) return drive.target > drive.knob ? "加流量" : "減流量";
  const share = flow / (M.BSA * M.CI_FULL);
  if (share > 0.97 && share < 1.03) return "全流量";
  if (flow <= 0.05) return "離心泵停";
  return `${share > 1 ? "高流量" : "部分流量"} ${Math.round(share * 100)}%`;
};
function say() {
  const flow = arterialFlow();
  const text = `${phaseOf()} · ${rpmOf()} rpm · ${flow.toFixed(2)} L/min · CI ${(flow / M.BSA).toFixed(2)} · MAP ${Math.round(state.map)}`;
  if (readout.textContent !== text) readout.textContent = text;
  const rpmText = String(rpmOf());
  if (drive.rpmText.textContent !== rpmText) drive.rpmText.textContent = rpmText;
  const flowText = flow.toFixed(2);
  if (drive.flowText.textContent !== flowText) drive.flowText.textContent = flowText;
  pumps.forEach((entry) => {
    const digits = rollerFlow(entry).toFixed(2);
    if (entry.digits.textContent !== digits) entry.digits.textContent = digits;
  });
  if (state.clamped) drive.lamp.setAttribute("data-on", "");
  else drive.lamp.removeAttribute("data-on");
  if (svg.dataset.route !== state.route) svg.dataset.route = state.route;
}
function describe() {
  const parts = [`離心泵 ${Math.round(drive.target / 10) * 10} 轉每分${state.clamped ? "，動脈管夾住" : ""}`];
  pumps.filter((entry) => entry.target > 0).forEach((entry) => parts.push(`${NAMES[entry.id]} ${Math.round(entry.target)} 轉每分`));
  if (byId.cardio.target > 0) parts.push(state.route === "antegrade" ? "順行灌注到主動脈根部" : "逆行灌注到冠狀竇");
  if (state.vavd) parts.push(`負壓引流 負 ${M.VAVD_MMHG} 毫米汞柱`);
  stage.setAttribute("aria-valuenow", String(Math.round(drive.target)));
  stage.setAttribute("aria-valuetext", parts.join("；"));
}

// ---- tour: clamp, spin up, release, full flow, assisted drainage, cardioplegia both ways, a rise in pressure, wean ----
const TOUR = [
  [0, { drive: 0, cardio: 0, vent: 0, rootvent: 0, sucker: 0, clamped: true, vavd: false, map: M.MAP, route: "antegrade" }],
  [1, { drive: 1700 }],
  [3.5, { clamped: false }],
  [5, { drive: M.RPM_FULL, vent: RUN.vent, sucker: RUN.sucker }],
  [13, { vavd: true }],
  [18, { cardio: M.RPM.cardio }],
  [24, { route: "retrograde", cardio: M.RPM.retro }],
  [29, { cardio: 0, route: "antegrade", rootvent: RUN.rootvent }],
  [32, { map: 90 }],
  [37, { map: M.MAP }],
  [39, { drive: 1800, vent: 0, rootvent: 0, sucker: 0 }],
  [42, { clamped: true }],
  [43, { drive: 0 }],
  [44.5, { vavd: false }],
  [47, {}],
];
const tourAt = (t) => {
  const time = t % TOUR[TOUR.length - 1][0];
  const set = {};
  for (const [from, step] of TOUR) if (time >= from) Object.assign(set, step);
  return set;
};
function apply(set) {
  let changed = false;
  const assign = (object, key, value) => {
    if (value !== undefined && object[key] !== value) {
      object[key] = value;
      changed = true;
    }
  };
  assign(drive, "target", set.drive);
  for (const entry of pumps) assign(entry, "target", set[entry.id]);
  assign(state, "clamped", set.clamped);
  assign(state, "vavd", set.vavd);
  assign(state, "mapTarget", set.map);
  assign(state, "route", set.route);
  return changed;
}

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
    if (apply(tourAt(clock))) describe();
  }
  const ease = (value, target, tau) => (calm ? target : value + (target - value) * (1 - Math.exp(-dt / tau)));
  let moving = false;
  // the perfusionist turns each knob over about a second; the pump follows its knob
  drive.knob = ease(drive.knob, drive.target, 0.6);
  if (Math.abs(drive.knob - drive.target) < 5) drive.knob = drive.target;
  // the vanes are shown turning a hundred times slower than the impeller
  if (!calm) drive.phi += (drive.knob / 60 / 100) * Math.PI * 2 * dt;
  placeVanes(drive.phi);
  drive.pointer.setAttribute("d", pointer(D.drive.knob, 5.65, 1, 3.4, drive.knob / M.RPM_MAX));
  for (const entry of pumps) {
    entry.knob = ease(entry.knob, entry.target, 0.6);
    if (Math.abs(entry.knob - entry.target) < 0.2) entry.knob = entry.target;
    if (!calm) entry.phi += entry.pump.dir * (entry.knob / 60) * Math.PI * 2 * dt;
    placeRotor(entry);
    entry.pointer.setAttribute("d", pointer(entry.pump.knob, 6.65, 1.2, 3.9, entry.knob / 60));
    if (entry.knob !== entry.target || entry.knob > 0) moving = true;
  }
  state.vacuum = ease(state.vacuum, state.vavd ? M.VAVD_MMHG : 0, 0.8);
  if (Math.abs(state.vacuum - (state.vavd ? M.VAVD_MMHG : 0)) < 0.2) state.vacuum = state.vavd ? M.VAVD_MMHG : 0;
  placeNeedle(state.vacuum);
  state.map = ease(state.map, state.mapTarget, 1.2);
  if (Math.abs(state.map - state.mapTarget) < 0.3) state.map = state.mapTarget;
  // blood goes into the patient at the pump's flow plus the crystalloid; it comes back with a lag, no faster than the cannulas drain
  const flow = arterialFlow();
  const delivered = flow + crystalFlow();
  if (calm) {
    state.venLag = Math.max(0, delivered);
    state.pool = 0;
    state.volume = M.PRIME_ML - (Math.max(0, flow) * 1000 * M.LAG_S) / 60;
  } else {
    state.venLag += (Math.max(0, delivered) - state.venLag) * (1 - Math.exp(-dt / M.LAG_S));
    const venous = Math.min(state.venLag + state.pool / 1000 / (M.LAG_S / 60), drainCap());
    state.pool = Math.max(0, state.pool + ((state.venLag - venous) * 1000 * dt) / 60);
    state.volume = clamp(state.volume + ((venous - flow) * 1000 * dt) / 60, 300, M.RES_MAX_ML);
  }
  placeLevel(state.volume);
  say();
  if (drive.knob !== drive.target || drive.knob > 0 || state.vacuum !== (state.vavd ? M.VAVD_MMHG : 0) || state.map !== state.mapTarget) moving = true;
  const settled = !touring && !moving && Math.abs(state.venLag - Math.max(0, delivered)) < 1e-3 && state.pool < 1;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
const takeOver = () => {
  if (touring) {
    drive.target = Math.round(drive.knob / 10) * 10;
    pumps.forEach((entry) => (entry.target = Math.round(entry.knob)));
    state.mapTarget = Math.round(state.map);
  }
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    touring = !still.matches;
    clock = 0;
    run();
  }, 8000);
};
const change = (fn) => {
  takeOver();
  fn();
  describe();
  run();
};
const setDrive = (value) => change(() => (drive.target = clamp(Math.round(value / 10) * 10, 0, M.RPM_MAX)));
const toggle = (id) =>
  change(() => {
    const entry = byId[id];
    entry.target = entry.target > 0 ? 0 : id === "cardio" ? cpRun() : RUN[id];
  });
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

// drag across the figure to set the centrifugal pump; tap a roller head to start or stop it
let dragging = null;
const dragTo = (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.15) / 0.7, 0, 1);
  setDrive(share * M.RPM_MAX);
};
stage.addEventListener("pointerdown", (event) => {
  const head = event.target.closest("[data-pump]");
  if (head) {
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
  const key = event.key.toLowerCase();
  const toggles = { c: "cardio", v: "vent", o: "rootvent", s: "sucker" };
  if (toggles[key]) {
    event.preventDefault();
    toggle(toggles[key]);
    return;
  }
  if (key === "r") {
    event.preventDefault();
    change(() => {
      state.route = state.route === "antegrade" ? "retrograde" : "antegrade";
      if (byId.cardio.target > 0) byId.cardio.target = cpRun();
    });
    return;
  }
  if (key === "k") {
    event.preventDefault();
    change(() => (state.clamped = !state.clamped));
    return;
  }
  if (key === "a") {
    event.preventDefault();
    change(() => (state.vavd = !state.vavd));
    return;
  }
  const step = event.shiftKey ? 500 : 50;
  const from = touring ? Math.round(drive.knob / 10) * 10 : drive.target;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = from + step;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = from - step;
  if (event.key === "End") to = M.RPM_FULL;
  if (event.key === " " || event.key === "Enter") to = from > 0 ? 0 : M.RPM_FULL;
  if (event.key === "Home" || event.key === "Escape") {
    event.preventDefault();
    change(() => {
      state.clamped = true;
      drive.target = 0;
      pumps.forEach((entry) => (entry.target = 0));
      state.vavd = false;
      state.mapTarget = M.MAP;
    });
    return;
  }
  if (to === null) return;
  event.preventDefault();
  setDrive(to);
});
if (still.matches) touring = false;
pumps.forEach(placeRotor);
placeVanes(0);
placeNeedle(0);
placeLevel(state.volume);
describe();
say();

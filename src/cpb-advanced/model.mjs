// The one model every number on the page comes from.

// ---- roller pumps: an occlusive head moves the tube's whole lumen once round the raceway per revolution ----
const lumen = (idMm) => Math.PI * (idMm / 2) ** 2;
const pathOf = (idMm, wallMm, racewayMm) => 2 * Math.PI * (racewayMm / 2 - (idMm / 2 + wallMm));

// sucker, root vent and LV vent: 1/4 inch boots (1/16 inch wall) in 85 mm heads
export const SMALL_ID_MM = 6.35;
export const SMALL_WALL_MM = 1.59;
export const SMALL_D_MM = 85;
export const SMALL_STROKE_ML = (lumen(SMALL_ID_MM) * pathOf(SMALL_ID_MM, SMALL_WALL_MM, SMALL_D_MM)) / 1000;

// blood cardioplegia: a 1/4 inch blood boot and a 1/8 inch crystalloid boot share one raceway and one pair of rollers,
// so every revolution sweeps the same length of both and the mix is their lumen ratio, (1/4 ÷ 1/8)² = 4:1
export const CP_BLOOD_ID_MM = 6.35;
export const CP_CRYSTAL_ID_MM = 3.175;
const CP_PATH_MM = pathOf(CP_BLOOD_ID_MM, SMALL_WALL_MM, SMALL_D_MM);
export const CP_BLOOD_ML = (lumen(CP_BLOOD_ID_MM) * CP_PATH_MM) / 1000;
export const CP_CRYSTAL_ML = (lumen(CP_CRYSTAL_ID_MM) * CP_PATH_MM) / 1000;
export const CP_RATIO = CP_BLOOD_ML / CP_CRYSTAL_ML;
export const CP_STROKE_ML = CP_BLOOD_ML + CP_CRYSTAL_ML;

// ---- centrifugal arterial pump ----
// Pump head rises with the square of speed (affinity law). Rotaflow: up to 806 mmHg at its 5000 rpm limit.
export const RPM_MAX = 5000;
export const HEAD_A = 806 / RPM_MAX ** 2; // mmHg per rpm²
// Losses through the pump, oxygenator, filter, tubing and aortic cannula grow with the square of flow.
// Fitted so 3000 rpm gives about 5 L/min at a MAP of 65; the same constant then gives about 9 L/min at 5000 rpm,
// the Rotaflow's measured maximum (9.08 L/min).
export const LOSS_K = 9.2; // mmHg per (L/min)²
export const MAP = 65; // mmHg, the patient's mean arterial pressure the pump pushes against
// flow is set where the pump's head equals MAP plus the losses; below the speed whose head equals MAP,
// a centrifugal pump cannot hold the patient's pressure and blood runs backwards through it unless the line is clamped
export const flowAt = (rpm, map = MAP) => {
  const head = HEAD_A * rpm * rpm - map;
  return Math.sign(head) * Math.sqrt(Math.abs(head) / LOSS_K);
};
export const rpmFor = (flow, map = MAP) => Math.sqrt((map + LOSS_K * flow * flow) / HEAD_A);
export const RPM_ZERO = rpmFor(0);

export const BSA = 1.8; // m², 170 cm 70 kg (Mosteller)
export const CI_FULL = 2.4; // L/min/m², full flow at normothermia
export const FLOW_FULL = CI_FULL * BSA;
export const RPM_FULL = rpmFor(FLOW_FULL);

// the speeds the tour runs the roller pumps at
export const RPM_CP_ANTEGRADE = 40;
export const RPM_CP_RETROGRADE = 24;
export const RPM_VENT = 30;
export const RPM_ROOT_VENT = 20;
export const RPM_SUCKER = 25;

// ---- venous drainage ----
// Bicaval drainage by gravity, with the reservoir about 40 cm below the atrium (≈ 30 mmHg), is taken to reach
// 3.2 L/min through the cannulas drawn here. Flow through a cannula grows with the square root of the pressure
// drop across it, so a vacuum on the sealed reservoir adds to that drop. Controllers range 0 to −100 mmHg;
// −40 mmHg is a common setting.
export const GRAVITY_MMHG = 30;
export const GRAVITY_FLOW = 3.2;
export const VAVD_MMHG = 40;
export const drainCap = (vacuum) => GRAVITY_FLOW * Math.sqrt((GRAVITY_MMHG + vacuum) / GRAVITY_MMHG);

// ---- reservoir ----
// Venous return catches up with what went into the patient with a 4 s lag, up to what the cannulas can drain;
// the difference waits in the patient's veins. Crystalloid cardioplegia adds volume to the circuit.
export const PRIME_ML = 1500;
export const LAG_S = 4;
export const RES_MAX_ML = 3000;

export const smallFlowOf = (rpm) => (rpm * SMALL_STROKE_ML) / 1000;
export const ciOf = (flow) => flow / BSA;

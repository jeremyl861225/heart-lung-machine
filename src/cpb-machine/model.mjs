// The one model every number on the page comes from.
// An occlusive roller pump moves the tube's whole lumen once round the raceway per revolution,
// so its stroke volume is the lumen area times the path the rollers sweep along the tube's centreline.
const strokeOf = (idMm, wallMm, racewayMm) => (Math.PI * (idMm / 2) ** 2 * 2 * Math.PI * (racewayMm / 2 - (idMm / 2 + wallMm))) / 1000;

// arterial pump: 1/2 inch boot (3/32 inch wall) in the 150 mm head
export const TUBE_ID_MM = 12.7;
export const TUBE_WALL_MM = 2.38;
export const RACEWAY_D_MM = 150;
export const CENTRE_R_MM = RACEWAY_D_MM / 2 - (TUBE_ID_MM / 2 + TUBE_WALL_MM);
export const STROKE_ML = strokeOf(TUBE_ID_MM, TUBE_WALL_MM, RACEWAY_D_MM);

// cardioplegia, vent and sucker pumps: 1/4 inch boots (1/16 inch wall) in 85 mm heads
export const SMALL_ID_MM = 6.35;
export const SMALL_WALL_MM = 1.59;
export const SMALL_D_MM = 85;
export const SMALL_STROKE_ML = strokeOf(SMALL_ID_MM, SMALL_WALL_MM, SMALL_D_MM);

export const BSA = 1.8; // m², 170 cm 70 kg (Mosteller)
export const CI_FULL = 2.4; // L/min/m², full flow at normothermia
export const FLOW_FULL = CI_FULL * BSA;
export const RPM_FULL = (FLOW_FULL * 1000) / STROKE_ML;
export const RPM_MAX = 120;

// the speeds the tour runs the small pumps at
export const RPM_CARDIOPLEGIA = 40;
export const RPM_VENT = 30;
export const RPM_SUCKER = 25;

// Reservoir: venous return catches up with what went into the patient with a 4 s lag;
// the difference waits in the patient's veins. Crystalloid cardioplegia adds volume to the circuit.
export const PRIME_ML = 1200;
export const LAG_S = 4;
export const RES_MAX_ML = 3000;

export const flowOf = (rpm) => (rpm * STROKE_ML) / 1000;
export const smallFlowOf = (rpm) => (rpm * SMALL_STROKE_ML) / 1000;
export const ciOf = (flow) => flow / BSA;

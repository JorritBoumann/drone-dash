/** Tunable constants. Live-editable through `?debug` (lil-gui). */
export const FLIGHT = {
  thrust: 26, // m/s^2 forward/back acceleration
  maxSpeed: 17, // m/s cruise top speed
  boostSpeed: 31, // m/s top speed while boosting
  boostThrust: 48,
  turnRate: 2.35, // rad/s max yaw rate
  turnResponse: 7, // how fast yaw rate reaches its target
  lateralGrip: 2.6, // how quickly sideways drift bleeds off (gives momentum feel)
  climbSpeed: 10, // m/s vertical target speed
  descendSpeed: 16, // m/s target sink speed when descending
  climbResponse: 4.5,
  sinkBrakeResponse: 7, // how fast a descent is arrested when descend is released
  hoverBob: 0.12, // m amplitude of idle bob
  maxAltitude: 105,
  radius: 0.95, // collision sphere
  bounce: 0.35, // restitution against walls
  bumpFriction: 0.55, // tangential speed kept after a bump
  bankAngle: 0.55, // rad roll at full turn & speed
  pitchAngle: 0.32, // rad pitch at full acceleration
  boostDrain: 0.38, // per second
  boostRegen: 0.16, // per second
  boostRegenDelay: 0.9, // s
  hopHeight: 2.2, // m: ledges lower than this above the skids are skimmed over when flying into them
  hopSpeed: 6, // m/s upward while skimming a ledge
  hopTime: 0.3, // s
  guideBrakeRange: 28, // m: diving toward the pad inside this range bleeds leftover boost speed at the normal rate
  guideRange: 11, // m: drop guide eases the drone toward the pad centre inside this horizontal distance
  guideSpeed: 6, // m/s max guided drift
  guidePull: 3, // 1/s how firmly the guide steers
  guideLowHeight: 6, // m: below this height above the pad the guide also helps while hovering
};

export const CAMERA = {
  distance: 6.4,
  height: 2.3,
  lookAhead: 4,
  followLag: 6.5, // higher = tighter
  yawLag: 4.2,
  fov: 60,
  boostFov: 68,
  speedFov: 4, // extra fov at top cruise speed
  maxFov: 70,
  maxDistance: 8,
  maxHeight: 9,
  heightPerAlt: 0.12,
  // final approach: when the target is close and below, the camera rises, pulls in and pitches down to frame the pad
  approachStart: 45, // m horizontal distance where the framing starts to blend in
  approachFull: 18, // m where it is fully on
  approachRise: 4.5, // m extra camera height
  approachPullIn: 0.18, // fraction of follow distance removed
};

export const RUN = {
  startTime: 50,
  minTimeBonus: 7,
  pickupRadius: 3.2,
  deliverRadius: 3.4,
  verticalTolerance: 3.6,
  baseScore: 100,
  maxCombo: 5,
};

/**
 * Crash stakes. Severity is the speed (m/s) a single hit takes off the drone. Scrapes below `threshold`
 * are free; anything harder breaks the combo and takes seconds off the clock, scaled by how hard it was.
 * One crash is charged per collision: follow-up contacts inside `window` only top up to the harder tier.
 */
export const CRASH = {
  threshold: 7,
  tiers: [
    { severity: 7, seconds: 3, label: 'Crash' },
    { severity: 16, seconds: 4, label: 'Hard crash' },
    { severity: 26, seconds: 5, label: 'Wreck' },
  ],
  window: 1.2,
  chainGap: 0.15, // contacts closer than this count as one hit when measuring speed lost
  hitSpan: 0.2, // speed lost is summed over at most this long from first contact
  floor: 1, // a crash never takes the clock below this; crashes do not end the run on their own
};

export const QUALITY = {
  maxDpr: 2,
  exposure: 0.95,
  bloom: true,
  shadowMapSize: 2048,
  shadowExtent: 75,
};

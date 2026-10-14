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
  stepUp: 0.9, // m: lips up to this high above the skids (parapets, kerbs, rims) are stepped over at full speed
  hopSpeed: 6, // m/s upward while skimming a ledge
  hopTime: 0.3, // s
  guideBrakeRange: 28, // m: diving toward the pad inside this range bleeds leftover boost speed at the normal rate
  guideRange: 11, // m: drop guide eases the drone toward the pad centre inside this horizontal distance
  guideSpeed: 6, // m/s max guided drift
  guidePull: 3, // 1/s how firmly the guide steers
  guideLowHeight: 6, // m: below this height above the pad the guide also helps while hovering
  headwindStart: 20, // m: above the roofline the wind picks up...
  headwindFull: 28, // m: ...and is full from here up
  headwindSlow: 0.2, // fraction of cruise and boost top speed the full headwind takes away
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
  chainGap: 0.15, // s: wall contacts closer than this belong to the same collision
  hitSpan: 0.2, // s: speed lost is summed over this long from first contact, then the hit is judged (a ledge hop in that span makes it a skim)
  padEdgeRange: 30, // m: near the current pad, clipping the top edge of the pad's own block is a landing, not a crash
  padEdgeDepth: 4, // m: ...when the drone's skids are at most this far below that edge
  floor: 1, // a crash never takes the clock below this; crashes do not end the run on their own
};

export const QUALITY = {
  maxDpr: 2,
  exposure: 0.95,
  bloom: true,
  shadowMapSize: 2048,
  shadowExtent: 75,
};

/**
 * Slipstream: the reward for the low street line, and a skill reward. The meter fills by DISTANCE flown in the draft,
 * scaled by draft quality: quality = wall factor (how close the nearest facade is; a facade across the street adds a
 * little) x speed factor (nothing below `minSpeed`, full from `fullSpeed`). So a fast pass fills it several times faster
 * than a crawl over the same street, the street centre is only partial strength, and a tight line along a facade
 * (`hug`) fills faster still. Each full meter pays `points` (+`chainStep` per chained payout), `boost` of the boost tank
 * and `seconds` on the clock. A chain needs the next payout within `chainWindow` seconds, so only quick, tight flying
 * keeps it climbing. The parcel you are carrying soaks up the chain: a delivery pays `hotStep` extra per chain step
 * held at the drop (the street line's way to make deliveries pay more, shown as "street x1.4").
 */
export const SLIPSTREAM = {
  maxAlt: 18, // m above the street
  reach: 16, // m: facades further than this give no draft
  full: 4, // m: at or inside this distance the wall factor is full (the street centre, 9 m from each facade, is about 0.7 with both sides)
  canyon: 0.2, // weight of a second facade across the street
  hugDist: 5, // m: inside this distance a facade gives the hug bonus (fills faster)...
  hugFull: 2.5, // m: ...full bonus at or inside this
  hugBonus: 0.6, // extra fill rate at a full hug (1.6x on top of the full wall factor)
  minSpeed: 4, // m/s: no draft below this
  fullSpeed: 13, // m/s: full speed factor from here (cruise top speed is 17; a touch stick at three quarters gets it)
  parQuality: 0.55, // while the draft quality is at least this (fast, near a facade), the fast-drop clock (leg par) does not run
  minQuality: 0.08,
  roofSlack: 1.5, // m: a facade whose roof is up to this far below the drone still counts (skimming a roof edge drafts too)
  fill: 1, // meter metres per metre flown at quality 1 (no hug)
  drain: 0.05, // meter per second once out of the draft
  grace: 3, // s out of the draft before the meter drains (crossing an intersection or rounding a corner keeps it)
  chainReset: 6, // s out of the draft before the chain resets (a corner on the 44 m grid does not break it)
  chainWindow: 9, // s: the chain also resets when the next payout takes longer than this (a crawl cannot build a chain)
  points: 50,
  chainStep: 30, // x1 50, x2 80, x3 110, x4 140, x5 170 (flat: the delivery combo does not multiply these, the chain is their own multiplier)
  maxChain: 5,
  introMeter: 4, // the very first meter of a run is short, so a new player sees a payout within seconds of the first draft
  firstMeter: 14, // meter size in draft metres before the first payout of a chain (a quick first payout teaches the rule)...
  meterPerChain: 4, // ...and it grows by this per chain step, so a long chain pays more but less often
  rateGood: 7, // draft metres per second for two HUD chevrons (a crawl is one chevron, the street centre at cruise about 10: two)...
  rateTop: 16, // ...and three for a tight line along a facade at cruise, or boosting
  hotStep: 0.15, // delivery bonus per slipstream chain step held at the drop (x5 chain: +75%)
  boost: 0.3,
  seconds: 0.5,
};

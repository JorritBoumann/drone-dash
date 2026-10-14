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
  fastBonus: 75, // points for beating the leg's par (before the combo multiplier)
  parSpeed: 9, // m/s: a leg's par is its street-route length at this speed (a clean street run with corners)...
  parSlack: 7, // ...plus this many seconds
  maxCombo: 5,
  comboStep: 0.5, // multiplier added per fast drop in a row
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
 * and points; drafting itself slows the clock (see `clockRate`). A chain needs the next payout within `chainWindow` seconds, so only quick, tight flying
 * keeps it climbing. Drafting pays only through these payouts (round 9: no street multiplier on deliveries and no par
 * pause), so the "Slipstream" line of the game-over breakdown is every point that exists because of drafting.
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
  minQuality: 0.08,
  roofSlack: 1.5, // m: a facade whose roof is up to this far below the drone still counts (skimming a roof edge drafts too)
  fill: 1, // meter metres per metre flown at quality 1 (no hug)
  drain: 0.05, // meter per second once out of the draft
  grace: 3, // s out of the draft before the meter drains (crossing an intersection or rounding a corner keeps it)
  chainReset: 6, // s out of the draft before the chain resets (a corner on the 44 m grid does not break it)
  chainWindow: 9, // s: the chain also resets when the next payout takes longer than this (a crawl cannot build a chain)
  points: 45,
  chainStep: 25, // x1 45, x2 70, x3 95, x4 120, x5 145 (flat: the delivery combo does not multiply these, the chain is their own multiplier)
  maxChain: 5,
  introMeter: 4, // the very first meter of a run is short, so a new player sees a payout within seconds of the first draft...
  introSpeedFloor: 0.6, // ...and on it the speed factor is at least this (above minSpeed), so a slow touch pilot gets it quickly too
  firstMeter: 14, // meter size in draft metres before the first payout of a chain (a quick first payout teaches the rule)...
  meterPerChain: 4, // ...and it grows by this per chain step, so a long chain pays more but less often
  rateGood: 7, // draft metres per second for two HUD chevrons (a crawl is one chevron, the street centre at cruise about 10: two)...
  rateTop: 16, // ...and three for a tight line along a facade at cruise, or boosting
  boost: 0.3,
  // Slow clock (round 12b): while the drone drafts, the run clock drains slower. It gains `clockRate` seconds per
  // second at full draft (the clock runs at 1 - clockRate speed), scaled by draft pace: the meter's own fill rate in draft
  // metres a second (speed x wall closeness, the HUD chevron measure). Nothing at or below `clockLow` (a slow, centred
  // crawl), all of it from `clockFull` (fast and close to a facade). It also shrinks with the run like the drop time bonus.
  // This replaces the old 0.5 s per payout: payouts now pay points only, and the street line's clock income is smooth.
  // clockRate is set so a good street pilot's clock income a minute matches the roof line's income from deliveries.
  clockLow: 5,
  clockFull: 10,
  clockRate: 1,
  // Round 13: the slow clock serves deliveries, not farming. (1) It only runs while the drone flies toward its current
  // objective (pickup or drop): heading within about 80 degrees of the target gives all of it, flying away gives none.
  // (2) Each leg has a budget of `clockBudget` clock seconds. Picking a parcel up or delivering it refills the budget to
  // this cap (it does not stack), so a run with no deliveries gets at most two budgets (start + one pickup) in total.
  // A routed street pilot used 5 to 9 s of slow clock per pickup-and-drop cycle in round 12, so honest runs keep it.
  clockBudget: 8,
  towardLow: -0.1, // cos(heading to target): at or below this the slow clock is off...
  towardFull: 0.2, // ...and full from here
};

/**
 * Score goals: medals for one run's score, shown on the title, as the next target in the HUD and on game over.
 * Calibrated on the balance bots (seeds 22, 58, 130): a slow, centred, no-boost flier reaches Bronze at most; a decent
 * street or roof route reaches Silver most runs; Gold needs a clean, fast run; Ace is above every bot run.
 * Round 12b: Silver 2250 -> 1775. The slow clock gives a lazy flier almost no clock time (under 1.2 s a run), while a
 * routed street pilot who rarely chains past x3 (seed 58) lands at 1,840 to 1,910. The lazy bot's best is 1,728, so
 * Silver sits between the two. The band is thin: see progress/round-12/builder2.md.
 */
export const GOALS = {
  tiers: [
    { name: 'Bronze', score: 1000 },
    { name: 'Silver', score: 1775 },
    { name: 'Gold', score: 4500 },
    { name: 'Ace', score: 7500 },
  ],
};

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
  startTime: 56, // round 17: 50 -> 56 (with the smaller slow clock budget below, a slow but steady run keeps its third drop)
  minTimeBonus: 7,
  pickupRadius: 3.2,
  deliverRadius: 3.4,
  verticalTolerance: 3.6,
  baseScore: 100,
  fastBonus: 75, // points for beating the leg's par (before the combo multiplier)
  parSpeed: 9, // m/s: a leg's par is its street-route length at this speed (a clean street run with corners)...
  parSlack: 7, // ...plus this many seconds
  maxCombo: 5,
  // Round 17: 0.5 -> 0.15. At 0.5 the fifth fast drop paid x3.5 and the third x2.5, so every delivery was worth more than
  // the last and one missed drop near the end cost 40 to 50 percent of the run. At 0.2 the chain still rewards a clean
  // run (x1.75 at five) but each delivery adds a similar amount.
  comboStep: 0.15, // multiplier added per fast drop in a row
  // Round 17: the run's ending. When the clock hits 0 with a parcel aboard, `overtime` seconds of overtime start: finish
  // that one delivery (its points pay as normal, its street bonus by the share of the leg flown when the clock ran out,
  // so overtime finishes a parcel that was nearly there but does not cash in a bank farmed far from the drop; it adds no
  // clock and no new job, and the run ends on it). Overtime happens once a
  // run. A crash in overtime still costs seconds. If the clock runs out for good (no parcel aboard, or overtime spent),
  // the street bonus banked on the current leg pays by the share of the leg flown (see Game.timeUp), only on a run that
  // has delivered at least once, so a no-delivery farm still scores 0.
  // Overtime is sized to the parcel in hand: the street route left at `overtimeSpeed` m/s plus `overtimeSlack` s, between
  // `overtimeMin` and `overtime` s (a 30 m rooftop finish gets about 9 s, a 70 m street leg the full 15).
  overtime: 15,
  // Overtime and the time-up share are only for a leg on schedule: flown in at most `scheduleSlack` x its par (street
  // route / parSpeed + parSlack). A parcel that sat aboard while its bank was farmed gets neither.
  scheduleSlack: 1.6,
  overtimeMin: 8,
  overtimeSpeed: 6,
  overtimeSlack: 4,
  // Round 17: last call. A parcel picked up with less than `lastCallAt` s on the clock gets a drop that fits the time
  // left plus overtime at `lastCallSpeed` m/s of street (at least `lastCallMin` m), at street level (no rooftop job).
  // A last-call drop adds no clock (it pays points as normal), so the end of a run is a run of short jobs on a bleeding
  // clock, not a cliff and not a loop of short legs that pay for themselves.
  // Round 18: the time-up share needs this many deliveries (a one-delivery farm cannot cash its bank at time-up) and
  // pays at most the street bonus paid per delivery so far (Game.timeUp).
  partialMinDrops: 2,
  lastCallAt: 22,
  lastCallSpeed: 7,
  lastCallMin: 55,
  clockDecayStep: 0.06, // drop time bonus and slow clock shrink by this share per delivery (floor 0.55; round 17: 0.035 -> 0.06, so a fast run tops out near six drops instead of snowballing to eight)
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
  introMeter: 2.5, // round 19: 3 -> 2.5 (mobile hand-fly first payout was 9.9 s, the line is 10 s). The very first meter of a run is short, so a new player sees a payout within seconds of the first draft (round 17: 4 -> 3)...
  introMinSpeed: 3, // ...it counts from this speed (round 17: was minSpeed, 4; the mobile hand-fly first payout was 9.9 s)...
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
  clockBudget: 5, // round 17: 8 -> 5. A fast run earned the full budget every leg and snowballed to 6 to 8 drops; a slow one earned 2 to 4 s
  towardLow: -0.1, // cos(heading to target): at or below this the slow clock is off...
  towardFull: 0.2, // ...and full from here
  // Round 14: the street bonus. Slip payouts no longer score on their own. Each payout is banked on the parcel run
  // (shown in the objective pill) and the bank is paid on delivery. With no delivery, drafting scores nothing (it still
  // refills boost, builds the chain and drives the music). Payouts while carrying bank `bankCarry` of their points, on
  // the way to a pickup `bankPickup` (the bank then rides on the parcel you pick up). Each leg can bank at most
  // `bankPerMetre` x the leg's street route (grid distance), so circling a wall with a parcel aboard stops paying once
  // the leg's share is full. A hard crash or worse keeps `bankCrashKeep` of the bank. When the clock runs out, the bank is lost.
  // Each payout banks points x pace weight: the meter's mean fill rate over that payout (draft metres a second, the HUD
  // chevron measure) maps linearly from `bankPaceMin` at `bankPaceLow` to 1 at `bankPaceFull` and on up to `bankPaceMax`.
  // A slow, centred crawl (2 to 4 m/s of draft) banks a fifth to a half; a fast street line along the facades (8 to
  // 14) banks 1.5 to 2.5 times. Balance bots: the lazy flier's payouts average 3, the routed street pilot's 4 to 14.
  // Round 20: 1 -> 1.15 and 0.75 -> 0.86. The street line's own edge over the roof line (low over high had slipped to
  // 0.78 in real time). Safe now that a parcel off its route banks nothing and fades (stale* below), so farms gain nothing.
  bankCarry: 1.15,
  bankPickup: 0.86,
  bankPaceLow: 2.5,
  bankPaceFull: 6,
  bankPaceMin: 0.2,
  bankPaceMax: 1.8, // round 17: 2.5 -> 1.8 (a fast run's street bonus no longer runs away from a steady one)
  bankPerMetre: 5, // round 20: 7 -> 5 (honest legs bank 2 to 4 points per metre of route; a farm phase filled the rest) // round 17: unchanged (3.5 was tried: the carry farm then filled its share fast and delivered like an honest run). Honest street legs banked up to 6 points per metre of street route on the balance bots
  bankLegMin: 150, // points: every leg can bank at least this much (very short legs)
  bankCrashKeep: 0.5,
  bankCrashTier: 1, // CRASH.tiers index from which a crash cuts the bank (1 = Hard crash)
  // Round 15: the run's first payout banks at least this many points (it used to bank about 7 after a slow intro draft,
  // which read as "drafting does nothing"). Still banked, so it is paid only on delivery: a no-delivery farm stays at 0.
  bankFirstMin: 25,
  // Round 20: a parcel off its route goes stale. Four times a second the game measures the street route left to the
  // objective (alleys and tunnels included, plus any climb). When it has not improved by `staleStep` m for `staleAfter` s
  // (circling a wall, shuttling in a tunnel, tailing a van the wrong way), payouts bank nothing, the slow clock stops,
  // and the bank fades by `staleDrain` of itself a second until the leg makes progress again. Honest legs never stall
  // that long (a grid detour or a turn back to the right street is under 4 s).
  staleStep: 2,
  staleAfter: 5,
  staleDrain: 0.2,
  staleNear: 25, // m: no stale this close to the objective (a payout there still banks only by progress)
  // Round 20: each payout banks by the leg's progress while it filled: route metres gained / metres flown, full at or
  // above this (an honest street line is 0.7 to 1, a grid line on a shortcut leg 0.6 or more).
  bankProgress: 0.4,
};

/**
 * Round 15 escalation: rush hour. At `startAt` seconds of run time it is announced once (banner and horn). From then on
 * every second parcel is a rush order, and every parcel from `everyAt` seconds. A rush order must reach its drop within
 * its window: the leg's street route (grid distance) at `speed` plus `slack` seconds (shorter than the fast-drop par,
 * which is route / 9 + 7). Made in time it adds `bonus` flat points (no combo). Missed, the parcel still pays as normal.
 * It never adds clock time and never touches the objective RNG, so run length and the parcel order are unchanged.
 */
export const RUSH = {
  startAt: 60,
  everyAt: 120,
  speed: 11,
  slack: 5,
  bonus: 150,
};

/**
 * Score goals: medals for one run's score, shown on the title, as the next target in the HUD and on game over.
 * Calibrated on the balance bots (seeds 22, 58, 130): a slow, centred, no-boost flier reaches Bronze at most; a decent
 * street or roof route reaches Silver most runs; Gold needs a clean, fast run; Ace is above every bot run.
 * Round 12b: Silver 2250 -> 1775. The slow clock gives a lazy flier almost no clock time (under 1.2 s a run), while a
 * routed street pilot who rarely chains past x3 (seed 58) lands at 1,840 to 1,910. The lazy bot's best is 1,728, so
 * Silver sits between the two. The band is thin: see progress/round-12/builder2.md.
 * Round 13: Silver 1775 -> 1600. With the slow clock only on the way to the objective, the lazy flier's seed 22 run
 * misses its second drop (844, was 1,728), so its best is 1,141. The routed street pilot's worst is seed 58 at 1,792.
 * Silver sits 459 above the first and 192 below the second: see progress/round-13/builder.md.
 * Round 14: slipstream points are a street bonus paid on delivery and weighted by draft pace (SLIPSTREAM.bank*), so a
 * no-delivery farm scores 0 and the lazy flier keeps little of its drafting. Lazy best 1,249; routed street worst 2,046
 * (gap 797). Silver 1600 -> 1650 sits 401 above and 396 below. Ace 7500 -> 8500: the street line now keeps more of
 * a fast run's drafting (best bot 6,927, desktop medal journey 6,903). See progress/round-14/builder.md.
 * Round 16: legs follow one spec on every city (DeliverySystem.JOBS: bounded street distance, low pickups, a capped
 * rooftop every third drop), so runs no longer die on a tower-heavy first leg. The street bot now makes 4 to 5 drops
 * (4,945 to 8,891 on the four hardest round 15 cities) and the lazy bot 2 (1,210 to 1,637). Silver 1650 -> 2500,
 * Gold 4500 -> 6000, Ace 8500 -> 10000. See progress/round-16/builder.md.
 * Round 17: a flatter score (combo step 0.15, street bonus pace max 1.8 and 3.5 points per metre, time bonus decay
 * 0.06 per drop) and a softer ending (overtime, last call, time-up share of the bank). The deterministic street bot
 * scores 2,047 to 7,108 on 23 of 24 cities (1,291 on 62367). Silver 2500 -> 2000, Gold 6000 -> 4500, Ace 10000 -> 9000.
 * See progress/round-17/builder.md.
 * Round 18: Ace 9000 -> 10000. Shortcuts (boulevards, alleys, tunnels) make a skilled line faster: the shortcut-taking
 * street bot reached 9,155 on one of 12 fresh cities (plain street bot 7,359 there). See progress/round-18/builder.md.
 */
export const GOALS = {
  tiers: [
    { name: 'Bronze', score: 1000 },
    { name: 'Silver', score: 2000 },
    { name: 'Gold', score: 4500 },
    { name: 'Ace', score: 10000 },
  ],
};

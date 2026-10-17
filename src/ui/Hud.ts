import type { MarkerKind } from '../entities/ObjectiveMarker';
import { GOALS } from '../game/config';
import { nextGoal, tierName } from '../game/goals';

/** Everything the game-over card explains. The point lines sum exactly to `score`. */
export type RunSummary = {
  score: number;
  best: number;
  bestTier: number;
  newBest: boolean;
  tier: number;
  deliveries: number;
  fastCount: number;
  topCombo: number; // highest combo multiplier reached (1 = none)
  drops: number;
  fast: number;
  combo: number;
  slip: number;
  slipPayouts: number;
  bankPaid: number; // deliveries that paid a street bonus
  bankUnpaid: number; // street bonus still banked when the clock ran out (lost)
  bankLost: number; // street bonus cut by hard crashes
  startTime: number;
  dropSeconds: number;
  slipSeconds: number;
  crashSeconds: number;
  crashes: number;
  rush: number; // rush order bonus points (part of `fast`)
  rushMade: number;
  rushOrders: number;
  partial: number; // round 17: street bonus paid at time-up by the share of the leg flown (part of `slip`)
  partialShare: number; // 0..1
  overtimeSeconds: number; // round 17: seconds flown in overtime
  overtimeDrop: boolean; // round 17: the run ended on a delivery made in overtime
  dailyNew: boolean;
};

/** Round 24: a screen box in CSS px. */
export type Box = { l: number; t: number; r: number; b: number };
export type TouchLayout = { w: number; h: number; controls: Box[]; top: Box[]; pillBottom: number; bottomTop: number; slot: Box };

export type CityInfo = { mode: 'seed' | 'random' | 'daily'; label: string; best: number; tier: number };

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
/** Round 17: combo multipliers step by 0.15 (x1.15, x1.3, x1.45 ...): up to two decimals, no trailing zero. */
export const fmtX = (m: number) => `x${Math.round(m * 100) / 100}`;
/** Clock seconds: whole numbers plain, halves with one decimal (2, 2.5). */
const fmtSec = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
/** Game-over detail for the street bonus row: how many drops paid one, and what was lost (not part of the sum). */
const bankDetail = (r: RunSummary) => {
  const bits = [r.bankPaid > 0 ? `paid on ${r.bankPaid} drop${r.bankPaid === 1 ? '' : 's'}` : 'paid on delivery'];
  const lost = Math.round(r.bankUnpaid + r.bankLost);
  if (lost > 0) bits.push(`${fmt(lost)} lost`);
  return bits.join(' · ');
};

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

type CentreKind = 'pop' | 'medal' | 'event' | 'slip';
const CENTRE: Record<CentreKind, { prio: number; minMs: number; durMs: number; staleMs: number }> = {
  medal: { prio: 3, minMs: 1500, durMs: 2300, staleMs: 6000 },
  event: { prio: 2, minMs: 1800, durMs: 3000, staleMs: 6000 },
  pop: { prio: 1, minMs: 900, durMs: 1500, staleMs: 2500 },
  slip: { prio: 0, minMs: 650, durMs: 1300, staleMs: 1200 },
};

export type ScreenName = 'title' | 'playing' | 'paused' | 'over';

/** DOM HUD + menus. Writes only when values change. */
export class Hud {
  readonly app = $('app');
  private readonly score = $('score-value');
  private readonly comboChip = $('combo-chip');
  private readonly comboValue = $('combo-value');
  private readonly timer = $('timer');
  private readonly timerValue = $('timer-value');
  private readonly timerRing = document.getElementById('timer-ring-fg') as unknown as SVGCircleElement;
  private readonly timeBonus = $('time-bonus');
  private readonly timePenalty = $('time-penalty');
  private comboBreakTimer = 0;
  private timerHitTimer = 0;
  private readonly objective = $('objective');
  private readonly objectiveVerb = $('objective-verb');
  private readonly objectiveName = $('objective-name');
  private readonly objectiveBank = $('objective-bank');
  private readonly objectiveBankValue = $('objective-bank-value');
  private bankShown = -1;
  // round 15: the banked amount counts up in the pill and next to the score instead of jumping
  private bankTarget = 0;
  private bankShownF = 0;
  private readonly scorePending = $('score-pending');
  private readonly objectiveRush = $('objective-rush');
  private readonly objectiveRushValue = $('objective-rush-value');
  private rushShown = '';
  private rushFrac = -1;
  private readonly eventPopEl = $('event-pop');
  private readonly eventPopMain = $('event-pop-main');
  private readonly eventPopSub = $('event-pop-sub');
  private readonly deliveries = $('deliveries-value');
  private readonly boost = document.querySelector('.boost') as HTMLElement;
  private readonly boostFill = $('boost-fill');
  private readonly speed = $('speed-value');
  private readonly alt = $('alt-value');
  private readonly nav = $('nav-marker');
  private readonly navArrow = document.querySelector('.nav-arrow') as HTMLElement;
  private readonly navDistance = $('nav-distance');
  private readonly pop = $('pop');
  private readonly speedLines = $('speed-lines');
  private readonly hitFlashEl = $('hit-flash');
  private speedLinesLevel = -1;
  private readonly slip = $('slip');
  private readonly slipFill = $('slip-fill');
  private readonly slipChain = $('slip-chain');
  private readonly slipRate = $('slip-rate');
  private readonly slipCue = $('slip-cue');
  private readonly slipPopEl = $('slip-pop');
  private readonly slipPopMain = $('slip-pop-main');
  private readonly slipPopSub = $('slip-pop-sub');
  private readonly timerSlow = $('timer-slow');
  private slowShown = false;
  private slowFrac = -1;
  slowBudgetMax = 8; // s: the per-leg slow clock budget (the badge bar is full at this)
  private readonly timerSlowText = $('timer-slow-text');
  private slowSpent = false; // drafting with this leg's slow clock budget used up (muted tag)
  private slowOff = 0; // s since the slow clock last ran (the marker lingers briefly so it does not flicker)
  private hintLeft = 0; // s of first-time hint still to show while the meter is up
  private hintRuns = 0;
  private hintArmed = false;
  private readonly windEl = $('wind');
  private windOn = false;
  private slipLast = { level: -1, on: false, drafting: false, chain: -1, hug: false, rate: -1, cue: '' };
  private readonly goal = $('goal');
  private readonly goalName = $('goal-name');
  private readonly goalScore = $('goal-score');
  private readonly goalFill = $('goal-fill');
  private goalLast = { tier: -1, q: -1 };
  private readonly medalPopEl = $('medal-pop');
  private readonly medalPopName = $('medal-pop-name');
  private readonly medalPopSub = $('medal-pop-sub');
  private readonly popMain = $('pop-main');
  private readonly popSub = $('pop-sub');
  private readonly routeHint = $('route-hint');
  private readonly routeHintName = $('route-hint-name');
  private readonly routeHintSave = $('route-hint-save');
  private readonly routeHintLabel = $('route-hint-label');
  private routeHintTimer = 0;
  // round 20: tag over the suggested route's entrance arch (or its way out), placed like the pad marker
  private readonly gateTag = $('gate-tag');
  private readonly gateTagName = $('gate-tag-name');
  private readonly gateTagArrow = document.querySelector('.gate-tag-arrow') as HTMLElement;
  private readonly gateTagDist = $('gate-tag-dist');
  private gateLast = { name: '', kind: '', dist: -1, on: false };
  // round 19: centre messages (delivery / pickup / crash pop, medal banner, event banner, payout pop) show one at a time
  private cActive: { kind: CentreKind; el: HTMLElement; shownAt: number; minMs: number; durMs: number } | null = null;
  private cQueue: Array<{ kind: CentreKind; el: HTMLElement; prio: number; minMs: number; durMs: number; at: number; staleMs: number; apply: () => void }> = [];
  /** Log of centre messages shown (kind, text, ms), for probes. */
  centreLog: Array<{ kind: string; text: string; t: number }> = [];
  private readonly titleScreen = $('title-screen');
  private readonly pauseScreen = $('pause-screen');
  private readonly overScreen = $('over-screen');

  readonly playButton = $<HTMLButtonElement>('play-button');
  readonly resumeButton = $<HTMLButtonElement>('resume-button');
  readonly restartButton = $<HTMLButtonElement>('restart-button');
  readonly againButton = $<HTMLButtonElement>('again-button');
  readonly pauseButton = $<HTMLButtonElement>('pause-button');
  readonly cityNewButton = $<HTMLButtonElement>('city-new');
  readonly cityDailyButton = $<HTMLButtonElement>('city-daily');
  readonly overNewCityButton = $<HTMLButtonElement>('new-city-button');
  readonly musicButton = $<HTMLButtonElement>('music-toggle');
  private readonly musicLabel = $('music-label');
  private musicState = '';
  /** True while the chip still invites the first press (no sound yet). */
  get musicLocked(): boolean {
    return this.musicState === 'locked';
  }

  /** Music chip: "Tap for sound" until the audio starts, then Music on / off. */
  setMusic(ready: boolean, enabled: boolean): void {
    const st = !ready ? 'locked' : enabled ? 'on' : 'off';
    if (st === this.musicState) return;
    this.musicState = st;
    this.musicButton.dataset.state = st;
    this.musicButton.setAttribute('aria-pressed', String(st === 'on'));
    this.musicLabel.textContent = st === 'locked' ? (this.app.classList.contains('touch') ? 'Tap for sound' : 'Click or press a key for sound') : st === 'on' ? 'Music on' : 'Music off';
  }

  private last = { score: -1, time: '', combo: -1, deliveries: -1, boost: -1, speed: -1, alt: -1, dist: -1, low: false, boostState: '', slow: '' };

  setTouch(touch: boolean): void {
    this.app.classList.toggle('touch', touch);
    this.touchAt = -1e9;
  }

  /**
   * Round 25: layered teaching. On a new player's first run the HUD starts with the score, clock, objective pill and pad
   * marker only. Each system's HUD parts show once the game introduces it (`learn`). Returning players get everything.
   * Gated parts are hidden by CSS (`#app.teach:not(.l-<key>)`), so they keep their normal show/hide logic underneath.
   */
  setTeach(on: boolean): void {
    this.app.classList.toggle('teach', on);
    for (const c of Array.from(this.app.classList)) if (c.startsWith('l-')) this.app.classList.remove(c);
    this.touchAt = -1e9;
  }

  learn(key: string): void {
    this.app.classList.add(`l-${key}`);
    this.touchAt = -1e9;
  }

  /** Round 25: a one-time teaching hint, in the event banner slot (on touch: the round 24 pop slot). */
  hintPop(main: string, sub: string): void {
    this.centre('event', this.eventPopEl, () => {
      this.eventPopMain.textContent = main;
      this.eventPopSub.textContent = sub;
    }, `hint:${main}`);
  }

  get isTouch(): boolean {
    return this.app.classList.contains('touch');
  }

  // round 24: touch layout (measured from the DOM a few times a second, never per frame)
  private touchAt = -1e9;
  private touchGeo: TouchLayout | null = null;
  private readonly hudCenterEl = document.querySelector('.hud-center') as HTMLElement;
  private readonly hudScoreEl = document.querySelector('.hud-score') as HTMLElement;
  private readonly hudRightEl = document.querySelector('.hud-right') as HTMLElement;
  private readonly hudBottomEl = document.querySelector('.hud-bottom') as HTMLElement;
  private readonly stickEl = $('touch-stick');
  private readonly touchButtonsEl = document.querySelector('.touch-buttons') as HTMLElement;
  private readonly hudEl = $('hud');

  /**
   * Round 24: where things sit on a touch screen. `controls` are the stick and the button cluster (the objective marker
   * never overlaps them), `top` the score panel, the timer / objective / route column and the right chips, `pillBottom`
   * the bottom of the centre column (the camera keeps the drone below it), `popSlot` the box the centre pops use (left
   * of the drone, above the stick). Re-measured every 300 ms (and at once after a resize or a touch switch).
   */
  touchLayout(w: number, h: number): TouchLayout | null {
    if (!this.isTouch) return null;
    const now = performance.now();
    const g = this.touchGeo;
    if (g && now - this.touchAt < 300 && g.w === w && g.h === h) return g;
    this.touchAt = now;
    const R = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
    };
    const stick = R(this.stickEl);
    const btns = R(this.touchButtonsEl);
    const centre = R(this.hudCenterEl);
    const score = R(this.hudScoreEl);
    const right = R(this.hudRightEl);
    const bottom = R(this.hudBottomEl);
    const controls: Box[] = [];
    // the stick's "Fly" label sits 20 px above it
    if (stick) controls.push({ l: stick.l, t: stick.t - 20, r: stick.r, b: stick.b });
    if (btns) controls.push(btns);
    const top: Box[] = [centre, score, right].filter((b): b is Box => !!b);
    const pillBottom = centre ? centre.b : 0;
    // pop slot: from the left gutter (safe area) to 100 px left of the screen centre (the drone sits on the centre line;
    // round 25: 72 -> 100 px, the two-line hints and delivery pops reached its rotors);
    // vertically centred between the score panel and the stick
    const left = stick ? stick.l : 18;
    const slotR = w / 2 - 100;
    const upper = Math.max(score ? score.b : 0, pillBottom * 0.6) + 8;
    const lower = (stick ? stick.t - 20 : h * 0.7) - 6;
    const cy = Math.max(upper + 30, Math.min((upper + lower) / 2, h * 0.62));
    const slot: Box = { l: left, t: cy - 42, r: slotR, b: cy + 42 };
    if (!g || g.slot.l !== slot.l || g.slot.r !== slot.r || Math.abs(g.slot.t - slot.t) > 0.5) {
      this.hudEl.style.setProperty('--pop-x', `${((slot.l + slot.r) / 2).toFixed(1)}px`);
      this.hudEl.style.setProperty('--pop-y', `${cy.toFixed(1)}px`);
      this.hudEl.style.setProperty('--pop-w', `${Math.max(120, slot.r - slot.l).toFixed(1)}px`);
    }
    this.touchGeo = { w, h, controls, top, pillBottom, bottomTop: bottom ? bottom.t : h - 80, slot };
    return this.touchGeo;
  }

  /** Round 24: a centre pop is on screen (the marker keeps out of the pop slot meanwhile). */
  get popShowing(): boolean {
    const a = this.cActive;
    return !!a && performance.now() - a.shownAt < a.durMs + 400;
  }

  showScreen(name: ScreenName): void {
    this.app.dataset.state = name;
    this.titleScreen.hidden = false; // fades via CSS
    this.pauseScreen.hidden = name !== 'paused';
    this.overScreen.hidden = name !== 'over';
    if (name === 'title') this.playButton.focus({ preventScroll: true });
    if (name === 'paused') this.resumeButton.focus({ preventScroll: true });
    if (name === 'over') this.againButton.focus({ preventScroll: true });
  }

  /** Title card: the medal ladder (lit up to the best medal ever reached) and the best score with its medal. */
  setBest(best: number, bestTier = 0): void {
    $('title-best').textContent = fmt(best);
    const bt = $('title-best-tier');
    bt.textContent = bestTier > 0 ? tierName(bestTier) : '';
    bt.dataset.m = String(bestTier);
    const row = $('title-medals');
    row.innerHTML = GOALS.tiers
      .map((t, i) => `<li data-m="${i + 1}" class="${i < bestTier ? 'won' : ''}"><i class="medal" aria-hidden="true"></i><b>${t.name}</b><span>${fmt(t.score)}</span></li>`)
      .join('');
  }

  /** Round 15: the city line on the title and game-over cards, and the daily city's own best. */
  setCity(c: CityInfo): void {
    // the title label carries the daily best too, so short (phone) screens can drop the separate daily line
    $('city-label').textContent = c.mode === 'daily' && c.best > 0 ? `${c.label} · best ${fmt(c.best)}` : c.label;
    $('over-city').textContent = c.label;
    const daily = c.mode === 'daily';
    this.cityDailyButton.setAttribute('aria-pressed', String(daily));
    this.cityDailyButton.textContent = daily ? 'Daily city ✓' : 'Daily city';
    this.cityNewButton.textContent = daily ? 'Random city' : 'New city';
    $('daily-line').hidden = !daily;
    $('over-daily').hidden = !daily;
    for (const [v, t] of [['daily-best', 'daily-best-tier'], ['over-daily-best', 'over-daily-tier']]) {
      $(v).textContent = fmt(c.best);
      const bt = $(t);
      bt.textContent = c.tier > 0 ? tierName(c.tier) : '';
      bt.dataset.m = String(c.tier);
    }
  }

  /** Round 15: rush order tag in the objective pill: seconds left and a bar that empties. 0 hides it. */
  setRush(left: number, window: number): void {
    const on = left > 0 && window > 0;
    const text = on ? String(Math.ceil(left)) : '';
    if (text !== this.rushShown) {
      this.rushShown = text;
      this.objectiveRush.hidden = !on;
      this.objective.dataset.rush = on ? '1' : '0';
      this.nav.dataset.rush = on ? '1' : '0';
      this.objectiveRushValue.textContent = text;
      this.objectiveRush.classList.toggle('low', on && left <= 5);
    }
    const f = on ? Math.round((left / window) * 40) / 40 : 0;
    if (f !== this.rushFrac) {
      this.rushFrac = f;
      this.objectiveRush.style.setProperty('--left', String(f));
    }
  }

  /** Round 15: one-time event banner (rush hour), above the medal banner's spot. */
  eventPop(main: string, sub: string): void {
    this.centre('event', this.eventPopEl, () => {
      this.eventPopMain.textContent = main;
      this.eventPopSub.textContent = sub;
    }, main);
  }

  /**
   * Round 19: one centre message at a time. A message of the same kind replaces the one up (as before). Another kind
   * waits until the one up has been on screen for its reading time, then takes its place (higher priority first; a
   * newer message of a kind replaces an older queued one; payout pops that waited too long are dropped). Returns the
   * seconds until this message shows.
   */
  private centre(kind: CentreKind, el: HTMLElement, apply: () => void, text: string, prio?: number): number {
    const now = performance.now();
    const c = CENTRE[kind];
    const msg = { kind, el, prio: prio ?? c.prio, minMs: c.minMs, durMs: c.durMs, staleMs: c.staleMs, at: now, apply: () => { apply(); this.centreLog.push({ kind, text, t: Math.round(performance.now()) }); if (this.centreLog.length > 200) this.centreLog.shift(); } };
    const a = this.cActive && now - this.cActive.shownAt < this.cActive.durMs ? this.cActive : null;
    if (!a || a.kind === kind) {
      this.showCentre(msg, now);
      return 0;
    }
    this.cQueue = this.cQueue.filter((q) => q.kind !== kind);
    const i = this.cQueue.findIndex((q) => q.prio < msg.prio);
    if (i < 0) this.cQueue.push(msg);
    else this.cQueue.splice(i, 0, msg);
    let wait = Math.max(0, a.shownAt + a.minMs - now);
    for (const q of this.cQueue) { if (q === msg) break; wait += q.minMs; }
    return wait / 1000;
  }

  private showCentre(m: { kind: CentreKind; el: HTMLElement; minMs: number; durMs: number; apply: () => void }, now: number): void {
    for (const el of [this.pop, this.medalPopEl, this.eventPopEl, this.slipPopEl]) if (el !== m.el) el.classList.remove('show');
    m.apply();
    m.el.classList.remove('show');
    void m.el.offsetWidth;
    m.el.classList.add('show');
    this.cActive = { kind: m.kind, el: m.el, shownAt: now, minMs: m.minMs, durMs: m.durMs };
  }

  /** Every frame: show the next queued centre message once the one up has been read. */
  tickCentre(): void {
    if (!this.cQueue.length) return;
    const now = performance.now();
    const a = this.cActive;
    if (a && now - a.shownAt < a.durMs && now - a.shownAt < a.minMs) return;
    while (this.cQueue.length) {
      const m = this.cQueue.shift()!;
      if (now - m.at > m.staleMs) continue;
      this.showCentre(m, now);
      return;
    }
  }

  /**
   * Round 19: route hint under the objective pill at the start of each leg: the named alley, tunnel or boulevard on the
   * shortest street route, and how many metres it saves over the plain grid. Shown for 10 s. null hides it.
   */
  /** Round 20: the route changed mid-leg (the pilot went another way): the hint names the new marked entrance. */
  renameRouteHint(kind: string, name: string): void {
    if (!this.routeHint.classList.contains('show')) return;
    this.routeHint.dataset.kind = kind;
    this.routeHintLabel.textContent = kind === 'tunnel' ? 'Tunnel' : 'Shortcut';
    this.routeHintName.textContent = name;
  }

  private gatePill = document.querySelector('.gate-tag-pill') as HTMLElement;
  private gatePillSize = { name: '', dist: '', w: 120, h: 22 };
  /** Round 25: the gate tag's pill size in px (measured when its text changes; it is centred on the tag point). */
  gateTagSize(name: string, dist: number): { w: number; h: number } {
    const g = this.gatePillSize, ds = `${dist}`.length + '';
    if (g.name !== name || g.dist !== ds) {
      const r = this.gatePill.getBoundingClientRect();
      if (r.width > 0 && this.gateTagName.textContent === name) {
        g.name = name;
        g.dist = ds;
        g.w = r.width;
        g.h = r.height;
      } else {
        // not laid out yet (hidden): estimate from the text
        g.w = Math.max(g.w, 44 + name.length * 7 + `${dist} m`.length * 7);
      }
    }
    return { w: g.w, h: g.h };
  }

  /** Round 20: the gate tag. `name` empty or `visible` false hides it. */
  setGate(x: number, y: number, offscreen: boolean, angle: number, name: string, kind: string, visible: boolean, dist = 0): void {
    const on = visible && !!name;
    if (on !== this.gateLast.on) {
      this.gateLast.on = on;
      this.gateTag.classList.toggle('show', on);
    }
    if (!on) return;
    this.gateTag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    this.gateTag.classList.toggle('offscreen', offscreen);
    if (offscreen) this.gateTagArrow.style.transform = `rotate(${angle.toFixed(3)}rad)`;
    if (name !== this.gateLast.name) {
      this.gateLast.name = name;
      this.gateTagName.textContent = name;
    }
    if (kind !== this.gateLast.kind) {
      this.gateLast.kind = kind;
      this.gateTag.dataset.kind = kind;
    }
    if (dist !== this.gateLast.dist) {
      this.gateLast.dist = dist;
      this.gateTagDist.textContent = `${dist} m`;
    }
  }

  setRouteHint(h: { kind: string; names: string[]; save: number } | null): void {
    window.clearTimeout(this.routeHintTimer);
    if (!h) { this.routeHint.classList.remove('show'); return; }
    this.routeHint.dataset.kind = h.kind;
    this.routeHintLabel.textContent = h.save < 3 ? 'Via' : h.kind === 'tunnel' ? 'Tunnel' : h.kind === 'alley' ? 'Shortcut' : 'Fast lane';
    this.routeHintName.textContent = h.names.join(' + ');
    this.routeHintSave.textContent = h.save >= 1 ? `−${Math.round(h.save)} m` : '';
    this.routeHint.classList.remove('show');
    void this.routeHint.offsetWidth;
    this.routeHint.classList.add('show');
    this.routeHintTimer = window.setTimeout(() => this.routeHint.classList.remove('show'), 10000);
  }

  /** In-run goal: the next medal, its score and a thin progress bar from the last medal to it. */
  setGoal(score: number): void {
    const g = nextGoal(score);
    const tier = g ? g.tier : GOALS.tiers.length + 1;
    const q = g ? Math.round(g.progress * 100) / 100 : 1;
    if (tier !== this.goalLast.tier) {
      this.goalLast.tier = tier;
      this.goal.dataset.m = String(g ? g.tier : GOALS.tiers.length);
      this.goal.classList.toggle('done', !g);
      this.goalName.textContent = g ? g.name : `${tierName(GOALS.tiers.length)} medal`;
      this.goalScore.textContent = g ? fmt(g.score) : 'won';
    }
    if (q !== this.goalLast.q) {
      this.goalLast.q = q;
      this.goalFill.style.transform = `scaleX(${q})`;
    }
  }

  /**
   * Medal moment: a big medal banner where the delivery pop shows. If a delivery pop is still up (a drop is the usual way
   * across a line), the banner waits until that pop has been read, then takes its place. The goal row flashes too.
   */
  medalPop(tier: number, intro = false): number {
    const next = nextGoal(GOALS.tiers[tier - 1].score);
    this.goal.classList.remove('flash');
    void this.goal.offsetWidth;
    this.goal.classList.add('flash');
    // round 19: through the centre queue (a delivery pop that is still up is read first, then the banner takes its place)
    return this.centre('medal', this.medalPopEl, () => {
      this.medalPopName.textContent = `${tierName(tier)}!`;
      this.medalPopSub.textContent = intro && next ? `First medal · next: ${next.name} ${fmt(next.score)}` : next ? `Next: ${next.name} ${fmt(next.score)}` : 'Top medal';
      this.medalPopEl.dataset.m = String(tier);
    }, `${tierName(tier)}!`);
  }

  setScore(v: number): void {
    if (v === this.last.score) return;
    const bumped = v > this.last.score && this.last.score >= 0;
    this.last.score = v;
    this.score.textContent = v.toLocaleString();
    if (bumped) {
      this.score.classList.remove('bump');
      void this.score.offsetWidth;
      this.score.classList.add('bump');
    }
  }

  setCombo(mult: number, combo: number): void {
    if (combo === this.last.combo) return;
    this.last.combo = combo;
    if (combo > 0 || !this.comboChip.classList.contains('broken')) this.comboChip.hidden = combo <= 0;
    if (combo > 0) this.comboChip.classList.remove('broken');
    // a breaking chip keeps showing the multiplier that was lost
    if (combo > 0 || !this.comboChip.classList.contains('broken')) this.comboValue.textContent = fmtX(mult);
  }

  /** Round 17: overtime look for the timer (gold, "OT 9", fast pulse); `done` holds it on a finished overtime run. */
  setOvertime(on: boolean, done = false): void {
    this.overtime = on || done;
    this.timer.classList.toggle('ot', on);
    this.timer.classList.toggle('ot-done', done);
    this.last.time = '';
  }
  private overtime = false;

  setTime(seconds: number, startTime: number): void {
    const s = Math.ceil(seconds);
    const text = this.overtime ? `OT ${s}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (text !== this.last.time) {
      this.last.time = text;
      this.timerValue.textContent = text;
    }
    const low = seconds <= 10 && seconds > 0;
    if (low !== this.last.low) {
      this.last.low = low;
      this.timer.classList.toggle('low', low);
    }
    const frac = Math.max(0, Math.min(1, seconds / Math.max(startTime, seconds)));
    this.timerRing.style.strokeDashoffset = String(113.1 * (1 - frac));
  }

  /**
   * Slow clock marker: while drafting slows the clock, the timer glows teal and a small tag under it shows the clock's
   * speed (x0.5 = half speed, "frozen" at full draft, "+0.1/s" when a perfect draft early in the run runs it back) and
   * the slow-clock seconds left on this leg ("· 6s"). A good draft that earns nothing shows a muted tag instead: "slow
   * clock spent" once the leg's budget is used up (a pickup or a drop refills it), or "slow clock: wrong way" while the
   * drone flies away from its objective. `gain` is clock seconds gained per second.
   */
  setSlowClock(gain: number, dt = 1 / 60, budget = 0, idle: '' | 'spent' | 'away' = ''): void {
    const spent = idle !== '';
    const on = gain >= 0.03;
    this.slowOff = on || spent ? 0 : this.slowOff + dt;
    const show = on || spent || (this.slowShown && this.slowOff < 0.35);
    if (show !== this.slowShown) {
      this.slowShown = show;
      this.timer.classList.toggle('slow', show);
    }
    if (spent !== this.slowSpent) {
      this.slowSpent = spent;
      this.timer.classList.toggle('spent', spent);
    }
    if (on || spent) {
      // round 14: the timer is the only seconds number on screen. The badge names the state in words and shows this
      // leg's slow clock budget as a small bar that empties (a pickup or a drop refills it).
      const speed = Math.max(0, 1 - gain);
      const text = spent
        ? idle === 'spent' ? 'slow clock spent' : 'slow clock: wrong way'
        : gain > 1.05 ? 'clock rewinds' : speed < 0.05 ? 'clock frozen' : 'slow clock';
      if (text !== this.last.slow) {
        this.last.slow = text;
        this.timerSlowText.textContent = text;
      }
      const frac = Math.round(Math.max(0, Math.min(1, budget / Math.max(0.01, this.slowBudgetMax))) * 50) / 50;
      if (frac !== this.slowFrac) {
        this.slowFrac = frac;
        this.timerSlow.style.setProperty('--budget', String(frac));
      }
    }
  }

  flashTimeBonus(sec: number): void {
    this.timeBonus.textContent = `+${fmtSec(sec)}s`;
    this.timeBonus.classList.remove('show');
    void this.timeBonus.offsetWidth;
    this.timeBonus.classList.add('show');
  }

  /** Crash cost by the clock: a coral "-3s" drops out of the timer and the timer shudders. */
  flashTimePenalty(sec: number): void {
    this.timePenalty.textContent = `-${sec}s`;
    this.timePenalty.classList.remove('show');
    this.timer.classList.remove('hit');
    void this.timePenalty.offsetWidth;
    this.timePenalty.classList.add('show');
    this.timer.classList.add('hit');
    window.clearTimeout(this.timerHitTimer);
    // drop the class afterwards so the low-time pulse animation is not masked
    this.timerHitTimer = window.setTimeout(() => this.timer.classList.remove('hit'), 650);
  }

  /** The combo chip cracks and falls away instead of silently disappearing. */
  breakCombo(lost: number): void {
    window.clearTimeout(this.comboBreakTimer);
    this.comboValue.textContent = fmtX(lost);
    this.comboChip.hidden = false;
    this.comboChip.classList.remove('broken');
    void this.comboChip.offsetWidth;
    this.comboChip.classList.add('broken');
    this.comboBreakTimer = window.setTimeout(() => {
      if (this.comboChip.classList.contains('broken')) {
        this.comboChip.classList.remove('broken');
        this.comboChip.hidden = this.last.combo <= 0;
      }
    }, 900);
  }

  /**
   * Street bonus: the slipstream points banked on this parcel run, shown at the end of the objective pill. They are paid
   * on delivery. Hidden while nothing is banked. The pill bumps when the amount grows.
   */
  setBank(points: number, carrying: boolean): void {
    const v = Math.max(0, Math.round(points));
    this.objectiveBank.dataset.carry = carrying ? '1' : '0';
    this.scorePending.dataset.carry = carrying ? '1' : '0';
    if (v > this.bankTarget && this.bankShown >= 0) {
      this.objectiveBank.classList.remove('bump');
      void this.objectiveBank.offsetWidth;
      this.objectiveBank.classList.add('bump');
    }
    this.bankTarget = v;
    // a drop or a crash cut shows at once; growth counts up in tickBank
    if (v < this.bankShownF || this.bankShown < 0) {
      this.bankShownF = v;
      this.writeBank(v);
    }
  }

  /** Round 15: count the shown bank up toward the banked amount (about 0.6 s per payout), every frame. */
  tickBank(dt: number): void {
    if (this.bankShownF >= this.bankTarget) return;
    const gap = this.bankTarget - this.bankShownF;
    this.bankShownF = Math.min(this.bankTarget, this.bankShownF + Math.max(gap * Math.min(1, dt * 5), 40 * dt));
    this.writeBank(Math.round(this.bankShownF));
  }

  private writeBank(v: number): void {
    if (v === this.bankShown) return;
    this.bankShown = v;
    this.objectiveBank.hidden = v <= 0;
    this.objectiveBankValue.textContent = `+${fmt(v)}`;
    this.scorePending.hidden = v <= 0;
    this.scorePending.textContent = `+${fmt(v)}`;
  }

  setObjective(kind: MarkerKind, name: string): void {
    this.objective.dataset.kind = kind;
    this.nav.dataset.kind = kind;
    this.gateTag.dataset.phase = kind;
    this.objectiveVerb.textContent = kind === 'pickup' ? 'Pick up' : 'Deliver';
    this.objectiveName.textContent = name;
    this.objective.classList.remove('flash');
    void this.objective.offsetWidth;
    this.objective.classList.add('flash');
  }

  setDeliveries(n: number): void {
    if (n === this.last.deliveries) return;
    this.last.deliveries = n;
    this.deliveries.textContent = String(n);
  }

  setBoost(v: number, active: boolean): void {
    const q = Math.round(v * 200) / 200;
    if (q !== this.last.boost) {
      this.last.boost = q;
      this.boostFill.style.transform = `scaleX(${q})`;
    }
    const st = active ? 'active' : v < 0.05 ? 'empty' : '';
    if (st !== this.last.boostState) {
      this.last.boostState = st;
      this.boost.classList.toggle('active', st === 'active');
      this.boost.classList.toggle('empty', st === 'empty');
    }
  }

  setTelemetry(speed: number, alt: number): void {
    const s = Math.round(speed);
    const a = Math.round(alt);
    if (s !== this.last.speed) {
      this.last.speed = s;
      this.speed.textContent = String(s);
    }
    if (a !== this.last.alt) {
      this.last.alt = a;
      this.alt.textContent = String(a);
    }
  }

  /** Place the objective marker at a screen position; arrow points toward it when clamped. */
  setNav(x: number, y: number, offscreen: boolean, angle: number, distance: number, visible: boolean): void {
    this.nav.style.display = visible ? '' : 'none';
    if (!visible) return;
    this.nav.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    this.nav.classList.toggle('offscreen', offscreen);
    if (offscreen) this.navArrow.style.transform = `rotate(${angle.toFixed(3)}rad)`;
    const d = Math.round(distance);
    if (d !== this.last.dist) {
      this.last.dist = d;
      this.navDistance.textContent = `${d} m`;
    }
  }

  setSpeedLines(level: number): void {
    const q = Math.round(level * 20) / 20;
    if (q === this.speedLinesLevel) return;
    this.speedLinesLevel = q;
    this.speedLines.style.opacity = String(q * 0.85);
  }

  /**
   * Slipstream meter: shows while drafting or while the meter still holds charge. The fill only glows while it is
   * actually filling (dimmed while it waits out of the draft), glows hotter on a wall hug, and the first two runs on
   * this device show a one-line hint under it the first time it appears. `rate` (0..3) lights the fill-speed chevrons
   * and `cue` names what would fill it faster ("faster", "closer") or praises a tight line ("hug"), so the rule is
   * learned by flying. A cue also shows the meter while the drone is near walls but too slow to draft.
   */
  setSlip(level: number, drafting: boolean, chain: number, suppressed = false, hug = false, dt = 0, rate = 0, cue = ''): void {
    const q = Math.round(level * 100) / 100;
    if (q !== this.slipLast.level) {
      this.slipLast.level = q;
      this.slipFill.style.transform = `scaleX(${q})`;
    }
    const on = !suppressed && (drafting || level > 0.02 || cue === 'faster');
    if (rate !== this.slipLast.rate) {
      this.slipLast.rate = rate;
      this.slipRate.dataset.rate = String(rate);
    }
    if (cue !== this.slipLast.cue) {
      this.slipLast.cue = cue;
      this.slipCue.textContent = cue === 'faster' ? 'Faster!' : cue === 'closer' ? 'Closer to wall' : cue === 'hug' ? 'Wall hug!' : cue === 'alley' ? 'Alley draft!' : cue === 'tunnel' ? 'Tunnel · clock slowed' : cue === 'van' ? 'Van draft!' : cue === 'stale' ? 'Off route · bonus fading' : '';
      this.slipCue.dataset.cue = cue;
    }
    if (on !== this.slipLast.on) {
      this.slipLast.on = on;
      this.slip.classList.toggle('on', on);
      if (on && this.hintArmed) {
        this.hintArmed = false;
        this.hintLeft = 6;
        this.slip.classList.add('hint');
      }
    }
    if (this.hintLeft > 0 && on) {
      this.hintLeft -= dt;
      if (this.hintLeft <= 0) this.slip.classList.remove('hint');
    }
    const h = drafting && hug;
    if (drafting !== this.slipLast.drafting || h !== this.slipLast.hug) {
      this.slipLast.drafting = drafting;
      this.slipLast.hug = h;
      this.slip.classList.toggle('drafting', drafting);
      this.slip.classList.toggle('hug', h);
    }
    if (chain !== this.slipLast.chain) {
      this.slipLast.chain = chain;
      this.slipChain.textContent = chain > 1 ? `x${chain}` : '';
      this.slip.dataset.chain = String(Math.min(chain, 5));
    }
  }

  /** Called at the start of a run: arms the first-time slipstream hint for the first two runs on this device. */
  armSlipHint(enabled = true): void {
    if (!enabled) { this.hintArmed = false; return; }
    if (this.hintRuns === 0) {
      try {
        this.hintRuns = 1 + Number(localStorage.getItem('drone-dash-slip-hint') || 0);
        localStorage.setItem('drone-dash-slip-hint', String(this.hintRuns));
      } catch {
        this.hintRuns = 1;
      }
    } else this.hintRuns++;
    this.hintArmed = this.hintRuns <= 2;
  }

  private readonly viewHint = $('view-hint');
  private viewHintTimer = 0;
  private viewHintOn = false;

  /**
   * Round 21: on the first two runs on this device, a one-line camera hint shows above the bottom bar from 1.5 s to
   * 7.5 s into the run, and goes away as soon as the player looks around.
   */
  armViewHint(enabled = true): void {
    window.clearTimeout(this.viewHintTimer);
    this.viewHint.classList.remove('show');
    this.viewHintOn = false;
    if (!enabled) return;
    let runs = 1;
    try {
      runs = 1 + Number(localStorage.getItem('drone-dash-view-hint') || 0);
      localStorage.setItem('drone-dash-view-hint', String(runs));
    } catch {
      /* storage blocked: show it */
    }
    if (runs > 2) return;
    this.viewHintOn = true;
    this.viewHintTimer = window.setTimeout(() => {
      if (!this.viewHintOn) return;
      this.viewHint.classList.add('show');
      this.viewHintTimer = window.setTimeout(() => this.viewUsed(), 6000);
    }, 1500);
  }

  /** Round 25: show the camera hint now (the teaching layer introduces it), for 6 s or until the player looks around. */
  showViewHint(): void {
    window.clearTimeout(this.viewHintTimer);
    this.viewHintOn = true;
    this.viewHint.classList.add('show');
    this.viewHintTimer = window.setTimeout(() => this.viewUsed(), 6000);
  }

  /** The player orbited or zoomed: the camera hint has done its job. */
  viewUsed(): void {
    if (!this.viewHintOn) return;
    this.viewHintOn = false;
    window.clearTimeout(this.viewHintTimer);
    this.viewHint.classList.remove('show');
  }

  /** High-wind chip: shown while the drone flies in the headwind band above the roofline. */
  setWind(on: boolean): void {
    if (on === this.windOn) return;
    this.windOn = on;
    this.windEl.classList.toggle('on', on);
  }

  /**
   * Payout pop near the drone: grows, brightens and gets a chain tag as the chain climbs. Once the slow clock has banked
   * a second or more, the tag also shows the run's total clock time from the slipstream so far.
   */
  slipPop(points: string, chain: number, sub: string, paid = false): void {
    this.centre('slip', this.slipPopEl, () => {
      this.slipPopMain.textContent = points;
      this.slipPopSub.textContent = sub;
      this.slipPopEl.dataset.chain = String(Math.min(chain, 5));
      this.slipPopEl.classList.toggle('paid', paid);
    }, `${points} ${sub}`);
  }

  hitFlash(strength: number, crash = false): void {
    this.hitFlashEl.style.setProperty('--hit', strength.toFixed(2));
    this.hitFlashEl.classList.remove('show');
    this.hitFlashEl.classList.toggle('heavy', crash);
    void this.hitFlashEl.offsetWidth;
    this.hitFlashEl.classList.add('show');
  }

  popText(main: string, sub: string, kind: MarkerKind | 'crash' | 'rush'): void {
    // a crash jumps the queue (priority above the banners)
    this.centre('pop', this.pop, () => {
      this.popMain.textContent = main;
      this.popSub.textContent = sub;
      this.pop.classList.toggle('drop', kind === 'drop');
      this.pop.classList.toggle('pickup', kind === 'pickup');
      this.pop.classList.toggle('crash', kind === 'crash');
      this.pop.classList.toggle('rush', kind === 'rush');
    }, `${main} ${sub}`, kind === 'crash' ? 4 : undefined);
  }

  /** Game-over card: medal, score, the points to the next medal, a breakdown that sums to the score, and the clock story. */
  showOver(r: RunSummary): void {
    $('over-score').textContent = fmt(r.score);
    $('new-best').hidden = !r.newBest;
    const medal = $('over-medal');
    medal.dataset.m = String(r.tier);
    $('over-medal-name').textContent = r.tier > 0 ? `${tierName(r.tier)} medal` : 'No medal yet';
    const next = nextGoal(r.score);
    $('over-next').textContent = next ? `${fmt(next.score - r.score)} more for ${next.name}` : 'Top medal. Nothing left but your best.';
    const row = (label: string, detail: string, pts: number, cls = '') =>
      `<div class="${cls}"><dt>${label}${detail ? ` <small>${detail}</small>` : ''}</dt><dd>${pts > 0 ? '+' : ''}${fmt(pts)}</dd></div>`;
    const rows = [
      row('Deliveries', `×${r.deliveries}`, r.drops),
      row('Fast drops', `×${r.fastCount}`, r.fast - r.rush),
      ...(r.rushOrders > 0 ? [row('Rush orders', `${r.rushMade} of ${r.rushOrders} in time`, r.rush)] : []),
      row('Combo bonus', r.topCombo > 1 ? `up to ${fmtX(r.topCombo)}` : '', r.combo),
      row('Street bonus', bankDetail(r), r.slip - r.partial),
      ...(r.partial > 0 ? [row('Last leg', `${Math.round(r.partialShare * 100)}% flown at time-up`, r.partial)] : []),
      `<div class="total"><dt>Score</dt><dd>${fmt(r.score)}</dd></div>`,
    ];
    $('over-breakdown').innerHTML = rows.join('');
    // the run's length: the clock only moves by these amounts, so this sums exactly to the seconds flown
    const flown = r.startTime + r.dropSeconds + r.slipSeconds - r.crashSeconds + r.overtimeSeconds;
    const parts = [`${fmt(r.startTime)} s start`, `+${fmt(r.dropSeconds)} s drops`];
    if (r.slipSeconds > 0) parts.push(`+${fmtSec(r.slipSeconds)} s slipstream`);
    if (r.overtimeSeconds > 0) parts.push(`+${fmtSec(r.overtimeSeconds)} s overtime${r.overtimeDrop ? ' (delivered)' : ''}`);
    if (r.crashSeconds > 0) parts.push(`<em>−${r.crashSeconds.toFixed(1).replace(/\.0$/, '')} s ${r.crashes} crash${r.crashes === 1 ? '' : 'es'}</em>`);
    const m = Math.floor(flown / 60), sec = Math.round(flown % 60);
    $('over-time').innerHTML = `Flew ${m}:${String(sec).padStart(2, '0')} <small>${parts.join(' ')}</small>`;
    $('over-daily-new').hidden = !r.dailyNew;
    $('over-best').textContent = fmt(r.best);
    const bt = $('over-best-tier');
    bt.textContent = r.bestTier > 0 ? tierName(r.bestTier) : '';
    bt.dataset.m = String(r.bestTier);
  }

  resetCache(): void {
    this.cActive = null;
    this.cQueue = [];
    for (const el of [this.pop, this.eventPopEl, this.slipPopEl]) el.classList.remove('show');
    this.setRouteHint(null);
    this.viewUsed();
    this.goalLast = { tier: -1, q: -1 };
    this.goal.classList.remove('flash');
    this.medalPopEl.classList.remove('show');
    this.slipLast = { level: -1, on: false, drafting: false, chain: -1, hug: false, rate: -1, cue: '' };
    this.slip.classList.remove('on', 'drafting', 'hug', 'hint');
    this.slowShown = false;
    this.slowSpent = false;
    this.slowFrac = -1;
    this.timer.classList.remove('slow', 'spent');
    this.hintLeft = 0;
    this.windOn = false;
    this.windEl.classList.remove('on');
    this.slipPopEl.classList.remove('show', 'paid');
    this.bankShown = -1;
    this.bankTarget = 0;
    this.bankShownF = 0;
    this.setBank(0, false);
    this.eventPopEl.classList.remove('show');
    this.rushShown = 'x';
    this.setRush(0, 0);
    window.clearTimeout(this.comboBreakTimer);
    this.comboChip.classList.remove('broken');
    this.timePenalty.classList.remove('show');
    this.timer.classList.remove('hit');
    this.last = { score: -1, time: '', combo: -1, deliveries: -1, boost: -1, speed: -1, alt: -1, dist: -1, low: false, boostState: '', slow: '' };
  }
}

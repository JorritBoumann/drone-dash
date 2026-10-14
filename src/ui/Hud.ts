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
  startTime: number;
  dropSeconds: number;
  slipSeconds: number;
  crashSeconds: number;
  crashes: number;
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
/** Clock seconds: whole numbers plain, halves with one decimal (2, 2.5). */
const fmtSec = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
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
  private medalTimer = 0;
  private popAt = -1e9; // performance.now() of the last centre pop (delivery, pickup, crash)
  private readonly popMain = $('pop-main');
  private readonly popSub = $('pop-sub');
  private readonly titleScreen = $('title-screen');
  private readonly pauseScreen = $('pause-screen');
  private readonly overScreen = $('over-screen');

  readonly playButton = $<HTMLButtonElement>('play-button');
  readonly resumeButton = $<HTMLButtonElement>('resume-button');
  readonly restartButton = $<HTMLButtonElement>('restart-button');
  readonly againButton = $<HTMLButtonElement>('again-button');
  readonly pauseButton = $<HTMLButtonElement>('pause-button');
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
  medalPop(tier: number): number {
    const next = nextGoal(GOALS.tiers[tier - 1].score);
    this.medalPopName.textContent = `${tierName(tier)}!`;
    this.medalPopSub.textContent = next ? `Next: ${next.name} ${fmt(next.score)}` : 'Top medal';
    this.medalPopEl.dataset.m = String(tier);
    this.goal.classList.remove('flash');
    void this.goal.offsetWidth;
    this.goal.classList.add('flash');
    window.clearTimeout(this.medalTimer);
    const wait = Math.max(0, 1050 - (performance.now() - this.popAt));
    const show = () => {
      this.pop.classList.remove('show');
      this.medalPopEl.classList.remove('show');
      void this.medalPopEl.offsetWidth;
      this.medalPopEl.classList.add('show');
    };
    if (wait > 0) this.medalTimer = window.setTimeout(show, wait);
    else show();
    return wait / 1000;
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
    if (combo > 0 || !this.comboChip.classList.contains('broken')) this.comboValue.textContent = `x${mult.toFixed(1)}`;
  }

  setTime(seconds: number, startTime: number): void {
    const s = Math.ceil(seconds);
    const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
      const speed = Math.max(0, 1 - gain);
      const left = `${Math.ceil(budget - 0.05)}s`;
      const text = spent
        ? idle === 'spent' ? 'slow clock spent' : 'slow clock: wrong way'
        : `${gain > 1.05 ? `clock +${(gain - 1).toFixed(1)}/s` : speed < 0.05 ? 'clock frozen' : `clock x${speed.toFixed(1)}`} · ${left}`;
      if (text !== this.last.slow) {
        this.last.slow = text;
        this.timerSlow.textContent = text;
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
    this.comboValue.textContent = `x${lost.toFixed(1)}`;
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

  setObjective(kind: MarkerKind, name: string): void {
    this.objective.dataset.kind = kind;
    this.nav.dataset.kind = kind;
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
      this.slipCue.textContent = cue === 'faster' ? 'Faster!' : cue === 'closer' ? 'Closer to wall' : cue === 'hug' ? 'Wall hug!' : '';
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
  armSlipHint(): void {
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
  slipPop(points: string, chain: number, clockTotal = 0): void {
    this.slipPopMain.textContent = points;
    const tag = chain > 1 ? `Slipstream chain x${chain}` : 'Slipstream';
    this.slipPopSub.textContent = clockTotal >= 1 ? `${tag} · clock +${Math.round(clockTotal)}s` : tag;
    this.slipPopEl.dataset.chain = String(Math.min(chain, 5));
    this.slipPopEl.classList.remove('show');
    void this.slipPopEl.offsetWidth;
    this.slipPopEl.classList.add('show');
  }

  hitFlash(strength: number, crash = false): void {
    this.hitFlashEl.style.setProperty('--hit', strength.toFixed(2));
    this.hitFlashEl.classList.remove('show');
    this.hitFlashEl.classList.toggle('heavy', crash);
    void this.hitFlashEl.offsetWidth;
    this.hitFlashEl.classList.add('show');
  }

  popText(main: string, sub: string, kind: MarkerKind | 'crash'): void {
    this.popMain.textContent = main;
    this.popSub.textContent = sub;
    this.pop.classList.toggle('drop', kind === 'drop');
    this.pop.classList.toggle('pickup', kind === 'pickup');
    this.pop.classList.toggle('crash', kind === 'crash');
    this.popAt = performance.now();
    this.pop.classList.remove('show');
    void this.pop.offsetWidth;
    this.pop.classList.add('show');
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
      row('Fast drops', `×${r.fastCount}`, r.fast),
      row('Combo bonus', r.topCombo > 1 ? `up to x${r.topCombo.toFixed(1)}` : '', r.combo),
      row('Slipstream', `×${r.slipPayouts}${r.slipSeconds > 0 ? ` · +${fmtSec(r.slipSeconds)} s clock` : ''}`, r.slip),
      `<div class="total"><dt>Score</dt><dd>${fmt(r.score)}</dd></div>`,
    ];
    $('over-breakdown').innerHTML = rows.join('');
    // the run's length: the clock only moves by these amounts, so this sums exactly to the seconds flown
    const flown = r.startTime + r.dropSeconds + r.slipSeconds - r.crashSeconds;
    const parts = [`${fmt(r.startTime)} s start`, `+${fmt(r.dropSeconds)} s drops`];
    if (r.slipSeconds > 0) parts.push(`+${fmtSec(r.slipSeconds)} s slipstream`);
    if (r.crashSeconds > 0) parts.push(`<em>−${r.crashSeconds.toFixed(1).replace(/\.0$/, '')} s ${r.crashes} crash${r.crashes === 1 ? '' : 'es'}</em>`);
    const m = Math.floor(flown / 60), sec = Math.round(flown % 60);
    $('over-time').innerHTML = `Flew ${m}:${String(sec).padStart(2, '0')} <small>${parts.join(' ')}</small>`;
    $('over-best').textContent = fmt(r.best);
    const bt = $('over-best-tier');
    bt.textContent = r.bestTier > 0 ? tierName(r.bestTier) : '';
    bt.dataset.m = String(r.bestTier);
  }

  resetCache(): void {
    this.goalLast = { tier: -1, q: -1 };
    this.goal.classList.remove('flash');
    window.clearTimeout(this.medalTimer);
    this.medalPopEl.classList.remove('show');
    this.slipLast = { level: -1, on: false, drafting: false, chain: -1, hug: false, rate: -1, cue: '' };
    this.slip.classList.remove('on', 'drafting', 'hug', 'hint');
    this.slowShown = false;
    this.slowSpent = false;
    this.timer.classList.remove('slow', 'spent');
    this.hintLeft = 0;
    this.windOn = false;
    this.windEl.classList.remove('on');
    this.slipPopEl.classList.remove('show');
    window.clearTimeout(this.comboBreakTimer);
    this.comboChip.classList.remove('broken');
    this.timePenalty.classList.remove('show');
    this.timer.classList.remove('hit');
    this.last = { score: -1, time: '', combo: -1, deliveries: -1, boost: -1, speed: -1, alt: -1, dist: -1, low: false, boostState: '', slow: '' };
  }
}

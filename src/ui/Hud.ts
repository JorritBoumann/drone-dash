import type { MarkerKind } from '../entities/ObjectiveMarker';

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
  private readonly slipPopEl = $('slip-pop');
  private readonly slipPopMain = $('slip-pop-main');
  private readonly slipPopSub = $('slip-pop-sub');
  private hintLeft = 0; // s of first-time hint still to show while the meter is up
  private hintRuns = 0;
  private hintArmed = false;
  private readonly windEl = $('wind');
  private windOn = false;
  private slipLast = { level: -1, on: false, drafting: false, chain: -1, hug: false };
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

  private last = { score: -1, time: '', combo: -1, deliveries: -1, boost: -1, speed: -1, alt: -1, dist: -1, low: false, boostState: '' };

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

  setBest(best: number): void {
    $('title-best').textContent = best.toLocaleString();
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

  flashTimeBonus(sec: number): void {
    this.timeBonus.textContent = `+${sec}s`;
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
   * this device show a one-line hint under it the first time it appears.
   */
  setSlip(level: number, drafting: boolean, chain: number, suppressed = false, hug = false, dt = 0): void {
    const q = Math.round(level * 100) / 100;
    if (q !== this.slipLast.level) {
      this.slipLast.level = q;
      this.slipFill.style.transform = `scaleX(${q})`;
    }
    const on = !suppressed && (drafting || level > 0.02);
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

  /** Payout pop near the drone: grows, brightens and gets a chain tag as the chain climbs. */
  slipPop(points: string, chain: number): void {
    this.slipPopMain.textContent = points;
    this.slipPopSub.textContent = chain > 1 ? `Slipstream chain x${chain}` : 'Slipstream';
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
    this.pop.classList.remove('show');
    void this.pop.offsetWidth;
    this.pop.classList.add('show');
  }

  showOver(score: number, best: number, deliveries: number, topCombo: number, newBest: boolean): void {
    $('over-score').textContent = score.toLocaleString();
    $('over-best').textContent = best.toLocaleString();
    $('over-deliveries').textContent = String(deliveries);
    $('over-combo').textContent = topCombo > 0 ? `x${(1 + Math.min(topCombo, 5) * 0.5).toFixed(1)}` : '—';
    $('new-best').hidden = !newBest;
  }

  resetCache(): void {
    this.slipLast = { level: -1, on: false, drafting: false, chain: -1, hug: false };
    this.slip.classList.remove('on', 'drafting', 'hug', 'hint');
    this.hintLeft = 0;
    this.windOn = false;
    this.windEl.classList.remove('on');
    this.slipPopEl.classList.remove('show');
    window.clearTimeout(this.comboBreakTimer);
    this.comboChip.classList.remove('broken');
    this.timePenalty.classList.remove('show');
    this.timer.classList.remove('hit');
    this.last = { score: -1, time: '', combo: -1, deliveries: -1, boost: -1, speed: -1, alt: -1, dist: -1, low: false, boostState: '' };
  }
}

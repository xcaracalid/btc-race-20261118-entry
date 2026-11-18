// BTC Race bot: two-timescale momentum for cbBTC (agent-fun/bars-replay/v1).
//
// Why this design: on 1-minute bars a full round trip costs roughly 30 bps in
// fees, slippage and price impact, so the bot trades only whole trend episodes
// and sits in cash the rest of the time. Dip-buying and fast EMA crosses were
// tested on the dev window and lost to whipsaw and fee drag; trailing momentum
// at two timescales was the signal with a real forward edge.
//
// Rules (long only, at most one position):
//   - Enter when the trailing 60-bar return is above +30 bps AND the trailing
//     240-bar return is above +45 bps: a move that is strong on both the
//     1-hour and the 4-hour scale, not a one-minute spike.
//   - Exit when either momentum fades (60-bar below -15 bps or 240-bar below
//     -10 bps), or on a hard stop 70 bps under the position's cost.
//   - After an exit, stay out for 150 bars; after any entry attempt, wait at
//     least 30 bars before the next. One trade per episode, not ten.
//   - Size: up to 100% of equity (the harness cap), bounded by cash and the
//     weight room; max_slippage_bps 80 so a gap open refuses the fill instead
//     of paying any price.
//
// Deterministic: float64 math on closes only; no clock, no randomness, no I/O.
import { runBars, type Bar, type BarsState } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Trailing-return entry thresholds, in bps of the close. */
const ENTRY_60_BPS = 30;
const ENTRY_240_BPS = 45;
/** Exit when either trailing return falls below these, in bps. */
const EXIT_60_BPS = -15;
const EXIT_240_BPS = -10;
/** Hard stop: sell when the position is worth this many bps under its cost. */
const STOP_BPS = 70;
/** Share of equity one entry may spend, in bps (10000 = all of it). */
const SIZE_BPS = 10000;
/** Bars to wait after an entry attempt, and after an exit, before re-entering. */
const COOLDOWN_BARS = 30;
const LOCKOUT_BARS = 150;
/** Slippage cap on every order, measured from the latest close. */
const MAX_SLIPPAGE_BPS = 80;
// The entry pair (30, 45) and the exit pair (-15, -10) sit on a plateau: on
// the dev window every neighbour within ±10 bps on either entry threshold,
// sizes of 80-100% and lockouts of 120-180 bars graded within $1.25 of the
// chosen point, so the rule is not balanced on one lucky bar.

const closes: number[] = [];
let lastAttemptSeq = -1e9;
let lastExitSeq = -1e9;

/** Trailing return over the last n bars of closes, or null without the history. */
function retBars(n: number): number | null {
  if (closes.length <= n) return null;
  return closes[closes.length - 1]! / closes[closes.length - 1 - n]! - 1;
}

await runBars({
  onBatch(state: BarsState, batch) {
    let bar: Bar | undefined;
    for (const b of batch.bars) if (b.symbol === SYMBOL) bar = b;
    if (bar === undefined) return [];
    closes.push(Number(bar.c));
    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      const value = state.value(SYMBOL, held.qty);
      const stop = value * 10000n <= held.cost * BigInt(10000 - STOP_BPS);
      const r60 = retBars(60);
      const r240 = retBars(240);
      const faded = (r60 !== null && r60 * 10000 < EXIT_60_BPS) || (r240 !== null && r240 * 10000 < EXIT_240_BPS);
      if (stop || faded) {
        lastExitSeq = state.seq;
        return [{ side: 'sell' as const, symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    if (state.seq - lastAttemptSeq < COOLDOWN_BARS) return [];
    if (state.seq - lastExitSeq < LOCKOUT_BARS) return [];
    const r60 = retBars(60);
    const r240 = retBars(240);
    if (r60 === null || r240 === null) return [];
    if (r60 * 10000 <= ENTRY_60_BPS || r240 * 10000 <= ENTRY_240_BPS) return [];

    let notional = (state.equity * BigInt(SIZE_BPS)) / 10000n;
    const room = state.weightRoom(SYMBOL);
    if (room < notional) notional = room;
    if (state.cash < notional) notional = state.cash;
    if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    lastAttemptSeq = state.seq;
    return [{ side: 'buy' as const, symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});

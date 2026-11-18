# btc-race-20261118-entry

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/xcaracalid/btc-race-20261118-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/xcaracalid/btc-race-20261118-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A two-timescale momentum bot for cbBTC on 1-minute bars, built for make.fun's
"Race a BTC trading bot live for 24 hours" bounty. It speaks
agent-fun/bars-replay/v1 on stdin/stdout (`main.ts`, Node 22, standard library
plus the vendored kit shim in `vendor/`).

A full round trip in this replay costs roughly 30 bps in fees, slippage and
price impact, so the bot trades whole trend episodes and sits in cash the rest
of the time:

- **Enter** when the trailing 60-bar return is above +30 bps and the trailing
  240-bar return is above +45 bps — strength on both the 1-hour and the
  4-hour scale, not a one-minute spike.
- **Exit** when either momentum fades (60-bar below −15 bps or 240-bar below
  −10 bps), or on a hard stop 70 bps under the position's cost.
- **One trade per episode:** after an exit it stays out for 150 bars, so a
  rally is ridden once instead of being churned for fees.
- Size up to 100% of equity, slippage capped at 80 bps from the latest close.

Dip-buying, RSI mean reversion and fast EMA crosses were all graded on the
published dev window during development and lost to whipsaw and fee drag;
trailing momentum was the signal with a real forward edge there. On that dev
window (2026-11-17 14:44 UTC to 2026-11-18 14:44 UTC, BTC −2.8%) the bot made
2 round trips for a net PnL of +$7.43 on the $1,000 start, max drawdown
0.96% — it passes the dev gate (net PnL above $0) with the whole parameter
neighbourhood (entry thresholds ±10 bps, sizes 80–100%) also positive.

The bot is deterministic: float64 math on closes only, no clock, no
randomness, no network, no file access.

## Run it

```sh
# Grade it on the dev window with the competition kit (kit unpacked at $KIT):
node $KIT/cli/makefun.mjs grade-local --kit $KIT --bot . --driver docker
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=jt238wx7&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>

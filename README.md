# 海洋 · Ocean — 估波遊戲

A points-only sports **prediction** game with a real backend. Players predict match winners, earn points for correct picks, and climb a live leaderboard.

> **Not gambling / 唔係賭博:** points are a game score only — they cannot be bought, cannot be cashed out, and are not connected to any money. Predicting is free; a correct pick **earns** points (`round(odds × 10)`) and a wrong pick **deducts nothing** (gain-only). Real odds are used only to weight scoring difficulty (a correct underdog pick is worth more) and for display — there is no staking and no odds-based payout on a wager.

## Stack
Node + Express + JSON-file store (`data.json`). Single dependency (`express`). Original code.

## Run it
```bash
npm install
node server.js
```
- Player:  http://localhost:3000
- Admin:   http://localhost:3000/admin  (default `admin` / `admin123` — change it)

Change the port with `PORT=8080 node server.js`.

## What's inside
- `server.js` — REST API: register/login (scrypt + bearer token), matches, **gain-only** predict (one pick per match, no stake), settlement, leaderboard, admin (match CRUD, set result → auto-award points, players, dashboard stats, announcement, import real fixtures).
- `public/index.html` — player app (ocean theme, mobile-first): self-register → predict winners → watch results → leaderboard. Polls every 5s.
- `public/admin.html` — admin panel (game management only: matches / odds / results / players / dashboard — **no money, no member betting accounts**).

## Live data
On first run it auto-imports **real upcoming fixtures** from the free TheSportsDB feed (real teams + schedule). Odds are generated for difficulty-weighting. Admin has a "🌐 匯入" button to pull more leagues.

**Next — betsapi:** to use live odds/results, replace `importFixtures()` / `genOdds()` in `server.js` with betsapi (or the-odds-api / api-sports.io) calls. The match shape is:
```js
{ id, league, time, home:{n,f}, away:{n,f}, o:{home,draw,away}, status, result, hs, as }
```

## Theme
Ocean — deep blue / light blue / white.

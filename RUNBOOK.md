# Naadhas Media — TN 2026 Counting Day Runbook

**Counting day: Monday, 4 May 2026 · Counting starts 8:00 AM IST**

This is the operations manual for the data-entry team and the broadcast desk. Keep this open in a tab during the live show.

---

## 1. URLs to bookmark

| What | URL |
|---|---|
| Public dashboard | https://naadhas-dashboard-production.up.railway.app/ |
| Constituencies page | …/constituencies |
| Per-AC detail | …/constituencies/{id} (e.g. /13 for Kolathur) |
| **Admin (data entry)** | …/admin |
| **Broadcast (OBS source)** | …/broadcast |
| Single-AC focus broadcast | …/broadcast/ac/{id} |
| Live results JSON | …/api/results |

---

## 2. Day-of checklist (7:00 AM IST — 1 hour before counting)

- [ ] Open `/admin` on the data-entry team's laptops, type each person's name into the "Your name" field (top-right) — this is what shows up in the audit log
- [ ] Open `/admin → Pending` on the lead's screen — this dashboard shows which ACs are stale
- [ ] Open `/broadcast` in a Chrome tab on the OBS PC at **1920×1080**
- [ ] In OBS, add a **Browser Source** pointing to `/broadcast`, dimensions 1920×1080
- [ ] Test scene hotkeys (Alt+1 through Alt+0): Hero · Projection · Leaderboard · Swingometer · SwingMap · VIPs · Closest · Upsets · Bellwether · Ticker
- [ ] Test ⌘+K (Mac) / Ctrl+K (Win): the command palette to jump to any AC by name
- [ ] Switch language: top-right `EN / தமிழ்` toggle on the broadcast banner
- [ ] **Stop the simulator if it's running** — `/admin → Simulator → ❚❚ Stop`, then `↻ Reset` (zeros all counters)

---

## 3. Data entry — manual mode

**Use when**: rounds are coming in one AC at a time, you want to verify each entry visually.

### Splitting the work across the team (5 people, 234 ACs)

The top of the Manual tab has **lane pills** — pick yours and the AC list narrows to just your assigned ACs.

- **By district**: Chennai (22) · Salem (11) · Coimbatore (10) · Madurai (10) · …
- **By range**: #1–50 · #51–100 · #101–150 · #151–200 · #201–234

**Suggested split for a 5-person team:**

| Person | Lane | ACs |
|---|---|---|
| Person 1 | `#1–50` | Tiruvallur, Chennai (most), Chengalpattu |
| Person 2 | `#51–100` | Vellore + Tirupathur + Krishnagiri + Dharmapuri + Tiruvannamalai + Villupuram + Kallakurichi + Salem + Namakkal + Erode |
| Person 3 | `#101–150` | Tiruppur + Coimbatore + Nilgiris + Dindigul + Karur + Trichy + Perambalur + Ariyalur |
| Person 4 | `#151–200` | Cuddalore + Mayiladuthurai + Nagapattinam + Tiruvarur + Thanjavur + Pudukkottai + Sivaganga + Madurai + Theni |
| Person 5 | `#201–234` | Virudhunagar + Ramanathapuram + Thoothukudi + Tenkasi + Tirunelveli + Kanniyakumari |

The selection persists in their browser (localStorage), so once they pick a lane it stays put across reloads. The lane indicator shows live progress: **won / counting / pending** out of their lane's total.

### Entry flow

1. `/admin → Manual entry → pick your lane`
2. Type AC name in the search box (e.g. "kolathur") — narrows further within your lane
3. **Press ↓ arrow** to move into the list, **Enter** or click to open
4. The candidate list loads with current vote totals on the right
5. Tab through inputs typing new vote totals
6. Tick **"Save & advance to next"** if you're going AC #1 → #2 → #3 sequentially within your lane
7. **⌘+Enter (Mac) / Ctrl+Enter (Win)** to save and broadcast — pushes to viewers via SSE in <500ms

### Sanity warnings you might see

| Warning | What it means | What to do |
|---|---|---|
| ⚠ DMK: votes DECREASED from 12,500 → 8,400 | Vote count went backwards (math error 99% of the time) | Double-check the source row — usually a transposed digit |
| ⚠ Stalin: 5× jump (12,000 → 60,000) | Suspicious sudden spike | Verify with the second source. If real (large round), confirm and save again |
| ⚠ Total votes 5,234,567 exceeds plausible turnout | Decimal misplaced (added a 0) | Re-enter |
| ℹ Round 3 is BEFORE current round 5 | Round number went backwards | Probably a recount or correction — go ahead if intentional |

---

## 4. Data entry — bulk paste mode

**Use when**: a field reporter sends you a whole spreadsheet of round data at once.

1. `/admin → Bulk paste`
2. Paste rows in this format (tab- or comma-separated, **header line required**):
   ```
   ac	round	party	votes
   13	5	DMK	14523
   13	5	AIADMK	11890
   13	5	TVK	2341
   86	5	AIADMK	18900
   86	5	DMK	12400
   ```
3. Click **Parse** — see preview of what will be saved
4. Click **Validate (dry-run)** — runs sanity checks WITHOUT saving. Yellow ⚠ marks rows with warnings; red ✗ marks rows that won't save (e.g. unknown party)
5. If dry-run looks good, click **Apply N groups** — pushes everything live in one batch

**Tip**: each (AC, round) pair is grouped — you can paste 50 ACs × 1 round at once or 1 AC × 5 rounds, both work.

### Party codes

| Code | Party |
|---|---|
| DMK | Dravida Munnetra Kazhagam |
| AIADMK | All India Anna Dravida Munnetra Kazhagam |
| TVK | Tamilaga Vettri Kazhagam (Vijay) |
| NTK | Naam Tamilar Katchi (Seeman) |
| BJP | Bharatiya Janata Party |
| INC | Indian National Congress |
| VCK | Viduthalai Chiruthaigal Katchi |
| PMK | Pattali Makkal Katchi |
| DMDK | Desiya Murpokku Dravida Kazhagam |
| MDMK | Marumalarchi Dravida Munnetra Kazhagam |
| CPI | CPI |
| CPM | CPI(M) |
| IND | Independent |
| OTH | Other small parties |

---

## 5. Pending dashboard — for the lead/coordinator

`/admin → Pending` auto-refreshes every 5s.

- **Stale (>10m)** — ACs that haven't been updated in the threshold window. Sorted oldest first. Click → jumps directly to that AC in Manual entry.
- **Recently touched** — last 20 ACs anyone updated, with name + source (manual/bulk/scraper/simulator) + timestamp.
- Switch the threshold (5m / 10m / 30m / 60m) depending on counting velocity.

If you see an AC marked "manual" but the team didn't update it — open `/admin → Audit` for that AC, see who edited what.

---

## 6. Audit log — when something looks wrong on stream

`/admin → Audit log → search AC → click`

Shows every change ever made to that AC: timestamp, actor name, source pill (manual/bulk/scraper/simulator), candidate, votes_before, votes_after, and Δ.

Use this to:
- Roll back a wrong entry (read the previous row, re-enter via Manual)
- Investigate "why does this number look weird"
- Settle disputes between data-entry people

---

## 7. Broadcast scenes — for the anchor/director

The broadcast page (`/broadcast`) is the **only thing OBS captures**. Switch scenes with hotkeys:

| Key | Scene | Use when |
|---|---|---|
| Alt+1 | **Hero** | Default open: 4-card party leaders, majority bar, vs-2021 |
| Alt+2 | **Projection** | "If pattern holds…" final-seat projection with confidence interval |
| Alt+3 | **Leaderboard** | Top parties + alliances, donut |
| Alt+4 | **Swingometer** | BBC-style arc, drag the slider for "what if swing is X" |
| Alt+5 | **Swing Map** | 234 hexes colored by current leader, yellow outlines = flips vs 2021 |
| Alt+6 | **VIPs** | Stalin / EPS / Vijay / Udhayanidhi / Seeman head-to-heads |
| Alt+7 | **Closest** | Tightest margins right now — could go either way |
| Alt+8 | **Upsets** | Biggest swings vs 2021 — flips to highlight |
| Alt+9 | **Bellwether** | Constituencies that historically pick the winner |
| Alt+0 | **Ticker** | Full-screen scrolling latest results |

⌘+K / Ctrl+K opens the **Command Palette**: type any AC name, candidate name, or party — pick one to navigate the broadcast directly to that thing.

For single-AC focus ("let's go to Coimbatore South…"): the palette has shortcuts, or hit `/broadcast/ac/{id}` directly.

### Pushing chyrons (lower-third overlays)

`/admin → Simulator tab → Chyron Composer`

Type the headline + subtitle, pick the type (BREAKING / KEY CALL / MILESTONE / QUOTE), click **Push**. It overlays on `/broadcast` for ~12 seconds then fades.

The **Storyline engine** auto-detects events — first declared, majority crossed, party opens account, VIP wins/loses, bellwether flip, 100-races-called milestone, etc. — and pushes chyrons automatically. View the queue in `/admin → Simulator → Storylines`.

---

## 8. Tamil/English

The **EN / தமிழ்** toggle in the broadcast banner switches the entire UI. The choice is per-browser (localStorage), so OBS browser source can stay on Tamil while the data-entry team uses English.

Translated: party names, leader names, scene labels, headings, status pills, chyron templates, storyline headlines, district names, top constituency names. Less-known ACs and per-card sub-labels still appear in English (acceptable trade-off — the headlines are what matters for broadcast).

---

## 9. Common counting-day issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Dashboard shows old totals | Browser cached SSE — close tab, reopen | F5 reload |
| "OFFLINE" indicator on broadcast | SSE disconnected | Reload the broadcast tab — auto-reconnects on load |
| Wrong vote count broadcast | Typo on entry | Open `/admin → Audit` for that AC, find the previous good value, re-enter via Manual |
| Two people editing same AC | "Also editing: Bob" badge appears in Manual entry | Coordinate verbally — the second save wins |
| Scene won't switch | OBS browser source has lost focus on Alt+N | Click the OBS browser source first to give it keyboard focus |
| Chyron stuck on screen | Auto-fade failed | `/admin → Simulator → Chyron → Clear` |

---

## 10. The 2 ACs that need manual fill

These two had no MyNeta data and need to be entered manually before the show:

| AC# | Name | District |
|---|---|---|
| 143 | Tharangambadi | Mayiladuthurai |
| 166 | Tiruppattur | Sivaganga |

To fill: `/admin → Manual entry → search → click → enter candidate names + party (use the dropdown)`. The candidates table will auto-show the placeholder slate (DMK / AIADMK / TVK / NTK + others) — you just need to update the **names** to match the real ones from the CEO TN list, then save with vote totals 0 to confirm.

If you have the candidate roster as a spreadsheet, paste it into the `data/candidates-real.json` file and let Naveen redeploy — that's the cleanest fix.

---

## 11. Agentic / API integrations

If you want a Claude session, a Python script, or any other agent to push
vote updates programmatically, point it at `/api/agent/update`.

```bash
curl -X POST https://naadhas-dashboard-production.up.railway.app/api/agent/update \
  -H "Content-Type: application/json" \
  -H "x-actor: agent:my-bot" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "constituencyId": 13,
    "round": 5,
    "candidates": [
      { "partyId": "DMK",    "votes": 14523 },
      { "partyId": "AIADMK", "votes": 11890 }
    ]
  }'
```

Full docs in [API.md](./API.md). Agent writes have the same priority as
manual writes — they extend the 5-minute scraper-lock and beat the scraper.

### ECI scraper (counting morning)

The scraper lives in `lib/scraper.ts` + `scripts/scrape-loop.ts`. ECI's
Akamai layer 403s any request that doesn't look like a real browser, so
it must run from an India-hosted box (DigitalOcean Bangalore is verified).

**Step 1 — when ECI publishes the URL pattern (8:00 AM IST May 4)**, run
the probe FIRST. Don't start the loop until probe passes.

```bash
# on the droplet
cd /opt/naadhas-scraper
export SCRAPE_URL_TEMPLATE="https://results.eci.gov.in/.../ConstituencywiseS22{{N}}.htm"
export WRITE_API_URL="https://naadhas-dashboard-production.up.railway.app"
# export ADMIN_TOKEN="..."   # only if dashboard has ADMIN_TOKEN set
npx tsx scripts/scrape-probe.ts          # probes AC#1, 117, 234
# if it fails, save HTML and inspect:
npx tsx scripts/scrape-probe.ts --save 1
# adjust selectors in lib/scraper.ts → parseEciHtml()
```

**Step 2 — start the loop** (writes to the dashboard(s) via API):

For a single dashboard target (legacy / Railway-only):

```bash
export WRITE_API_URL="https://naadhas-dashboard-production.up.railway.app"
npx tsx scripts/scrape-loop.ts
```

**For DUAL-WRITE to AWS primary + Railway warm standby** (counting-day
recommended once AWS is up):

```bash
export WRITE_API_URLS="https://aws-host.example.com,https://naadhas-dashboard-production.up.railway.app"
# If both targets share a token, use ADMIN_TOKEN. If they differ, use
# the positional comma-list ADMIN_TOKENS:
export ADMIN_TOKENS="aws-token-here,railway-token-here"
# export WRITE_TIMEOUT_MS=10000          # optional, default 10s
npx tsx scripts/scrape-loop.ts
```

The same `Idempotency-Key` is sent to every target, so retries and
overlapping writes are safe. A scrape counts as "ok" as long as AT
LEAST ONE target accepted it; per-target failures are logged
(`partial-write`) but don't abort the sweep — the next sweep retries
the failing target with the same key. If ALL targets fail in the same
sweep, the sweep counter records it and the 403/429/503 backoff kicks
in if it's a throttle.

**Multi-droplet — if ONE droplet gets blocked or rate-limited**, spin up
2 more (Mumbai, Chennai-region) and shard the 234 ACs across them. Each
droplet has a different IP; Akamai sees three independent visitors:

```bash
# droplet-A (BLR):  AC_RANGE=1-78    npx tsx scripts/scrape-loop.ts
# droplet-B (BOM):  AC_RANGE=79-156  npx tsx scripts/scrape-loop.ts
# droplet-C (IN3):  AC_RANGE=157-234 npx tsx scripts/scrape-loop.ts
```

The dashboard writer is idempotent (Idempotency-Key, no-change skip,
manual-lock guard) — overlapping ranges are safe but wasteful. Sharding
is the clean way. If a droplet dies, just re-launch its range elsewhere.

If only the FIRST droplet is blocked, you can also keep running its range
through the others — losing parallelism but keeping coverage.

## Emergency — everything is broken

1. **Primary dashboard down (AWS)** → OBS operator: disable AWS browser
   source, enable the **Railway** browser source. If the scraper is in
   DUAL mode (recommended), Railway already has the same data within
   ~10s — no data lag visible on air. Confirm scraper logs show writes
   still succeeding to Railway after AWS goes down.
2. **Both dashboards down** → On droplet: `pm2 logs scrape-loop` to
   confirm the scraper is still scraping ECI but failing all writes.
   Restart Railway (`railway service restart`) or AWS App Runner from
   their respective consoles. Scraper auto-retries with same
   Idempotency-Key on the next sweep so no data is lost.
3. **Scraper failing only one target** → check `[scraper] partial-write`
   warnings in droplet logs. Most often a temporary 5xx; clears on the
   next sweep. If sustained, that target's container is unhealthy.
4. **Wrong data on broadcast** → Anchor: announce "we're verifying";
   Data team: open `/admin → Audit` and roll back. **Critical:** roll
   back on EACH dashboard separately — the slot mixer / admin manual
   entries are NOT mirrored across dashboards (only scraper writes are).
5. **OBS lost feed** → Refresh the broadcast browser source. If blank,
   navigate to the dashboard URL directly in the browser source.
6. **Lost internet on counting floor** → Switch to mobile hotspot.
   Dashboard works on any modern browser, no install needed.

### Dashboard-host topology (post-AWS)

| Box | URL | Role |
|---|---|---|
| AWS App Runner | `https://<aws-host>` | Primary — operators sign in here |
| Railway | `https://naadhas-dashboard-production.up.railway.app` | Warm standby — scraper dual-writes |
| DO Bangalore | `165.232.176.109` | ECI scraper only, no dashboard |

Operators should sign in to **only one** dashboard during normal operation.
Slot mixer + admin entries are tenant-scoped per host; the scraper
mirrors only the vote data.

---

## 12. Post-show

- Export the audit log: `curl /api/admin/audit/{id}` for any AC and save the JSON
- Final state of the dashboard is preserved on the Railway volume (`/data/tn.db`) — survives restarts
- Storyline log is in-memory and lost on restart — copy any you want to keep BEFORE restarting the service

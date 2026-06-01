# Naadhas TN 2026 — Public API

Base URL: `https://naadhas-dashboard-production.up.railway.app`

All write endpoints accept JSON. All read endpoints return JSON. UTF-8.

> **Auth:** disabled by default for the May 4 single-day broadcast. Setting
> `ADMIN_TOKEN` env var on the server flips Bearer-token enforcement back on.

---

## Read endpoints

### `GET /api/results`
Full state snapshot — all parties, alliances, declared/counting/pending counts.

```bash
curl -s https://naadhas-dashboard-production.up.railway.app/api/results | jq .
```

### `GET /api/constituencies/:id`
Per-AC detail — candidates with current votes, round history, state.

```bash
curl -s https://naadhas-dashboard-production.up.railway.app/api/constituencies/13 | jq .
```

### `GET /api/stream`
Server-Sent Events stream. Initial `snapshot` event, then `update` and `chyron`
events as they fire. Includes 15-second keepalives.

```bash
curl -N https://naadhas-dashboard-production.up.railway.app/api/stream
```

### `GET /api/admin/audit/:id`
Full audit history for one AC: every vote change with actor, source, before/after.

```bash
curl -s https://naadhas-dashboard-production.up.railway.app/api/admin/audit/13?limit=200 | jq .
```

### `GET /api/admin/pending`
ACs that haven't been updated within `staleMinutes` window.

```bash
curl -s "https://naadhas-dashboard-production.up.railway.app/api/admin/pending?staleMinutes=10&limit=50" | jq .
```

---

## Quick write — `POST /api/agent/quick` (RECOMMENDED for most cases)

**The simplest endpoint.** Flat payload, accepts AC by name, only the 5 buckets you actually broadcast.

```bash
curl -X POST https://naadhas-dashboard-production.up.railway.app/api/agent/quick \
  -H "Content-Type: application/json" \
  -H "x-actor: agent:my-bot" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "ac": "Kolathur",
    "round": 5,
    "DMK": 14523,
    "ADMK": 11890,
    "TVK": 2341,
    "NTK": 480,
    "OTHERS": 1200
  }'
```

**Body fields:**
| Field | Required | Notes |
|---|---|---|
| `ac` | yes | Constituency NAME (recommended) or numeric ID. Punctuation/case ignored: "T.Nagar" / "T Nagar" / "Thiyagarayanagar" all map to AC#24. |
| `DMK` / `ADMK` / `TVK` / `NTK` / `OTHERS` | at least one | Vote totals. `ADMK` = `AIADMK`. `OTHERS` is a single lump sum applied to the first non-major candidate. Skip any to leave its prior value unchanged. |
| `round` | **no** | Defaults to the AC's current round (1 on first write). Only pass when ECI advances a round and you want to bump the counter. Updating votes mid-round doesn't need it. |
| `status` | no | `"counting"` / `"leading"` / `"won"`. Auto-inferred if omitted. |
| `totalRounds` | no | If you know the AC's total round count. |

**Minimal valid payload — just AC and one party:**

```bash
curl -X POST https://naadhas-dashboard-production.up.railway.app/api/agent/quick \
  -H "Content-Type: application/json" \
  -d '{ "ac": "Kolathur", "DMK": 14523 }'
```

**Ambiguous names** — `"Tiruppattur"` matches both AC#50 (Tirupattur dist) and AC#185 (Sivaganga). The endpoint returns 400 with suggestions:

```json
{
  "ok": false,
  "error": "\"Tiruppattur\" is ambiguous — matches 2 ACs; add district like \"Tiruppattur, Tirupattur\"",
  "suggestions": ["Tiruppattur, Tirupattur", "Tiruppattur, Sivaganga"]
}
```

Disambiguate with a comma:

```bash
-d '{"ac": "Tiruppattur, Sivaganga", "round": 1, "DMK": 5000}'
```

**Response (success):**

```json
{
  "ok": true,
  "applied": true,
  "ac": { "id": 13, "name": "Kolathur" },
  "warnings": []
}
```

---

## Declare winner — `POST /api/agent/winner`

The race-call moment. Sets `status='won'`, optionally bumps the winning vote count, and locks the call so the scraper can never flip it back.

```bash
curl -X POST https://naadhas-dashboard-production.up.railway.app/api/agent/winner \
  -H "Content-Type: application/json" \
  -H "x-actor: agent:race-caller" \
  -d '{
    "ac": "Kolathur",
    "winner": "DMK",
    "votes": 80000,
    "round": 22
  }'
```

**Body fields:**
| Field | Required | Notes |
|---|---|---|
| `ac` | yes | Name or ID, same resolver as `/quick`. |
| `winner` | yes | Party slug — `DMK` / `ADMK` / `AIADMK` / `TVK` / `NTK` / `BJP` / `INC` etc. |
| `votes` | no | Final vote count for the winner. If omitted, current count stands. |
| `round` | no | Final round number. |

**Response (success):**

```json
{
  "ok": true,
  "applied": true,
  "ac": { "id": 13, "name": "Kolathur" },
  "winner": { "name": "M. K. Stalin", "partyId": "DMK", "votes": 80000 },
  "warnings": []
}
```

**Soft-warning case** — winner you named isn't currently leading in the data:

```json
{
  "ok": true,
  "applied": true,
  ...,
  "warnings": [
    "Heads-up: Kasi. C (DMK) currently has more votes than Edappadi Palaniswami. K. The call applied but vote totals don't yet reflect it."
  ]
}
```

The call still applies — broadcast desks often call before the data catches up. To un-call, use `/api/admin/reset`.

---

## Full-control write — `POST /api/agent/update`

For autonomous agents (other Claude sessions, scripts, integrations) to push
round updates programmatically.

### Headers

| Header | Required | Notes |
|---|---|---|
| `Content-Type: application/json` | yes | |
| `x-actor: agent:<your-bot-name>` | recommended | Recorded in audit log. The "agent:" prefix is added automatically if missing. |
| `Idempotency-Key: <uuid>` | recommended | Replays return the cached prior response instead of double-writing. 24-hour cache. |
| `Authorization: Bearer <token>` | only if server has `ADMIN_TOKEN` set | |

### Body

```json
{
  "constituencyId": 13,
  "round": 5,
  "totalRounds": 22,
  "status": "leading",
  "candidates": [
    { "partyId": "DMK",   "votes": 14523 },
    { "partyId": "AIADMK","votes": 11890 },
    { "partyId": "TVK",   "votes": 2341 },
    { "candidateId": 250, "votes": 980 }
  ],
  "dryRun": false
}
```

- `partyId` resolves to the seeded candidate of that party in this AC. First match wins.
- Or pass `candidateId` directly for per-candidate precision.
- `dryRun: true` runs validation without writing. Returns warnings only.
- `status` optional; auto-inferred from round vs totalRounds if omitted.

### Responses

| Code | Body shape | Meaning |
|---|---|---|
| 200 | `{ "ok": true, "applied": true, "warnings": [...] }` | Saved. |
| 200 | `{ "ok": true, "applied": false, "warnings": [...] }` | dryRun. |
| 200 | `{ ..., "replayed": true }` | Idempotency-Key already seen — cached response returned. |
| 400 | `{ "ok": false, "error": "..." }` | Bad payload. |
| 409 | `{ "ok": false, "applied": false, "reason": "<reason>", "warnings": [...] }` | Write rejected — see reasons below. |

### Conflict reasons (409)

| reason | Meaning | What to do |
|---|---|---|
| `locked` | A human just made a manual correction to this AC (within the last 5 min) — agent backs off. | Wait, then retry. Or coordinate with the human. |
| `stale-round` | Your `round` is older than the AC's current round. | Re-fetch state via `/api/constituencies/:id`. |
| `won-sticky` | This AC is already declared `won`. Only manual users (or `/api/admin/reset`) can change it. | Don't retry. |
| `no-change` | Every value you sent matches the existing values. | Don't retry. |
| `negative-votes` | A candidate had a negative vote count. | Fix payload. |

### Sample warnings

Soft warnings (don't block the write):

```json
[
  { "level": "warn", "candidateId": 239, "message": "M. K. Stalin: votes DECREASED from 12,500 → 8,400." },
  { "level": "warn", "message": "Total votes 5,234,567 exceeds plausible single-AC turnout. Check decimal places." }
]
```

### End-to-end example

```bash
curl -X POST https://naadhas-dashboard-production.up.railway.app/api/agent/update \
  -H "Content-Type: application/json" \
  -H "x-actor: agent:vote-bot" \
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

---

## Reset endpoint — `POST /api/admin/reset`

Wipe a single AC back to round 0 / pending / votes 0. Audit log is preserved.

```bash
curl -X POST https://naadhas-dashboard-production.up.railway.app/api/admin/reset \
  -H "Content-Type: application/json" \
  -H "x-actor: lead" \
  -d '{ "constituencyId": 13, "confirm": "RESET" }'
```

The literal string `"RESET"` in `confirm` is a guard against accidental wipes.

---

## Bulk endpoint — `POST /api/admin/bulk`

For pasting a spreadsheet of round data. Same conflict-resolution semantics.

```bash
curl -X POST https://naadhas-dashboard-production.up.railway.app/api/admin/bulk \
  -H "Content-Type: application/json" \
  -H "x-actor: data-team" \
  -d '{
    "rows": [
      {
        "constituencyId": 13,
        "round": 5,
        "status": "leading",
        "candidates": [
          { "partyId": "DMK", "votes": 14523 },
          { "partyId": "AIADMK", "votes": 11890 }
        ]
      },
      {
        "constituencyId": 86,
        "round": 5,
        "candidates": [
          { "partyId": "AIADMK", "votes": 22000 },
          { "partyId": "DMK", "votes": 15300 }
        ]
      }
    ],
    "dryRun": false
  }'
```

Returns a per-row results array — each row reports `ok` plus `error` /
`warnings` independently, so a partial failure doesn't reject the whole batch.

---

## Conventions for agent integrations

1. **Always send `Idempotency-Key`** — generates a stable hash of `(ac, round, sorted candidate values)` is a good choice. Network blips will not double-write.
2. **Read before write** — `GET /api/constituencies/:id` to see current round; don't blindly POST round=N when state is at N+2.
3. **Handle 409 gracefully** — `locked` and `won-sticky` are not errors, they're cooperation signals.
4. **Be a polite citizen** — don't poll `/api/constituencies/:id` faster than once per 5s per AC. Subscribe to `/api/stream` for push updates instead.
5. **Tag your actor** — use `x-actor: agent:<bot-name>` so the audit log shows who's writing. The `agent:` prefix is added automatically if you forget.

---

## Party IDs (for `partyId` in candidate rows)

`DMK · AIADMK · BJP · INC · TVK · NTK · VCK · PMK · DMDK · MDMK · CPI · CPM · IND · OTH · NOTA`

NOTA is excluded from the leading/won tally but counts toward vote share.

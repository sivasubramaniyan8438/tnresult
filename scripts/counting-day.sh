#!/usr/bin/env bash
#
# counting-day.sh — paste this onto the DigitalOcean Bangalore droplet
# (or run via `bash counting-day.sh probe` from the dashboard repo on
# the droplet itself).
#
# WORKFLOW (May 4 morning):
#
#   1. SSH into the droplet:
#        ssh -i ~/.ssh/naadhas_eci root@165.232.176.109
#
#   2. ECI publishes the URL pattern around 7-8 AM IST. Set it:
#        export SCRAPE_URL_TEMPLATE="https://results.eci.gov.in/.../ConstituencywiseS22{{N}}.htm"
#        # If AC numbers must be zero-padded to 3 digits ("001"):
#        export SCRAPE_PAD=3
#
#   3. Run the probe — must show "ALL CHECKS PASSED" before proceeding:
#        bash counting-day.sh probe
#
#      If it fails, save HTML and look at the structure:
#        bash counting-day.sh probe-save 1
#        less /tmp/eci-ac-1.html
#      then edit lib/scraper.ts → parseEciHtml() and probe again.
#
#   4. Start the loop:
#        bash counting-day.sh loop
#      (or: bash counting-day.sh loop 1 78    # shard 1-78 if multi-droplet)
#
#   5. Detach if you need the SSH session back:
#        Ctrl+B, then D    (if started inside tmux/screen)
#      OR run via nohup:
#        bash counting-day.sh loop-nohup
#
# Token + endpoint are baked in below — change once and the whole team
# runs the same commands.

set -euo pipefail

cd "$(dirname "$0")/.." || cd /opt/naadhas-dashboard

export WRITE_API_URL="${WRITE_API_URL:-https://naadhas-dashboard-production.up.railway.app}"
export ADMIN_TOKEN="${ADMIN_TOKEN:-ca786a038fe47cc7ddd3bb14d5a8c86dc09c36be7426f454}"
export POLL_INTERVAL_MS="${POLL_INTERVAL_MS:-30000}"
export PER_REQUEST_DELAY_MS="${PER_REQUEST_DELAY_MS:-250}"

cmd="${1:-help}"
shift || true

case "$cmd" in
  probe)
    : "${SCRAPE_URL_TEMPLATE:?Set SCRAPE_URL_TEMPLATE first — see header of this script}"
    npx tsx scripts/scrape-probe.ts "$@"
    ;;

  probe-save)
    : "${SCRAPE_URL_TEMPLATE:?Set SCRAPE_URL_TEMPLATE first}"
    npx tsx scripts/scrape-probe.ts --save "${1:-1}"
    ;;

  loop)
    : "${SCRAPE_URL_TEMPLATE:?Set SCRAPE_URL_TEMPLATE first}"
    if [ -n "${1:-}" ] && [ -n "${2:-}" ]; then
      export AC_RANGE="${1}-${2}"
      echo "[counting-day] sharding AC range: $AC_RANGE"
    fi
    npx tsx scripts/scrape-loop.ts
    ;;

  loop-nohup)
    : "${SCRAPE_URL_TEMPLATE:?Set SCRAPE_URL_TEMPLATE first}"
    if [ -n "${1:-}" ] && [ -n "${2:-}" ]; then
      export AC_RANGE="${1}-${2}"
    fi
    LOG="/var/log/naadhas-scrape-$(date +%Y%m%d-%H%M%S).log"
    echo "[counting-day] starting in background, log: $LOG"
    nohup npx tsx scripts/scrape-loop.ts > "$LOG" 2>&1 &
    sleep 2
    tail -n 20 "$LOG"
    echo ""
    echo "[counting-day] PID $! · tail -f $LOG  for live updates"
    ;;

  ping)
    # Sanity-check the dashboard is reachable + auth token works
    echo "[counting-day] GET /api/results"
    curl -sS -o /dev/null -w "  status=%{http_code} time=%{time_total}s\n" \
      "$WRITE_API_URL/api/results"
    echo "[counting-day] POST /api/agent/update (dryRun, with ADMIN_TOKEN)"
    curl -sS -X POST "$WRITE_API_URL/api/agent/update" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "x-actor: agent:counting-day-ping" \
      -H "Idempotency-Key: ping-$(date +%s)" \
      -d '{"constituencyId":1,"round":0,"candidates":[{"partyId":"DMK","votes":0}],"dryRun":true}' \
      -w "\n  status=%{http_code}\n"
    ;;

  stop)
    pkill -f "tsx scripts/scrape-loop" && echo "[counting-day] killed scrape-loop" \
      || echo "[counting-day] no scrape-loop running"
    ;;

  status)
    if pgrep -f "tsx scripts/scrape-loop" > /dev/null; then
      echo "[counting-day] scrape-loop is RUNNING"
      pgrep -af "tsx scripts/scrape-loop"
    else
      echo "[counting-day] scrape-loop is NOT running"
    fi
    LATEST_LOG=$(ls -t /var/log/naadhas-scrape-*.log 2>/dev/null | head -1)
    if [ -n "$LATEST_LOG" ]; then
      echo "[counting-day] latest log: $LATEST_LOG"
      tail -n 5 "$LATEST_LOG"
    fi
    ;;

  help|*)
    grep -E '^# ' "$0" | sed 's/^# \?//'
    echo ""
    echo "Commands:"
    echo "  probe                       — run scrape-probe.ts (sanity)"
    echo "  probe-save [AC]             — probe + save HTML to /tmp"
    echo "  loop [LO] [HI]              — start scrape-loop, optional AC range"
    echo "  loop-nohup [LO] [HI]        — same, detach + log to /var/log"
    echo "  ping                        — verify dashboard reachable + token works"
    echo "  status                      — is scrape-loop running?"
    echo "  stop                        — kill scrape-loop"
    ;;
esac

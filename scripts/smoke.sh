#!/bin/bash
# Integration smoke test against a running server (seeded database).
# Usage: scripts/smoke.sh http://localhost:3100
# Exercises the core clinical flow end-to-end and the key access-control
# boundaries. Exits non-zero on the first failed assertion.
set -euo pipefail

B="${1:-http://localhost:3100}"
J="$(mktemp -d)"
trap 'rm -rf "$J"' EXIT
PASS=0

py() { python3 -c "$1"; }
fail() { echo "SMOKE FAIL: $1" >&2; exit 1; }
ok() { PASS=$((PASS + 1)); echo "  ok: $1"; }

expect_code() { # method url expected [jar] [json]
  local method=$1 url=$2 expected=$3 jar=${4:-} json=${5:-}
  local args=(-s -o /dev/null -w '%{http_code}' -X "$method" "$B$url")
  [ -n "$jar" ] && args+=(-b "$J/$jar")
  [ -n "$json" ] && args+=(-H 'Content-Type: application/json' -d "$json")
  local code
  code=$(curl "${args[@]}")
  [ "$code" = "$expected" ] || fail "$method $url -> $code (expected $expected)"
  ok "$method $url -> $expected"
}

login() { # jar email password
  curl -sf -c "$J/$1" -X POST "$B/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$2\",\"password\":\"$3\"}" >/dev/null || fail "login $2"
  ok "login $2"
}

echo "== waiting for server =="
for i in $(seq 1 60); do
  curl -sf "$B/api/health" >/dev/null 2>&1 && break
  [ "$i" = 60 ] && fail "server did not become healthy"
  sleep 1
done
ok "health"

echo "== public endpoints =="
PRACTICE_ID=$(curl -sf "$B/api/practices" | py 'import sys,json;print(json.load(sys.stdin)["practices"][0]["id"])') || fail "practices list"
ok "practices list"
expect_code GET "/api/waiting-room?practiceId=$PRACTICE_ID" 200
expect_code GET "/manifest.webmanifest" 200
expect_code GET "/sw.js" 200

echo "== patient registers, books a slot, opens a case with vitals =="
STAMP=$(date +%s)
curl -sf -c "$J/pat" -X POST "$B/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"firstName\":\"Smoke\",\"lastName\":\"Test\",\"email\":\"smoke-$STAMP@example.com\",\"password\":\"SmokePass123\"}" >/dev/null || fail "register"
ok "register"

DATE=$(py 'from datetime import date,timedelta
d=date.today()+timedelta(days=1)
while d.weekday()>4: d+=timedelta(days=1)
print(d.isoformat())')
SLOTS=$(curl -sf "$B/api/slots?practiceId=$PRACTICE_ID&date=$DATE")
SLOT=$(echo "$SLOTS" | py 'import sys,json;s=json.load(sys.stdin)["slots"];print(s[0]["time"] if s else "")')
DOCTOR_ID=$(echo "$SLOTS" | py 'import sys,json;s=json.load(sys.stdin)["slots"];print(s[0]["doctorIds"][0] if s else "")')
[ -n "$SLOT" ] || fail "no slots generated for $DATE"
ok "slots generated"

APPT=$(curl -sf -b "$J/pat" -X POST "$B/api/patient/appointments" -H 'Content-Type: application/json' \
  -d "{\"practiceId\":\"$PRACTICE_ID\",\"doctorId\":\"$DOCTOR_ID\",\"scheduledAt\":\"$SLOT\",\"reason\":\"Smoke test visit\"}")
APPT_ID=$(echo "$APPT" | py 'import sys,json;print(json.load(sys.stdin)["appointment"]["id"])') || fail "booking"
ok "slot booked"
# Same doctor + same slot must conflict.
expect_code POST "/api/patient/appointments" 409 pat \
  "{\"practiceId\":\"$PRACTICE_ID\",\"doctorId\":\"$DOCTOR_ID\",\"scheduledAt\":\"$SLOT\",\"reason\":\"double\"}"

CASE_ID=$(curl -sf -b "$J/pat" -X POST "$B/api/patient/cases" -H 'Content-Type: application/json' \
  -d "{\"complaint\":\"Smoke complaint\",\"appointmentId\":\"$APPT_ID\",\"vitals\":{\"systolic\":150,\"diastolic\":95,\"heartRate\":88}}" \
  | py 'import sys,json;print(json.load(sys.stdin)["case"]["id"])') || fail "case create"
ok "case with self vitals"

echo "== attachment upload and retrieval =="
printf '\x89PNG\r\n\x1a\n' > "$J/tiny.png"  # minimal header; type-checked only
head -c 512 /dev/urandom >> "$J/tiny.png"
ATT_ID=$(curl -sf -b "$J/pat" -X POST "$B/api/cases/$CASE_ID/attachments" \
  -F "file=@$J/tiny.png;type=image/png" | py 'import sys,json;print(json.load(sys.stdin)["attachment"]["id"])') || fail "attachment upload"
ok "attachment uploaded"
expect_code GET "/api/attachments/$ATT_ID" 200 pat
expect_code GET "/api/attachments/$ATT_ID" 401

echo "== reception confirms and checks in =="
login rec reception@demo.practicesportal.test 'Password123!'
expect_code PATCH "/api/staff/appointments/$APPT_ID" 200 rec '{"action":"confirm"}'
expect_code PATCH "/api/staff/appointments/$APPT_ID" 200 rec '{"action":"check_in"}'
QUEUED=$(curl -sf "$B/api/waiting-room?practiceId=$PRACTICE_ID" | py 'import sys,json;print(len(json.load(sys.stdin)["queue"]))')
[ "$QUEUED" -ge 1 ] || fail "waiting room empty after check-in"
ok "waiting room shows queue"

echo "== nurse captures vitals, doctor consults and prescribes =="
login nur nurse@demo.practicesportal.test 'Password123!'
expect_code POST "/api/staff/vitals" 201 nur \
  "{\"appointmentId\":\"$APPT_ID\",\"systolic\":148,\"heartRate\":90}"
expect_code PATCH "/api/staff/appointments/$APPT_ID" 403 nur '{"action":"complete"}'

login doc doctor@demo.practicesportal.test 'Password123!'
expect_code PATCH "/api/staff/appointments/$APPT_ID" 200 doc '{"action":"start_consult"}'
expect_code POST "/api/staff/cases/$CASE_ID/records" 201 doc \
  '{"type":"diagnosis","description":"Essential hypertension","icdCode":"I10"}'
expect_code POST "/api/staff/cases/$CASE_ID/records" 201 doc \
  '{"type":"prescription","medication":"Amlodipine","dosage":"5 mg","frequency":"1x daily","durationDays":30}'
expect_code PATCH "/api/staff/appointments/$APPT_ID" 200 doc '{"action":"complete"}'

echo "== patient sees the records; access control holds =="
RECORDS=$(curl -sf -b "$J/pat" "$B/api/patient/cases" | py 'import sys,json
c=json.load(sys.stdin)["cases"][0]
print(len(c["diagnoses"]), len(c["prescriptions"]), len(c["attachments"]))')
[ "$RECORDS" = "1 1 1" ] || fail "patient case records mismatch: $RECORDS"
ok "patient sees diagnosis, prescription, attachment"
expect_code GET "/api/staff/appointments" 403 pat
expect_code GET "/api/patient/profile" 401
expect_code GET "/api/manager/audit" 403 nur

echo
echo "SMOKE PASSED ($PASS assertions)"

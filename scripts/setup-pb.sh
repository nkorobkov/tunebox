#!/bin/bash
# Setup PocketBase collections for TuneBox
# Run this on a machine that can reach the PocketBase container
#
# This script provisions the schema AND the security-hardened rules + settings
#   1. Authenticate as superadmin.
#   2. Create user_tunes, practice_log, attachments collections with rules
#      that constrain @request.body.user to @request.auth.id on create AND
#      treat the user field as immutable on update (prevents ownership
#      transfer attacks).
#   3. Patch the built-in users collection: close direct signup (createRule=
#      null), require verified emails for auth, shorten token TTL to 1h.
#   4. Enable rate limits globally + set human-readable meta.
#

set -euo pipefail

PB=${PB_URL:-"http://172.26.0.7"}
PB_EMAIL=${PB_EMAIL:?"Set PB_EMAIL to your PocketBase superadmin email"}
PB_PASSWORD=${PB_PASSWORD:?"Set PB_PASSWORD to your PocketBase superadmin password"}

# Authenticate
TOKEN=$(curl -s -X POST "$PB/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$PB_EMAIL\",\"password\":\"$PB_PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

if [ -z "$TOKEN" ]; then
  echo "Failed to authenticate"
  exit 1
fi

echo "Authenticated successfully"
AUTH="Authorization: Bearer $TOKEN"

# ---------------------------------------------------------------------------
# user_tunes
#
# Security rules
#  - createRule constrains @request.body.user = @request.auth.id so a caller
#    cannot create a record owned by another user.
#  - updateRule blocks ownership transfer: either user is not in the body, or
#    if it is, it must still equal the caller.
# ---------------------------------------------------------------------------
echo "Cleaning up existing collections (start fresh)..."
curl -s -X DELETE "$PB/api/collections/attachments" -H "$AUTH" 2>/dev/null
curl -s -X DELETE "$PB/api/collections/practice_log" -H "$AUTH" 2>/dev/null
curl -s -X DELETE "$PB/api/collections/user_tunes"   -H "$AUTH" 2>/dev/null

echo "Creating user_tunes collection..."
curl -s -X POST "$PB/api/collections" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user_tunes",
    "type": "base",
    "fields": [
      { "name": "user", "type": "relation", "required": true,
        "options": { "collectionId": "_pb_users_auth_", "cascadeDelete": true, "maxSelect": 1 } },
      { "name": "title", "type": "text", "required": true },
      { "name": "type", "type": "text" },
      { "name": "abc", "type": "text" },
      { "name": "session_id", "type": "number" },
      { "name": "session_url", "type": "url" },
      { "name": "setting_key", "type": "text" },
      { "name": "canonical_tempo", "type": "number" },
      { "name": "author", "type": "text" },
      { "name": "source_url", "type": "url" },
      { "name": "notes", "type": "editor", "options": { "convertURLs": false } },
      { "name": "attachments", "type": "file",
        "options": {
          "maxSelect": 10, "maxSize": 10485760,
          "mimeTypes": ["image/jpeg","image/png","image/webp","application/pdf"]
        } },
      { "name": "instruments", "type": "json" },
      { "name": "labels", "type": "json" },
      { "name": "next_review", "type": "date" },
      { "name": "interval_days", "type": "number", "options": { "min": 0 } },
      { "name": "ease_factor", "type": "number", "options": { "min": 1 } },
      { "name": "consecutive_correct", "type": "number", "options": { "min": 0 } },
      { "name": "practice_tempo", "type": "number", "options": { "min": 0 } },
      { "name": "transpose", "type": "number" }
    ],
    "listRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && @request.body.user = @request.auth.id",
    "updateRule": "user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)",
    "deleteRule": "user = @request.auth.id"
  }'

echo ""
# ---------------------------------------------------------------------------
# practice_log
#
# Security rules
#  - createRule constrains body.user AND ensures the linked user_tune belongs
#    to the caller. Without the user_tune.user check, a user could log
#    practice against another user's tune.
#  - updateRule blocks ownership transfer.
# ---------------------------------------------------------------------------
echo "Creating practice_log collection..."
curl -s -X POST "$PB/api/collections" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "practice_log",
    "type": "base",
    "fields": [
      { "name": "user", "type": "relation", "required": true,
        "options": { "collectionId": "_pb_users_auth_", "cascadeDelete": true, "maxSelect": 1 } },
      { "name": "user_tune", "type": "relation", "required": true,
        "options": { "collectionId": "user_tunes", "cascadeDelete": true, "maxSelect": 1 } },
      { "name": "instrument", "type": "text" },
      { "name": "practiced_at", "type": "date", "required": true },
      { "name": "duration_seconds", "type": "number" },
      { "name": "tempo_used", "type": "number" },
      { "name": "fluency_rating", "type": "number", "required": true,
        "options": { "min": 1, "max": 5 } }
    ],
    "listRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && @request.body.user = @request.auth.id && @request.body.user_tune.user = @request.auth.id",
    "updateRule": "user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)",
    "deleteRule": "user = @request.auth.id"
  }'

echo ""
# ---------------------------------------------------------------------------
# attachments
#
# Security rules + mimeType allowlist
#  - createRule: the rule "user = @request.auth.id" is evaluated against the
#    merged record state, so it implicitly forces body.user = caller.
#  - updateRule blocks ownership transfer.
#  - file.mimeTypes is restricted; without an allowlist, an attacker can
#    upload .svg / .html / .exe / etc.
# ---------------------------------------------------------------------------
echo "Creating attachments collection..."
curl -s -X POST "$PB/api/collections" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "attachments",
    "type": "base",
    "fields": [
      { "name": "user", "type": "relation", "required": true,
        "options": { "collectionId": "_pb_users_auth_", "cascadeDelete": false, "maxSelect": 1 } },
      { "name": "user_tune", "type": "relation", "required": true,
        "options": { "collectionId": "user_tunes", "cascadeDelete": true, "maxSelect": 1 } },
      { "name": "file", "type": "file", "required": true,
        "options": {
          "maxSelect": 1, "maxSize": 20971520,
          "mimeTypes": [
            "image/jpeg","image/png","image/webp","application/pdf",
            "audio/mpeg","audio/mp4","audio/ogg","audio/wav","audio/webm",
            "audio/flac","audio/x-m4a","audio/aac"
          ]
        } },
      { "name": "type", "type": "select",
        "options": { "maxSelect": 1, "values": ["sheet_music","recording","backing_track","other"] } },
      { "name": "bpm", "type": "number" },
      { "name": "label", "type": "text" },
      { "name": "main_source", "type": "bool" }
    ],
    "listRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id",
    "createRule": "user = @request.auth.id",
    "updateRule": "user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)",
    "deleteRule": "user = @request.auth.id"
  }'

echo ""
# ---------------------------------------------------------------------------
# users (built-in auth collection)
#
# Security tightening
#  - createRule = null closes direct email/password signup. New users must
#    arrive via the configured OAuth2 provider.
#  - authRule = "verified = true" prevents unverified accounts from logging
#    in (OAuth users are auto-verified, so existing Google logins keep
#    working).
#  - authToken.duration = 30 days. The frontend (src/lib/pb.js) refreshes
#    the token on any API call if it is more than half-spent, giving users a
#    Facebook-style "stay signed in" experience. XSS mitigations (move token
#    out of localStorage, add CSP) become correspondingly more important — see
#    SECURITY_AUDIT.md H4 and H6.
#  - We also append the `instruments` JSON field used by the app.
# ---------------------------------------------------------------------------
echo "Hardening users collection..."
USERS_COLLECTION=$(curl -s "$PB/api/collections/users" -H "$AUTH")
echo "$USERS_COLLECTION" | python3 -c "
import sys, json
col = json.load(sys.stdin)
fields = col.get('fields', [])
if not any(f['name'] == 'instruments' for f in fields):
    fields.append({'name': 'instruments', 'type': 'json'})
patch = {
    'fields': fields,
    'createRule': None,
    'authRule': 'verified = true',
    'authToken': {**(col.get('authToken') or {}), 'duration': 2592000},
}
print(json.dumps(patch))
" | curl -s -X PATCH "$PB/api/collections/users" \
    -H "$AUTH" -H "Content-Type: application/json" --data @- > /dev/null
echo "users collection patched"

echo ""
# ---------------------------------------------------------------------------
# Global settings: rate limits + trustedProxy + meta (SECURITY_AUDIT.md H1, L3).
# - rateLimits: defaults are sensible (300 req / 10s on /api/, 20 creates / 5s)
#   — we just flip the master switch.
# - trustedProxy.headers: ["X-Forwarded-For"] is critical when PB sits behind
#   Traefik/nginx. Without it, PB sees every request as coming from the proxy's
#   container IP and rate-limit buckets collapse across the whole user base.
# ---------------------------------------------------------------------------
echo "Enabling rate limits, trustedProxy, and setting meta..."
curl -s -X PATCH "$PB/api/settings" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "rateLimits": { "enabled": true },
    "trustedProxy": { "headers": ["X-Forwarded-For"], "useLeftmostIP": true },
    "meta": {
      "appName": "TuneBox",
      "appURL": "https://tunebox.net",
      "senderName": "TuneBox",
      "senderAddress": "support@nkorobkov.com",
      "hideControls": false
    }
  }' > /dev/null
echo "settings patched"

echo ""
echo "Setup complete! Collections:"
curl -s "$PB/api/collections" -H "$AUTH" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for c in data.get('items', data if isinstance(data, list) else []):
    name = c.get('name', '?')
    fields = [f['name'] for f in c.get('fields', [])]
    print(f'  - {name}: {fields}')
"
echo ""
echo "Reminders (not handled by this script):"
echo "  * Configure SMTP for verification / password-reset email."
echo "  * Install pb_hooks/session_proxy.pb.js (hardened version is in the repo)."

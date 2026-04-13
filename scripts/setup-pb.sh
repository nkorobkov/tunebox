#!/bin/bash
# Setup PocketBase collections for TuneBox
# Run this on a machine that can reach the PocketBase container

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

# Delete existing user_tunes if it exists (user said start fresh)
echo "Cleaning up existing collections..."
curl -s -X DELETE "$PB/api/collections/user_tunes" -H "$AUTH" 2>/dev/null
curl -s -X DELETE "$PB/api/collections/practice_log" -H "$AUTH" 2>/dev/null

# Create user_tunes collection
echo "Creating user_tunes collection..."
curl -s -X POST "$PB/api/collections" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user_tunes",
    "type": "base",
    "fields": [
      {
        "name": "user",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "_pb_users_auth_",
          "cascadeDelete": true,
          "maxSelect": 1
        }
      },
      {
        "name": "title",
        "type": "text",
        "required": true
      },
      {
        "name": "type",
        "type": "text"
      },
      {
        "name": "abc",
        "type": "text"
      },
      {
        "name": "session_id",
        "type": "number"
      },
      {
        "name": "session_url",
        "type": "url"
      },
      {
        "name": "setting_key",
        "type": "text"
      },
      {
        "name": "canonical_tempo",
        "type": "number"
      },
      {
        "name": "author",
        "type": "text"
      },
      {
        "name": "source_url",
        "type": "url"
      },
      {
        "name": "notes",
        "type": "editor"
      },
      {
        "name": "attachments",
        "type": "file",
        "options": {
          "maxSelect": 10,
          "maxSize": 10485760,
          "mimeTypes": ["image/jpeg","image/png","image/webp","application/pdf"]
        }
      },
      {
        "name": "instruments",
        "type": "json"
      },
      {
        "name": "labels",
        "type": "json"
      },
      {
        "name": "next_review",
        "type": "date"
      },
      {
        "name": "interval_days",
        "type": "number",
        "options": {
          "min": 0
        }
      },
      {
        "name": "ease_factor",
        "type": "number",
        "options": {
          "min": 1
        }
      },
      {
        "name": "consecutive_correct",
        "type": "number",
        "options": {
          "min": 0
        }
      }
    ],
    "listRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "user = @request.auth.id",
    "deleteRule": "user = @request.auth.id"
  }'

echo ""
echo "Creating practice_log collection..."
curl -s -X POST "$PB/api/collections" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "practice_log",
    "type": "base",
    "fields": [
      {
        "name": "user",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "_pb_users_auth_",
          "cascadeDelete": true,
          "maxSelect": 1
        }
      },
      {
        "name": "user_tune",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "user_tunes",
          "cascadeDelete": true,
          "maxSelect": 1
        }
      },
      {
        "name": "instrument",
        "type": "text"
      },
      {
        "name": "practiced_at",
        "type": "date",
        "required": true
      },
      {
        "name": "duration_seconds",
        "type": "number"
      },
      {
        "name": "tempo_used",
        "type": "number"
      },
      {
        "name": "fluency_rating",
        "type": "number",
        "required": true,
        "options": {
          "min": 1,
          "max": 5
        }
      }
    ],
    "listRule": "user = @request.auth.id",
    "viewRule": "user = @request.auth.id",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "user = @request.auth.id",
    "deleteRule": "user = @request.auth.id"
  }'

echo ""

# Add instruments field to users collection
echo "Adding instruments field to users collection..."
# First get existing users collection
USERS_COLLECTION=$(curl -s "$PB/api/collections/users" -H "$AUTH")
echo "$USERS_COLLECTION" | python3 -c "
import sys, json
col = json.load(sys.stdin)
fields = col.get('fields', [])
# Check if instruments field already exists
if not any(f['name'] == 'instruments' for f in fields):
    fields.append({'name': 'instruments', 'type': 'json'})
    col['fields'] = fields
    print(json.dumps(col))
else:
    print('EXISTS')
" | while read -r line; do
  if [ "$line" != "EXISTS" ]; then
    curl -s -X PATCH "$PB/api/collections/users" \
      -H "$AUTH" \
      -H "Content-Type: application/json" \
      -d "$line" > /dev/null
    echo "Added instruments field to users"
  else
    echo "instruments field already exists on users"
  fi
done

echo ""
echo "Setup complete! Collections created:"
curl -s "$PB/api/collections" -H "$AUTH" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for c in data.get('items', data if isinstance(data, list) else []):
    name = c.get('name', '?')
    fields = [f['name'] for f in c.get('fields', [])]
    print(f'  - {name}: {fields}')
"

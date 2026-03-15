#!/usr/bin/env bash
# Create technician user and add TECH_JWT to .env.local
# Requires: SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local
# Get it: Supabase Dashboard → Project Settings → API → service_role (secret)

set -e

if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

SUPABASE_URL="${SUPABASE_URL:-$VITE_SUPABASE_URL}"
ANON_KEY="${ANON_KEY:-$VITE_SUPABASE_ANON_KEY}"

SERVICE_KEY="${SERVICE_KEY:-$SUPABASE_SERVICE_ROLE_KEY}"
if [ -z "$SERVICE_KEY" ]; then
  echo "❌ SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY required."
  echo "   Add to .env.local or: export SERVICE_KEY=eyJ..."
  echo "   Get it: Supabase Dashboard → Project Settings → API → service_role (secret)"
  exit 1
fi

TECH_EMAIL="teknisyen@test.com"
TECH_PASSWORD="Teknisyen123"

echo "Creating technician user: $TECH_EMAIL ..."
create_res=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TECH_EMAIL\",
    \"password\": \"$TECH_PASSWORD\",
    \"email_confirm\": true
  }")

TECH_USER_ID=$(echo "$create_res" | jq -r '.id // empty')
if [ -z "$TECH_USER_ID" ]; then
  if [[ "$create_res" == *"already been registered"* ]] || [[ "$create_res" == *"already exists"* ]]; then
    echo "User exists, fetching ID..."
    TECH_USER_ID=$(curl -s -X GET "$SUPABASE_URL/auth/v1/admin/users?filter=email%3Deq%3Ateknisyen%40test.com" \
      -H "apikey: $SERVICE_KEY" \
      -H "Authorization: Bearer $SERVICE_KEY" | jq -r '.users[0].id // empty')
  fi
  if [ -z "$TECH_USER_ID" ]; then
    echo "❌ Create failed: $create_res"
    exit 1
  fi
else
  echo "User created: $TECH_USER_ID"
fi

echo "Setting profile role=field_worker (technician)..."
curl -s -X POST "$SUPABASE_URL/rest/v1/profiles" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d "{\"id\": \"$TECH_USER_ID\", \"full_name\": \"Test Teknisyen\", \"role\": \"field_worker\"}" > /dev/null 2>&1 || \
curl -s -X PATCH "$SUPABASE_URL/rest/v1/profiles?id=eq.$TECH_USER_ID" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"full_name": "Test Teknisyen", "role": "field_worker"}' > /dev/null 2>&1 || true

echo "Getting JWT..."
TECH_JWT=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TECH_EMAIL\", \"password\": \"$TECH_PASSWORD\"}" \
  | jq -r '.access_token // empty')

if [ -z "$TECH_JWT" ]; then
  echo "❌ Failed to get JWT. Check password or login."
  exit 1
fi

# Remove existing TECH_* lines from .env.local, then append
if [ -f .env.local ]; then
  grep -v "^TECH_" .env.local > .env.local.tmp || true
  mv .env.local.tmp .env.local
fi

echo "" >> .env.local
echo "# Technician test user (for RLS-02)" >> .env.local
echo "TECH_EMAIL=$TECH_EMAIL" >> .env.local
echo "TECH_PASSWORD=$TECH_PASSWORD" >> .env.local
echo "TECH_JWT=$TECH_JWT" >> .env.local

echo "✅ Technician setup complete. Added to .env.local:"
echo "   TECH_EMAIL, TECH_PASSWORD, TECH_JWT"

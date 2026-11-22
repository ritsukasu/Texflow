#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-http://127.0.0.1:3001}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT
HEADERS=(-H 'X-Requested-With: texflow' -H 'Content-Type: application/json')

for attempt in $(seq 1 45); do
  if curl -fsS "$BASE/api/health" >/dev/null 2>&1; then break; fi
  if [ "$attempt" = 45 ]; then echo "Server did not become healthy" >&2; exit 1; fi
  sleep 2
done

curl -fsS -c "$JAR" "${HEADERS[@]}" \
  -d '{"name":"Smoke Test","email":"smoke@example.com","password":"smoke-test-password"}' \
  "$BASE/api/auth/register" >/dev/null

PROJECT_ID="$(curl -fsS -b "$JAR" "$BASE/api/projects" | jq -r '.projects[0].id')"
RESULT="$(curl -fsS -b "$JAR" "${HEADERS[@]}" -d '{}' "$BASE/api/projects/$PROJECT_ID/compile")"

echo "$RESULT" | jq '{ok: .build.ok, durationMs: .build.durationMs, diagnostics: (.build.diagnostics | length)}'
if [ "$(echo "$RESULT" | jq -r '.build.ok')" != "true" ]; then
  echo "$RESULT" | jq -r '.build.log' | tail -40 >&2
  echo "Compilation failed" >&2
  exit 1
fi

curl -fsS -b "$JAR" "$BASE/api/projects/$PROJECT_ID/pdf" | head -c 5 | grep -q '%PDF-'
echo "Smoke test passed"

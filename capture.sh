#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

: "${CAPTURE_URL:?Set CAPTURE_URL to the preview URL to capture.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the project.}"

case "$CAPTURE_DIR" in
  "$PROJECT_ROOT"|"$PROJECT_ROOT"/*)
    echo "CAPTURE_DIR must be outside the project directory: $CAPTURE_DIR" >&2
    exit 1
    ;;
esac

timed() {
  local label="$1"
  shift
  echo "[capture] $label"
  /usr/bin/time -p "$@"
}

export CAPTURE_URL CAPTURE_DIR

timed "create capture directory" mkdir -p "$CAPTURE_DIR"

wait_attempts=0
status=000
ready=false
wait_deadline=$((SECONDS + 120))
while (( SECONDS < wait_deadline )); do
  wait_attempts=$((wait_attempts + 1))
  status="$(/usr/bin/time -p curl --silent --show-error --location \
    --max-time 15 --output /dev/null --write-out '%{http_code}' "$CAPTURE_URL" || true)"
  if [[ "$status" == 2* || "$status" == 3* ]]; then
    echo "[capture] preview ready after $wait_attempts attempt(s) (HTTP $status)"
    ready=true
    break
  fi
  if [[ "$status" != 404 && "$status" != 408 && "$status" != 429 && "$status" != 5* ]]; then
    echo "[capture] preview rejected the request (HTTP $status): $CAPTURE_URL" >&2
    exit 1
  fi
  sleep 2
done

if [[ "$ready" != true ]]; then
  echo "[capture] preview did not become ready within 120s (last HTTP $status)" >&2
  exit 75
fi

timed "capture desktop and mobile screenshots" node "$PROJECT_ROOT/scripts/capture.mjs"

for name in desktop mobile; do
  file="$CAPTURE_DIR/final-$name.png"
  if [[ ! -s "$file" ]]; then
    echo "[capture] missing screenshot: $file" >&2
    exit 1
  fi
  echo "[capture] wrote $file ($(wc -c < "$file") bytes)"
done

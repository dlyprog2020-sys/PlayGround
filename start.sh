#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

PORT="${PORT:-3000}"
export PORT
: "${OPENCODE_WEB_DIR:=/home/runner/work/_temp/omgithub-web}"
export OPENCODE_WEB_DIR

BUILD_DIR="$PROJECT_ROOT/dist"
export PROJECT_ROOT BUILD_DIR

timed() {
  local label="$1"
  shift
  echo "[start] $label"
  /usr/bin/time -p "$@"
}

mkdir -p "$OPENCODE_WEB_DIR"

if [[ ! -f "$PROJECT_ROOT/node_modules/vite/bin/vite.js" ]]; then
  if [[ -f "$PROJECT_ROOT/package-lock.json" ]]; then
    timed "install dependencies" npm ci --no-audit --no-fund
  else
    timed "install dependencies" npm install --no-audit --no-fund
  fi
fi

timed "build static output" npm run build
timed "verify build output" test -s "$BUILD_DIR/index.html"

timed "write deployment manifest" env \
  PROJECT_ROOT="$PROJECT_ROOT" \
  BUILD_DIR="$BUILD_DIR" \
  node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const project = process.env.PROJECT_ROOT;
    const directory = process.env.BUILD_DIR;
    const relative = path.relative(project, directory);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Build directory must stay inside the project directory.");
    }
    const output = process.env.OPENCODE_WEB_DIR;
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(
      path.join(output, "deployment-output.json"),
      JSON.stringify({ project, directory }),
    );
  '

timed "verify deployment manifest" node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const file = path.join(process.env.OPENCODE_WEB_DIR, "deployment-output.json");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  if (manifest.project !== process.env.PROJECT_ROOT || manifest.directory !== process.env.BUILD_DIR) {
    throw new Error(`Unexpected deployment manifest in ${file}`);
  }
'

echo "[start] serving $BUILD_DIR on http://0.0.0.0:$PORT"
exec /usr/bin/time -p node "$PROJECT_ROOT/node_modules/vite/bin/vite.js" \
  preview --host 0.0.0.0 --port "$PORT" --strictPort

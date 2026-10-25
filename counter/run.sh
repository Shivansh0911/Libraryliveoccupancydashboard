#!/usr/bin/env bash
# Start the on-premise counter portal on Linux/macOS.
cd "$(dirname "$0")" || exit 1
if [ ! -f .env ]; then
  echo "No .env found. Copy .env.example to .env and fill it in first."
  exit 1
fi
exec python app.py

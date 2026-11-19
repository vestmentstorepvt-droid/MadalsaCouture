#!/bin/sh
# usage: render.sh name  -> renders name.html to out/name.png at 1080x1920
D="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$D/out"
for n in "$@"; do
  "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=1080,1920 --virtual-time-budget=10000 \
    --screenshot="$D/out/$n.png" "file:///$D/$n.html" >/dev/null 2>&1
  echo "rendered $n"
done

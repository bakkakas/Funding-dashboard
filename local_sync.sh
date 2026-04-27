#!/bin/zsh
set -euo pipefail
cd /Users/melody/.openclaw/workspace/repos/Funding-dashboard
/usr/bin/git fetch origin main
/usr/bin/git reset --hard origin/main
/usr/bin/python3 update_data.py
/usr/bin/git add funding_data.json
if ! /usr/bin/git diff --cached --quiet; then
  /usr/bin/git commit -m "chore: auto-update funding data"
  /usr/bin/git push origin main
fi

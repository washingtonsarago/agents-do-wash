#!/bin/sh
# Mantém o observador sempre ligado (sobe no login do macOS)
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="$(command -v node)"
PLIST="$HOME/Library/LaunchAgents/dev.agentworld.observer.plist"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>dev.agentworld.observer</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$DIR/observer/server.js</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/agent-world.log</string>
  <key>StandardErrorPath</key><string>/tmp/agent-world.log</string>
</dict></plist>
PL
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "✅ Observador ativo em http://localhost:4321  (remover: launchctl unload $PLIST && rm $PLIST)"

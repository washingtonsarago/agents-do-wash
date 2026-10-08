#!/bin/sh
# Hook do Claude Code -> Agents do Wash. Repassa o JSON do stdin ao observador local.
# Nunca falha nem bloqueia: se o observador estiver desligado, o evento é descartado.
curl -s -m 1 -X POST -H 'Content-Type: application/json' --data-binary @- \
  "http://127.0.0.1:${AGENT_WORLD_PORT:-4321}/hook" >/dev/null 2>&1
exit 0

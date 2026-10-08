#!/bin/sh
# Sobe o observador e abre o mundo no navegador
cd "$(dirname "$0")"
PORT="${PORT:-4321}"
node observer/server.js &
sleep 1
open "http://localhost:$PORT"
wait

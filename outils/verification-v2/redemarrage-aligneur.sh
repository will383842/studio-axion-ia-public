#!/bin/bash
# Chaîne t-r (tour de 5 s) ; dès que la passe image a fini sa 1re tranche, l'aligneur est TUÉ (kill -9), relancé 30 s plus tard.
cd /home/user/studio-axion-ia
V2_MOTS=/tmp/claude-0/v2/gen/mots.json V2_ETAT=/tmp/claude-0/v2/etat-r.json V2_TRAVAIL=t-r V2_VIDEO=v2r V2_TICK_MS=5000 timeout 5000 npx tsx --tsconfig tsconfig.json /tmp/claude-0/v2/harnais/chaine.ts > /tmp/claude-0/v2/chaine-r.log 2>&1 &
until ls /tmp/claude-0/v2/travaux/image/t-r-passe/tranche-000.mp4 >/dev/null 2>&1; do sleep 2; done
echo "$(date +%T) tranche-000 faite : aligneur tué" >> /tmp/claude-0/v2/redemarrage.log
pkill -9 -f "harnais/aligneur.py"; pkill -9 -f "pipe:0 -filter_complex"; pkill -9 -f "rgb48le pipe:1"
sleep 30
echo "$(date +%T) aligneur relancé" >> /tmp/claude-0/v2/redemarrage.log
/tmp/claude-0/v2/harnais/lancer.sh aligneur
wait
echo "$(date +%T) chaîne finie" >> /tmp/claude-0/v2/redemarrage.log

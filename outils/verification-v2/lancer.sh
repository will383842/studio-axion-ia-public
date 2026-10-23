#!/bin/bash
# Lance (ou relance) l'aligneur et/ou studio-rendu en arrière-plan.
quoi="$1"
if [ "$quoi" = aligneur ] || [ "$quoi" = tout ]; then
  cd /tmp/claude-0/v2 && PATH=/tmp/claude-0/bin:$PATH LD_LIBRARY_PATH=/tmp/claude-0/v2/libs:/opt/pw-browsers/chromium-1194/chrome-linux V2_MOTS=${V2_MOTS:-/tmp/claude-0/v2/gen/mots.json} V2_TRAVAUX=/tmp/claude-0/v2/travaux STUDIO_MEDIAPIPE_DOSSIER=/tmp/claude-0/v2/modeles ALIGNEUR_LUTS=/tmp/claude-0/v2/luts PORT=4200 nohup python3 harnais/aligneur.py >> aligneur.log 2>&1 &
fi
if [ "$quoi" = rendu ] || [ "$quoi" = tout ]; then
  cd /home/user/studio-axion-ia/studio-rendu && PATH=/tmp/claude-0/bin:$PATH STUDIO_RENDU_ESSAI=1 STUDIO_RENDU_CLE=cle-essai PORT=4100 nohup node_modules/.bin/tsx src/index.ts >> /tmp/claude-0/v2/rendu.log 2>&1 &
fi

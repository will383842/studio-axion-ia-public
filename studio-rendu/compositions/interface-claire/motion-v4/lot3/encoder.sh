#!/bin/bash
# Réencode les rendus (crf 18) en H.264 crf 28 (< 3 Mo) avec limiteur à -12 dBFS, audio AAC 48 kHz stéréo.
# usage : encoder.sh <dossier-entrée> <dossier-sortie>
mkdir -p "$2"
for f in "$1"/*.mp4; do
  ffmpeg -v error -y -i "$f" -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -c:a aac -ar 48000 -ac 2 -b:a 128k -af "alimiter=limit=0.251:level=disabled" -movflags +faststart "$2/$(basename "$f")"
done

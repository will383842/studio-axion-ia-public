# Vérification V2 — chaîne face caméra de bout en bout (outils)

Scripts du harnais utilisé le 10/10/2026 (rapport : `docs/verification/V2-CHAINE-FACECAM.md`). Rien ici n'appelle un
service payant ni un serveur : tout tourne sur le poste, avec un faux R2 local (GET/PUT sur un dossier).

| Fichier | Rôle |
|---|---|
| `sons.py` | Voix de synthèse (filtre `flite` de FFmpeg) posée sur une ligne de temps : 4 s de pièce vide, phrases, consigne « Monteur, … », « euh », phrase reprise, blanc de 2,6 s, fin à jeter ; souffle rose −50 dBFS et ronflette 50 Hz. Écrit `voix.f32`, `mots.json` (mots horodatés), l'enveloppe pour la bouche. |
| `video.py` | Prise « iPhone » : visage réel (photo `studio-rendu/scripts/planche-photos/personne.jpg`), bouche animée par la voix, grain, code-barres Gray 12 bits = numéro d'image source ; HEVC Main10 HLG BT.2020, 29,97 i/s, stockée 1920 × 1080. Multiplexer ensuite avec `-display_rotation:v:0 -90` (portrait 1080 × 1920 affiché, comme l'iPhone). |
| `stockage.py` | Faux R2 : `python3 stockage.py <dossier> 4700`. |
| `aligneur.py` | Le VRAI serveur `studio-aligneur` (travaux sur disque, `/son`, `/image`, `/visages` réels) ; seule `/transcrire` rend les mots connus (`V2_MOTS`) : le modèle Whisper n'est pas téléchargeable ici. |
| `lancer.sh` | Lance / relance l'aligneur et `studio-rendu` (mode essai, adresses 127.0.0.1). |
| `chaine.ts` | La VRAIE `avancerChaine` contre ces serveurs, un tour toutes les `V2_TICK_MS` ; `V2_HABILLAGE=1` branche studio-rendu (cartes + composition) ; `V2_RATIOS=9:16,4:5,1:1,16:9`. |
| `analyse.py` | Piste montée : numéro d'image source lu dans le code-barres pour CHAQUE image (comparé aux plans), position du son retrouvée par corrélation pour chaque passage gardé (comparée aux gardes), durées. |
| `vide.py` | Images « panneau vide » d'une carte rendue (début / fin). |
| `memoire.py`, `pic.py` | Pic de mémoire (processus + FFmpeg enfants) de `/visages` puis de la passe image ; pic d'une commande. |
| `img7747.mts` | Données réelles IMG_7747 : coupes → mots montés → réalisation → habillage, contrôles, et rendu RÉEL des cartes (`RENDRE=1`). |
| `recalage.mts` | IMG_7747 : mots vus par le monteur avec / sans les recalages de la reprise absorbée. |
| `redemarrage-aligneur.sh` | Chaîne réelle ; l'aligneur est tué (`kill -9`) après la 1re tranche de la passe image et relancé 30 s plus tard. |

Exemple (depuis la racine du dépôt, FFmpeg 7+ avec libvmaf dans le `PATH`, `pnpm install`, `npm ci` dans `studio-rendu`) :

```bash
python3 outils/verification-v2/sons.py /tmp/v2/gen
python3 outils/verification-v2/video.py /tmp/v2/gen studio-rendu/scripts/planche-photos/personne.jpg
ffmpeg -display_rotation:v:0 -90 -i /tmp/v2/gen/stocke.mp4 -f f32le -ar 48000 -ac 1 -i /tmp/v2/gen/voix.f32 \
  -map 0:v -map 1:a -c:v copy -c:a aac -shortest /tmp/v2/r2/prises/iphone.mov
python3 outils/verification-v2/stockage.py /tmp/v2/r2 4700 &
V2_MOTS=/tmp/v2/gen/mots.json python3 outils/verification-v2/aligneur.py &
V2_MOTS=/tmp/v2/gen/mots.json V2_ETAT=/tmp/v2/etat.json npx tsx --tsconfig tsconfig.json outils/verification-v2/chaine.ts
python3 outils/verification-v2/analyse.py /tmp/v2/r2/facecam/v2/ver-1/montage.mov /tmp/v2/etat.json /tmp/v2/gen/iphone.mov
```

Les chemins `/tmp/claude-0/v2/...` écrits en dur dans `lancer.sh`, `redemarrage-aligneur.sh` et `aligneur.py` sont ceux
de la session de vérification : à adapter.

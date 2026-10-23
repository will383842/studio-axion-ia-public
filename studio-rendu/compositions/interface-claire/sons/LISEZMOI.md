# Bruitages du face caméra animée (banque libre)

- `*_00x.wav` : Kenney « Interface Sounds » / « UI Audio », licence **CC0** (voir `LICENCE-Kenney-CC0.txt`).
- `whoosh-in.wav`, `whoosh-out.wav` : fabriqués pour Axion-IA (bruit filtré, aucun échantillon tiers).
- Fabriqués pour Axion-IA par synthèse (aucun échantillon tiers), motions du designer n° 2 (`../motion/`) :
  - `feutre.wav` (0,32 s) : feutre qui crisse (bruit filtré 1,8-7 kHz, grain de frottement) — un coup par passage du
    TRAIT DESSINÉ ;
  - `eclats.wav` (0,4 s) : une douzaine de petits clics secs, rapprochés puis épars — éclatement du CHIFFRE QUI ÉCLATE ;
  - `ding-1.wav` à `ding-5.wav` (0,42 → 0,22 s) : clochette de notification accordée de plus en plus haut (si, ré, mi,
    sol, la) et de plus en plus courte — un par bandeau de la PILE DE NOTIFICATIONS, dans l'ordre. La montée est DANS
    les fichiers : aucune vitesse de lecture à régler (le lecteur ne lit que `[instant, son, volume]`) ;
  - `vibreur.wav` (0,35 s) : moteur de vibration de téléphone — bandeau qui vibre de la pile.

Les plans (`plan-facecam-animee/1`, champ `sons`) nomment ces fichiers sans extension. Le rendu de production sert les
fichiers d'un dossier par `servirDossier` (`studio-rendu/src/composition/serveur-fichiers.ts`) : au branchement (lot I),
le travail de rendu doit copier ce dossier dans le dossier servi et passer des URL complètes au plan.

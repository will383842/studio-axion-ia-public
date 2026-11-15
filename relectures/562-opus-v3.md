# Relecture PR 562 (lot AUT-G) — Opus v3

VERDICT PROVISOIRE : en cours

Tête relue : 5dc51527e705b4492649852c050f309bc1cdbdcb

## (1) Les 2 tests rouges de la v2
- `tests/voix/voix-epinglee-image-video.test.ts` et `tests/cas-concret/services/branchements/branchements.test.ts` : VERTS sur 5dc51527 (avec les 2 suites AUT-G : 4 fichiers, 41 tests verts).
- Ces 2 fichiers ne sont PAS modifiés par la PR (diff master...PR vide pour tests/voix, tests/cas-concret) ; `scripts/echecs-connus.json` inchangé.
- Correction côté code : `src/services/cle-depense-usine.ts` ne donne `cleUsine` que pour l'origine normalisée « usine » (même `normaliserOrigine` que `credits.ts`), objet vide pour le Studio. Aux 4 sites, l'origine passée à la clé est la même que celle passée à la réservation.

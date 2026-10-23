# Générateur : relevé des lots G6 (fabrication par réseau) et G6b (« je lis »), 03/10/2026

Plan : `11-PLAN-FINAL-GENERATEUR-v5.md` (B.10 lignes G6 et G6b, B.4, B.5) ; addendum du 02/10 (prime). Co-signature avec le
moteur avocat et fusion de `generateur/prepare-moteur` : autorisation de Will du 03/10. Moteurs payants en SIMULATION
seulement (aucun appel HeyGen, fal.ai ni Claude).

## Livré

| Où | Quoi |
|---|---|
| `src/briques/declinaison/` (brique commune, pure) | mère = la plus longue ; 9:16 + 4:5 / Carré en option ; union des zones protégées ; coupes imposées aux frontières ouverture / corps / facultatif / fin ; assemblage début neuf + corps de la mère + fin neuve sur des coupes (segment facultatif retiré) ; raccord visible détecté avant toute dépense ; commande partielle (seuls début et fin payés) ; recalage du débit (50 relevés, médiane des 10 derniers dès 5) ; incrustation d'appel |
| `src/moteurs/montage-avocat/` | texte DIT transmis (`texteDitParSegment`, liste `prononciations` vide : une seule application) ; réseaux cochés (`c.reseaux ?? format`) ; encadré de la version ; version sur mère : la voix ne lit que début et fin, puis `assemblage` ; prises filmées (G6b) : calage par le fournisseur « alignement », un angle, prises assemblées posées à la place du double ; projet : temps des segments, morceaux, raccords ; `mereDeclinaison` |
| `src/briques/composition/` | encadré et incrustation d'appel sur le réseau de la version, sous-titres sur l'union ; contrôle des zones annoncées ; incrustation d'objet sous la ligne des sous-titres ; prise filmée opaque (ni micro dessiné ni liseré) |
| `studio-rendu` | opération `assemblage` (sons : échantillons du corps gardés tels quels, fondus de 12 ms aux bords ; prises : vidéo 1080 × 1920) |
| `src/domaine/controles-script/` | `recontrolerSurHorodatageReel` : C6, C7, C10, C11, C26 sur le temps mesuré, sans marge de 10 % |
| `src/services/fabrication-reseaux.ts` | `complementsGenerateur` (appelé par `construireCommande`), « Fabriquer les N », lancement des versions quand la mère est prête (`lancerFabricationConfirmee`, suite hors verrou), raccord visible → fabrication complète à confirmer, « 2e ouverture Reels » (`variante-accroche`, `-A2`), « Monter ma prise » (G6b), contrôles réels, durée réelle, fiche `image`, débit relevé |
| Écrans | fiche sujet : carte et feuille « Fabriquer les N » (prix par version, total, formats), état d'une version (attend la mère, raccord visible, « Sur la vidéo »), « 2e ouverture », « Monter ma prise · 0 € » |

## Preuves (0 €)

- `docs/captures/g6/` : 5 versions réseau rendues EN LOCAL par le vrai moteur (voix Windows, double d'essai, `studio-rendu`
  local) + la vidéo « je lis » ; `planche-5-versions.png`, `planche-raccords-tiktok.png`, `planche-je-lis.png`,
  `preuves.json` (estimations : mère 2,33 €, versions 0,70-0,77 € ; corps identique à la mère à 1 pas de quantification près
  sur 100 % des échantillons ; aucun raccord visible) ; `demo-m4-inchangee.json` (démonstration M4 identique).
- `docs/captures/g6/ecrans/` : 8 captures 390 px.
- Tests : `tests/g6-*.test.ts`, `tests/g6b-*.test.ts`.

## Écarts

1. Moteur du format avocat encore `simulation` par défaut : sans le réglage `moteur.avocat = montage-avocat`, « Fabriquer les N »
   fabrique chaque version en entier (coût affiché tel quel).
2. Le visage reste simulé (lot M6) : le corps des versions reprend l'audio et les plans de la mère ; la piste du double
   sera reprise de la même façon quand elle existera.
3. Raccord visible : la version n'est pas lancée seule ; Will confirme la fabrication complète au coût affiché.
4. Correction d'un défaut G4 : la vidéo d'une version recevait le texte du corps seul ; la commande porte désormais le
   texte assemblé (ouverture + corps + fin).
5. G6b : la séance de tournage enregistre toujours des prises de toute la version ; les prises découpées (corps / début /
   fin) sont prises en charge par la commande (`partie`), l'écran de séance découpée reste à faire.

# Lot R4 — Miniatures réelles (relevé, 03/10/2026)

Plan : `<dossier-de-plan-prive>/PLAN-OUTILS-REELS-2026-10-03.md`, constat C3, lot R4. Branche `outils/r45`, depuis `03d297b`.

## Ce qui change pour Will

- Une vraie vidéo ne reçoit **plus jamais** les 3 images de démonstration comme miniatures (défaut C3).
- Quand l'outil « Miniatures (serveur du studio) » est choisi, chaque vidéo terminée reçoit **3 miniatures tirées
  d'elle-même** : 3 bons moments (le visage d'abord), la plus nette de 5 images autour de chaque moment, le titre
  de couverture écrit dessus, aux couleurs d'Axion, lisible sur un téléphone, dans la zone que les réseaux ne coupent
  jamais. Gratuit (calculé sur notre serveur).
- Sinon (simulation, panne) : la **vraie image** de la vidéo, titre à part. Rien du tout si la vidéo elle-même est
  une fabrication d'essai (plutôt aucune miniature qu'une fausse).
- Onglet Miniature : si le titre est écrit sur l'image, le changer **refait l'image** (même moment, même mise en page ;
  bouton « Refaire l'image avec ce titre »). L'ancienne image reste dans les fichiers (rien n'est effacé). Au-delà de
  5 mots, le titre est raccourci (une ligne d'aide le dit) : le titre enregistré est toujours celui de l'image.

Exemples (rendus en local avec le vrai code, à partir de la vidéo de démonstration M4 — double simulé) :
`_VERIFICATION-STUDIO-2026-10-03/OUTILS-REELS/miniatures/` — `miniature-1-bas.jpg`, `miniature-2-etiquettes.jpg`,
`miniature-3-bandeau.jpg`, et `apercu-telephone-390px.jpg` (grille d'un profil Instagram sur un téléphone de 390 px,
cases 3:4 de 130 px, à l'échelle 2).

## Comment c'est fait

| Morceau | Fichier |
|---|---|
| Règles pures : titre de couverture (5 mots, jamais un mot outil en dernier), mot mis en valeur (un nombre d'abord), 3 instants (instant de couverture du générateur, puis cœur des plans où l'on voit la personne, jamais la 1re seconde, 1,5 s d'écart), taille par format, clé de démonstration | `src/domaine/miniatures.ts` |
| Contrat : `OperationRendu` + `"miniature"` ; `proposer` reçoit `source?` (vidéo et dépôts déjà signés), `couverture?` ; réponse `incrustee?`, `instantSec?`, `variante?` (ajouts purs) | `src/fournisseurs/types.ts`, `studio-rendu/src/contrat.ts` |
| Mise en page pure : zone sûre 1080 × 1350 au milieu du 9:16 (grille 4:5 et 3:4), 1280 × 720 en 16:9 (titre dans les 60 % de gauche, la durée YouTube est en bas à droite), titre coupé en 1 à 4 lignes le plus grand possible sans déborder, sans mot très court seul, toujours sous le visage (jamais dans les 40 % du haut de la zone) | `studio-rendu/compositions/commune/miniature-mise-en-page.ts` |
| Composition Remotion `Miniature` (Montserrat Black chargée en local, mesurée par le navigateur ; 3 mises en page : « bas », « étiquettes » blanches comme l'encadré des vidéos, « bandeau » orange) | `studio-rendu/compositions/commune/Miniature.tsx`, `Racine.tsx` |
| Opération `miniature` (file courte) : 5 images lues par plages dans la vidéo sans texte, la plus nette (`blurdetect`, images noires écartées), mise à la taille + ombres à peine éclaircies + légère netteté, titre par Remotion, JPEG ≤ 2 Mo (4:4:4 d'abord : bords du titre nets) | `studio-rendu/src/operations/miniature.ts`, `studio-rendu/src/index.ts` |
| Fournisseur « studio-rendu » (une demande par miniature, attente bornée 120 s hors verrou, panne passagère soumise à nouveau 2 fois au plus) ; inscription `outilsServeur()` seulement avec `STUDIO_RENDU_URL` ; une ligne dans le registre | `src/fournisseurs/rendu/miniature.ts`, `src/fournisseurs/rendu/inscription.ts`, `src/fournisseurs/index.ts` |
| Service : source = vidéo SANS texte (piste `master-sans-texte`), sinon la vidéo finale ; titre de couverture du générateur (`VarianteReseau.couverture`) sinon tiré du titre ; garde-fou « aucune clé `/demo/` sur une vraie vidéo » ; repli vignette réelle ; nouveau titre → image refaite | `src/services/miniatures.ts`, `src/services/travaux.ts`, `src/services/videos.ts` |
| Écran : pas de titre reposé sur une image où il est déjà écrit ; aide ; libellé du bouton | `src/components/videos/fiche/OngletMiniature.tsx`, `src/app/(studio)/videos/[id]/page.tsx` |
| Exemples rendus en local | `outils/miniatures/rendre-exemples.mts` |

## Preuves

- **ROUGE prouvé sur 03d297b** (`travaux.ts` de 03d297b remis le temps du test, puis le nôtre) :
  `R4 · une vraie vidéo ne reçoit jamais une miniature de démonstration > ROUGE (03d297b)` →
  `AssertionError: v-… : /demo/miniatures/mini-1.jpg: expected true to be false` ; et le repli → `expected 3 to be +0`.
  Vert ensuite.
- `tests/r4-miniatures.test.ts` (23) : règles pures, mise en page dans la zone sûre pour 5 titres × 3 mises en page,
  lisibilité ≥ 84 px sur 1080 (≈ 11 px dans une case de 130 px), fournisseur (demandes, reprise, attente bornée),
  opération en VRAI FFmpeg (vidéo d'essai floue partout sauf à 2,2 s : l'image de 2,2 s est retenue, 1080 × 1920,
  JPEG ≤ 2 Mo déposé).
- `tests/r4-miniatures-reel.test.ts` (2) : chemin complet du studio avec un vrai `studio-rendu` local (serveur et
  files du conteneur), `FOURNISSEUR_MINIATURE=studio-rendu`, stockage R2 signé localement : 3 demandes sur la vidéo
  sans texte, titre « Amende : l'erreur », mot « erreur », 3 miniatures écrites, aucune clé de démonstration ;
  nouveau titre → une seule demande, même instant, même mise en page, nouvelle image, l'ancienne gardée.
- Rendu réel local (`outils/miniatures/rendre-exemples.mts`) : 25,6 s la première (préparation des compositions),
  puis 13-14 s par miniature sur ce poste ; JPEG de 135 à 175 ko.
- `npx tsc --noEmit -p .` = 0 (après `next typegen`, types des routes seulement) ; `studio-rendu` `tsc` = 0 ; eslint
  des fichiers du lot = 0.

## Points d'attention

- File courte de `studio-rendu` : délai de 45 s par travail (compositions préparées dès le démarrage). La toute première miniature après un redémarrage du
  conteneur prépare les compositions (≈ 25 s ici) et peut dépasser : elle est alors soumise à nouveau (le paquet
  reste prêt), c'est prévu.
- Activation : `FOURNISSEUR_MINIATURE=studio-rendu` (ou Réglages > Connexions quand R0 sera fusionné) ; il faut aussi
  le stockage R2 relié (sinon : repli sur la vignette réelle).
- Une vidéo qui a reçu sa vignette en repli ne refait pas ses miniatures toute seule ensuite (aucun bouton « refaire
  les 3 » dans ce lot).
- Démonstration M4 : l'opération `composition` n'est pas touchée ; la composition `Miniature` est seulement ajoutée
  à `Racine.tsx`. Démonstration refaite après R4 + R5 : identique à 03d297b (9:16 octet pour octet) — voir
  `docs/OUTILS-REELS-R5.md` et `docs/captures/r45/demo-m4-inchangee.json`.
- Corrections après relecture (5 mots partout, pastille du bandeau, trait sous le titre) : voir
  `docs/OUTILS-REELS-R5.md`, « Corrections après les 3 refus de relecture ».

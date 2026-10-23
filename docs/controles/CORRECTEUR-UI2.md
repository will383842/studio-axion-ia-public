# Correcteur UI2 — constats du test réel dans Chrome (04/10, version 7fd6eab)

Branche `outils/ui2`, partie de `origin/master` (7fd6eab). Brouillon type avocat, moteurs en essai.
Aucun appel réseau réel, aucune clé. `src/moteurs/montage-avocat/double.ts` et `index.ts` ne sont pas touchés.
Tests : `tests/correcteur-ui2.test.ts` (12 tests, chacun **rouge avant la correction**, vert après).

Vérification à l'écran : serveur local sans base (`STUDIO_SANS_BASE=1`, moteurs en essai), Chromium à 390 px :
mêmes constats que sur studio.axion-ia.com pour U5 et U6 avant correction, puis le comportement attendu après
(aucun défilement horizontal, largeur de page 390 px).

## U5 — « ≈ 12 s » pour 53 mots

**Cause.** Sans voix choisie (« Voix : Choisissez une voix »), `debitLecture` (src/formats/index.ts) retombait sur le
débit d'**écriture** de la recette avocat (4,4 mots/s, mesuré sur des vidéos de référence) : 53 ÷ 4,4 ≈ 12 s. La même
règle donnait la durée de la commande, enregistrée sur la vidéo au lancement (« Durée 12 s » de la vidéo d'essai), et la
liste « Mes scripts » divisait elle aussi par la recette.

**Correction.**
- `debitLecture` : sans voix, le débit est celui de la voix qui lira pour de vrai (2,6 mots/s mesurés, la correction
  U2), sans jamais dépasser la recette d'un format plus lent (podcast 2,4 : inchangé). Un seul calcul pour l'écran
  « Votre vidéo », la feuille Script, la commande, le prix et la durée enregistrée de la vidéo.
- « Mes scripts » (`listerScripts`) passe par le même `debitLecture`.
- Brouillon créé **avant** la correction : l'écran recalcule depuis le texte, et la commande recalcule au lancement ;
  l'ancienne valeur (12 s) en base est remplacée par la bonne (≈ 20 s) dès la fabrication. Testé avec un brouillon
  dont la durée en base vaut 12.
- Voix d'essai (« simulation ») choisie : elle garde le débit de la recette, parce que c'est le débit auquel le moteur
  avocat la fait réellement lire (`montage-avocat/index.ts`, non modifiable ici) ; le contrat du moteur (durée de la
  maquette ≈ durée de la commande) reste tenu.

## U6 — « Fabriquer · ≈ 1,03 € · … · ESSAI » partait d'un coup

**Correction.**
- L'Aperçu dit `essaiGratuit` : moteur d'essai, ni montage réel ni double réel, aucune ligne réelle payante.
- Bouton : « Fabriquer · Essai gratuit · prête en ~24 s » ; dessous, en petit : « Rien n'est payé · En vrai : ≈ 1,03 € ».
  Bloc Coût : « Essai gratuit · en vrai ≈ 1,03 € ». Une vraie vidéo garde « Fabriquer · ≈ 1,03 € · … ».
- Il manque « qui parle » ou la voix :
  - **essai** : feuille « Vidéo d'essai » — « Il manque qui parle et la voix. En essai, une vidéo de démonstration les
    remplace. Rien n'est payé et elle ne part pas sur vos réseaux. » avec « Choisir qui parle » (ou « Choisir la voix »)
    et « Fabriquer l'essai » ;
  - **vraie vidéo** : on les demande avant (la feuille Plateau ou Voix s'ouvre), même si un essai avait été accepté.
- Aucune dépense nouvelle possible : la décision est recalculée sur l'Aperçu du moment ; « Fabriquer l'essai » ne vaut
  que si l'essai est gratuit, et le chemin payant garde la feuille « Avant de fabriquer » (confirmation du prix) et
  les gardes du serveur (`lancerFabrication`), inchangées.

## U7 — « Je fabrique votre vidéo » restait sur des blocs gris

**Cause.** L'écran ne trouvait le travail que par son identifiant, ou dans la liste « en cours » de `/api/travaux`
(travaux actifs et terminés depuis moins de 2 minutes). Page rouverte sans identifiant (le serveur ne passe que les
travaux non terminés), travail terminé depuis plus de 2 minutes, ou identifiant d'un ancien travail : rien n'était
trouvé, et le squelette restait affiché sans fin, alors que l'accueil montrait « Prête 100 % ». Le cas exact du test
réel n'a pas pu être rejoué à l'identique en local (là, le suivi passait) ; la correction couvre tous les chemins où
l'écran ne trouvait rien.

**Correction.**
- `/api/travaux?video=…` sert aussi la **dernière fabrication de la vidéo**, quel que soit son état et son âge
  (`derniereFabricationDeLaVideo`).
- L'écran suit la plus récente entre le travail connu et cette dernière fabrication (`travailAffiche`) : étapes,
  progression, puis « Votre vidéo est prête » et « Voir la vidéo ».
- Réponse reçue et rien à suivre : plus de blocs gris, « Voir ma vidéo » (fiche de la vidéo).

## U8 — « Buffer › Programmer » sur une vidéo d'essai

**Correction.** Le kit porte `videoEssai` (même règle que le refus du serveur : moteur d'essai figé dans la version,
ou fichier de démonstration). La feuille « Envoyer vers Buffer » d'une vidéo d'essai montre seulement « Vidéo d'essai :
elle ne part pas sur vos réseaux. Une vidéo de démonstration remplace la vôtre. Fabriquez-la pour de vrai pour
l'envoyer. » et « Compris » : ni réseaux, ni date, ni envoi. Le raccourci du kit dit « Buffer · Vidéo d'essai ».
Le refus du serveur reste en place.

## U9 — « Toutes 0 » et « Type avocat 0 » avec 2 brouillons

**Correction.** Une seule règle (`src/domaine/mes-videos.ts`) : « Toutes » et l'onglet de chaque format comptent toutes
les vidéos non archivées, brouillons compris ; « Brouillons » en est une partie ; « Archivées » à part. Chaque onglet
montre ce qu'il compte : « Toutes » liste aussi les brouillons (la galerie savait déjà les filtrer), et la page du
format a une section « Brouillons ». Avec deux brouillons type avocat : Toutes 2 · Brouillons 2 · Type avocat 2.
Rien n'est effacé.

## Tests mis à jour

- `tests/e2e/parcours.spec.ts` : le bouton s'appelle « Fabriquer · ≈ … » ou « Fabriquer · Essai gratuit · … ».

## Contrôles

| Contrôle | Résultat |
| --- | --- |
| `npx tsc --noEmit` (racine) | OK |
| `npx tsc --noEmit` (studio-rendu) | OK (dépendances de studio-rendu installées par `npm ci` dans ce poste) |
| `npx eslint .` | OK, 0 erreur |
| `npx vitest run` (complet) | **235 fichiers OK (1 ignoré), 2 891 verts, 2 sautés, 0 rouge** (avant : 2 878). `e2e-verif1-g-import-autonome` lit la disposition d'une construction Turbopack : rouge juste après `--webpack`, vert après `pnpm build` |
| `npx next build --webpack` | OK ; `pnpm build` : OK |

Textes : français simple, vouvoiement, aucun sigle ajouté, aucune mention « IA » ajoutée ni rappelée.

## Ce qui reste

- La voix d'essai du moteur avocat lit à 4,4 mots/s (`montage-avocat/index.ts`, hors de ce lot) : une vidéo montée
  avec une voix d'essai garde cette durée. Les vraies voix HeyGen et l'absence de voix suivent 2,6 mots/s.
- U7 : à revoir sur studio.axion-ia.com après déploiement, avec le même brouillon, pour confirmer que l'écran suit la
  fabrication jusqu'au bout.

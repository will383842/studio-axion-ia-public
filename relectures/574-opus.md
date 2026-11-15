# Relecture PR 574 (RC-28 « Recette de bout en bout et premiers pas »)

**VERDICT : À CORRIGER** (tête complète `cba410776ed71447f7ee64ec7516aba9bf331305`, base `efba326ecbea3d32e7e5e8e03dbc52e628058ebb`)

## Points à corriger

1. **docs/PREMIERS-PAS.md, l. 76-89 (étape D « Fabriquer ») — gravité MOYENNE (bloquant pour un débutant).**
   Le bouton **Fabriquer** reste bloqué tant que la case « Ce conseil n'est pas en première page d'une recherche » n'est pas cochée
   (`src/components/formats/tableau-anime/NouvelleVideoTableau.tsx:653` et `:669`, message `src/domaine/relecture-tableau.ts:189`).
   Le guide ne cite pas cette case. La personne qui suit le guide à la lettre reste coincée.
   À ajouter : une étape « Cochez la case « Ce conseil n'est pas en première page d'une recherche » », et une ligne dans « Si ça bloque » (l. 127-137) pour le message « Cochez d'abord « Ce conseil n'est pas en première page d'une recherche ». ».
   Le même écran demande aussi une confirmation avant de lancer la fabrication : la mentionner sans montant (« Confirmez »), jamais de prix.

2. **docs/PREMIERS-PAS.md, l. 105 et l. 136 — gravité FAIBLE.**
   Le guide dit « Ouvrez la page **À publier** ». Le titre de la page est bien « À publier » (`src/app/(studio)/a-publier/page.tsx:29`),
   mais l'entrée du menu s'appelle « Vidéos validées » (`src/components/coquille/navigation.ts:26`). Un débutant ne la trouvera pas dans le menu.
   Préciser : « dans le menu, cliquez sur **Vidéos validées** ; la page s'appelle « À publier » ».
   Même remarque, plus légère, pour **Mes vidéos** (l. 93, l. 134) : le menu dit « Mes contenus » puis « Vidéos » (`navigation.ts:58`, `:62`).

3. **docs/PREMIERS-PAS.md, l. 14 — gravité MINEURE (facultatif).**
   « Je suis connecté » est au masculin. Proposer une forme neutre : « La connexion au studio est faite. »

## Vérifications faites (conformes)

- Diff : un seul fichier, `docs/PREMIERS-PAS.md` (+149), un seul commit. `scripts/echecs-connus.json` inchangé.
- Tous les écrans, routes et libellés cités existent dans le dépôt (git grep sur la base) : Nouvelle vidéo (`/nouvelle`), Choisir un format, L'erreur corrigée, la phrase d'accroche du format, Ce sujet est déjà traité, Vos brouillons, Découper en scènes, Découpage lancé, Corrections enregistrées, Les scènes, Fabriquer, Fabrication en cours, Un travail est en cours…, En fabrication, Prête, Votre vidéo est prête, Mes vidéos (`/videos`), À publier (`/a-publier`), Contrôler et valider, J'ai regardé la vidéo, tout est en règle, Envoyer en brouillon, Calendrier (`/calendrier`), Rien n'est envoyé sans votre accord…, Copier, Commentaire épinglé, Mention IA, Télécharger, Lien privé, Vidéo d'essai…, Pas encore ouvert / arrive bientôt, Le studio ne répond pas…, À corriger, Reprendre la fiche, Corriger la fiche, Rien n'est prêt à partir, Cochez d'abord « J'ai regardé… ».
- Aucun prix, aucun « Buffer », aucune promesse de gain, ni « Grenoble » ni « Aucun gain garanti ».
- Aucun nom ni prénom de personne ; seulement « le fondateur » et « la personne qui gère le studio ».
- Signature laissée vide : « Recette signée par le fondateur : ____ » (l. 149).
- Vouvoiement, phrases courtes, pas de jargon ; recette sur 5 vidéos avec cases V1 à V5.
- CI verte sur la tête : 7/7 contrôles en succès (eslint/tsc, next build, garde de zone, règles de fer, tests, build Docker, garde interne).

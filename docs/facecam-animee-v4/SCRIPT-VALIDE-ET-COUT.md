# Face caméra animée : reprendre un script validé, vrai coût et plafond

Branche `facecam-animee/script-valide-et-cout` (depuis master). Aucune API payante appelée. Aucun plafond, aucun prix d'un autre format changé.

## Fait

### 1. « Reprendre un script validé » (lecture seule)
- Sur chaque prise déposée de `/face-camera-animee`, un bouton ouvre une feuille avec les scripts **validés** du format `facecam-animee` (`listerScripts({ formatId })` filtré sur `statutEditorial === "valide"`). Un brouillon ou le script d'un autre format n'apparaît jamais.
- Au choix : `obtenirScript(id)` puis `texteScript(blocs)` ; le texte remplit « Ce que vous dites » (le champ s'ouvre). Rien n'est écrit sur le script ni sur son statut. La session est exigée (`exigerSession`).
- État vide : « Aucun script validé pour ce format pour l'instant ».
- Texte très long : coupé à 20 000 signes (borne du champ et du dépôt), à la fin d'un mot, avec l'avis « Ce script est très long : son texte a été raccourci… ».
- Aucun mot interdit ajouté (phrases de l'écran contrôlées par test).

### 2. Vrai coût et plafond de 4 $
- **Avant « Animer ma vidéo »** : encart « Coût de cette vidéo » (ou « pour N vidéos ») : un essai au plus, **pire cas** (jusqu'à 3 essais de Claude), **plafond Claude 4 $ par vidéo** (avec son équivalent en euros), montage et voix à 0 €. Le calcul chiffre la vraie requête du réalisateur v4 (consigne, schéma, transcription de la taille de la prise, essais 2 et 3 avec la liste des erreurs rejouée) par `pireCasRole`, la fonction unique des réservations du studio ; sortie maximale réelle 32 000 (`MAX_JETONS_REALISATEUR_V4`). Ordre de grandeur pour une prise de 60 à 80 s : environ 0,79 $ un essai, environ 2,4 $ au pire (3 essais) ; l'ancienne annonce était 0,05 €.
- **Pendant et après** : chaque carte de vidéo récente affiche « Déjà payé : X € » = somme des dépenses enregistrées de la vidéo (montants simulés et dépenses d'exemple exclus).
- Le plafond lu est le réglage existant `facecamAnimee.plafondClaudeUsd` (défaut 4 $), jamais modifié.
- Hypothèses pessimistes assumées : 3,5 mots/s ou le texte donné s'il est plus long, 12 caractères par mot, tout l'entrant compté en écriture de cache.

## Fichiers touchés
- `src/services/facecam-animee.ts` : `scriptsValidesFacecamAnimee`, `texteDuScriptValideFA`, `texteDitDuScript`, `estimerFacecamAnimee`, `estimationDuLot`, `coutReelVideoFA` ; `dernieresFacecamAnimee` rend `payeCentimesEur`.
- `src/app/(studio)/face-camera-animee/actions.ts` (3 actions) et `page.tsx` (« Déjà payé »).
- `src/moteurs/montage-facecam-animee/realisateur/cout-v4.ts` (estimation pure, nouveau).
- `src/components/formats/facecam-animee/` : `FeuilleScriptsValides.tsx`, `scripts-valides.ts`, `EstimationCout.tsx`, `cout.ts` (nouveaux) ; `DepotPrise.tsx`, `prises.ts`.
- Tests : `tests/facecam-animee/script-valide.test.ts`, `cout-honnete.test.ts`, `cout-reel.test.ts`.
- Captures : `docs/facecam-animee-v4/script-valide/` (`page-1440/390.png`, `liste-vide-1440/390.png`, serveur local en simulation).

## Comment vérifier
- `pnpm vitest run tests/facecam-animee/script-valide.test.ts tests/facecam-animee/cout-honnete.test.ts tests/facecam-animee/cout-reel.test.ts` : 22 tests verts. Le test clé : l'estimation (un essai et trois essais) n'est jamais inférieure au coût d'essais simulés à sortie maximale pour des prises de 15 à 180 s, ni au coût mesuré de 2,00 € de l'essai réel.
- Sur la page : déposer une prise → encart de coût et bouton visibles ; ouvrir la feuille ; valider un script du format dans « Mes scripts » pour le voir apparaître.

## Résultats de contrôle
- `tsc --noEmit` : aucune erreur dans les fichiers touchés. Erreurs déjà présentes sur master dans le cloud : module `remotion` / `@remotion/*` absent (`studio-rendu`), et types générés `RouteContext` / `LayoutProps` (`next typegen` non lancé).
- `vitest tests/facecam-animee` : 489 verts ; 6 fichiers en échec **déjà présents sur master**, tous pour `Cannot find package 'remotion'` (cartes-pleines, elements-visibles, mise-en-page, sous-titres, son-v4 et le test « copie du conteneur de rendu » de mots-interdits-ecran).
- Fichiers interdits intacts : `relecture-script.ts`, `briques/sous-titres/*`, `montage-tableau/*`.

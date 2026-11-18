# Maquettes de tableaux de bord

Dossier des maquettes « vivantes » filmées pour les tutoriels vidéo. Hors `tsconfig`, hors image du rendu, jamais servi par le site (pas sous `public/`). Aucune maquette n'est copiée telle quelle depuis le dépôt privé : on repart des sources, on neutralise la marque.

## Sous-dossiers
`01-courriels`, `02-projets`, `03-accueil-24h`, `04-clients`, `05-stocks`, `06-equipe`, `07-taches` (maquette « Espace démo · Connaissances »), plus `charte/` (cette fiche) et `capture/` (T-EXT-03). Chaque maquette est une fiche à part (T-EXT-05 à T-EXT-11).

## Charte commune (`charte/`)
- `charte.css` : variables de `PALETTE` (`src/briques/charte/axion-2026.ts`, source unique), Manrope, bandeau `.mention-demo` « Démonstration · données fictives ».
- `noms-neutres.json` : noms neutres « Espace démo · <métier> », organisation « Entreprise exemple », liste des noms interdits.
- `controle.ts` : `controlerMaquette(fichiers, noms, maquette)`, pur. Refuse bleu, jaune, dégradé, police hors Manrope, argent, marque, flou, adresse réseau, absence de `window.demoMaquette` (`aller`, `reinitialiser`) ou de `mention-demo`.

Test : `pnpm exec vitest run tests/outils/maquettes-tableaux-de-bord`.

## Règle « jamais sur le PC »
Toute exécution d'un navigateur (Playwright) se fait dans une session cloud ou en CI, jamais sur le PC de Williams.

## Capture (T-EXT-03)
La commande de capture sera ajoutée ici par T-EXT-03 (aucune commande n'existe encore ; non inventée).

## Provenance
Sources d'origine : dépôt privé, `videos-tableaux-de-bord/sources-packs/`. Noms neutres vérifiés le 17/11/2026 par recherche web ; pack 07 renommé « Espace démo · Connaissances » (validé par Williams le 18/11/2026).

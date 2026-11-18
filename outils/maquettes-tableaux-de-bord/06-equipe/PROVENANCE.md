# Provenance · maquette 06 « Espace démo · Équipe »

Démonstration · données fictives. Toutes les données de cette maquette sont des exemples.

## Source exacte
Dépôt privé `axion-plans-prive`, branche `main` :
`usine/generateurs-video/videos-tableaux-de-bord/sources-packs/06_RH/06_RH/90_SOURCES_PROJET_ORIGINAL/FEUILLE_RH_VIDEO_EN_REVISION/APPLICATION/index.html`
(copie du 16/11/2026, fichier unique, environ 37 Ko). Parcours de capture d'origine : `.../VIDEO/PLAN_CAPTURE_ET_MONTAGE.md` (9 étapes) ; Mode démo d'origine : 4 étapes (la demande, la réception, la validation, le planning). Fiche : T-EXT-11 ; charte : T-EXT-04 (`../charte/`).

## Changements (remplacements ciblés, mise en page et textes métier conservés)
- Couleurs : palette d'origine remplacée par la charte ivoire / noir / terracotta via `../charte/charte.css` (orange seulement sur fond noir) ; aucun bleu, aucun jaune, aucun dégradé (l'illustration est noire), aucune ombre.
- Police : Manrope seule (Georgia et Inter retirées).
- Noms : produit → « Espace démo · Équipe » ; organisation → « Entreprise exemple » ; l'ancienne marque et l'ancien nom de société sont supprimés partout (titre, menu, bandeau, documents, assistant, clé de stockage).
- Données marquées « exemple » ; aucun montant, aucun format monétaire.
- Bandeau `.mention-demo` « Démonstration · données fictives » ajouté ; le bouton « Réinitialiser » n'ouvre plus de confirmation (capture déterministe).
- Porte de pilotage `window.demoMaquette = { aller(id), reinitialiser() }` ajoutée (plus `etapes`) ; chaque `aller(id)` repart des données d'origine, donc le résultat ne dépend pas de l'étape précédente.

## Ids d'étapes de `demoMaquette`
Repris du parcours existant, sans écran inventé :
`accueil`, `demande`, `reception`, `validation`, `planning`, `collaborateurs`, `onboarding`, `documents`, `assistant`

- `accueil`, `demande`, `reception`, `validation`, `planning` : les 4 étapes du Mode démo d'origine (demande déposée du 26 au 27 novembre 2026 pour Emma Lefèvre → en attente → validée → jours pleins dans le planning).
- `collaborateurs`, `onboarding`, `documents`, `assistant` : navigation réelle de l'étape 8 du parcours de capture (l'assistant répond à une question sur les congés, réponse simulée).

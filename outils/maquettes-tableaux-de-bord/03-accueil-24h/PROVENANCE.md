# Provenance · maquette 03 « Espace démo · Accueil 24 h »

Démonstration · données fictives.

## Source exacte
Dépôt privé `axion-plans-prive`, branche `main` (blob 6bf72b7c) :
`usine/generateurs-video/videos-tableaux-de-bord/sources-packs/03_CHATBOT_24H/03_CHATBOT_24H/90_SOURCES_PROJET_ORIGINAL/CHATBOT_24H_PRET_POUR_CLAUDE_CODE/01_INTERFACE/index.html`
Source du pack datée du 16/11/2026 (fichier unique, ~28 Ko). Copiée comme donnée, jamais exécutée hors bac à sable.

## Changements (remplacements ciblés, mêmes sélecteurs et mêmes textes métier)
- Couleurs : lien vers `../charte/charte.css`, palette d'origine remplacée par ivoire / noir / terracotta (orange sur noir et pour l'urgence) ; plus de bleu, de jaune, de dégradé ni d'ombre colorée.
- Police : Manrope seule (Inter retirée).
- Noms : produit → « Espace démo · Accueil 24 h », organisation → « Entreprise exemple » (`charte/noms-neutres.json`) ; le flou de nom est retiré.
- Marque tierce de messagerie remplacée par « message d'équipe ».
- Graphique hebdomadaire (42, 57, 48, 79, 62, 91, 73) : conservé, étiqueté « exemple », valeurs fictives non mesurées ; étiquette « Illustration » → « exemple ».
- « même la nuit » / « même quand les bureaux sont fermés » / « 24h/24, 7j/7 » : remplacés par « y compris hors des heures d'ouverture, avec relecture humaine » ou « hors des heures d'ouverture ».
- Argent : aucun montant ni format monétaire (il n'y en avait pas).
- Bandeau `.mention-demo` « Démonstration · données fictives » ajouté.
- Porte `window.demoMaquette = { aller(id), reinitialiser() }` ajoutée ; `reinitialiser()` repart des données d'origine (capture déterministe).

## Ids d'étapes de `demoMaquette.aller(id)`
Repris du scénario causal d'origine (5 étapes, `setStep(0..4)`), sans écran inventé :
- message
- analyse
- alertes
- astreinte
- reprise

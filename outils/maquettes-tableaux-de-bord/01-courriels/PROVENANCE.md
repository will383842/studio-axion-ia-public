# Maquette 01 · Espace démo · Courriels

Démonstration · données fictives.

## Source exacte
Dépôt privé `axion-plans-prive`, branche `main`, état du 16/11/2026 :
`usine/generateurs-video/videos-tableaux-de-bord/sources-packs/01_ASSISTANT_EMAIL/01_ASSISTANT_EMAIL/90_SOURCES_PROJET_ORIGINAL/ASSISTANT_MAIL_IA_DOSSIER_COMPLET_A_VALIDER/01_INTERFACE/{index.html,app.js,demo-data.js,styles.css}`.
Les deux copies autonomes de 104 Ko ne sont pas reprises (doublons).

## Changements (remplacements ciblés, sélecteurs du parcours gardés)
- Couleurs : lien vers `../charte/charte.css` ; palette violet/bleu remplacée par ivoire / noir / terracotta (orange et gris clair sur noir seulement) ; plus de bleu, de jaune, de dégradé, d'ombre ni de flou ; la classe `.pill.blue` devient `.pill.info`.
- Police : Manrope seule (l'ancienne police Inter est retirée).
- Noms : produit → « Espace démo · Courriels » ; organisation → « Entreprise exemple » (`charte/noms-neutres.json`) ; l'ancien nom n'apparaît plus (le flou de nom est supprimé, le nom neutre est écrit en clair) ; `window.VELORA_TEST` devient `window.TEST_MAQUETTE`.
- Bouton « Valider (simulation) » → « Valider (simulation, aucun envoi) » (aucun envoi réel).
- Adresses de courriel fictives : domaine `exemple.invalid` ; la saisie d'un contact n'accepte que ce domaine.
- Donnée : l’entreprise fictive « Industrie Rivage » (nom interdit par la charte) devient « Industrie Horizon ».
- Argent : aucun montant, aucun format monétaire.
- Bandeau `.mention-demo` « Démonstration · données fictives » ajouté ; mise en page décalée de sa hauteur.
- Porte : `window.demoMaquette = { aller(id), reinitialiser() }`.

## Ids d'étapes de `demoMaquette`
Repris du parcours automatique d'origine (7 étapes, même ordre) :
boite-saturee, messages-arrivent, analyse-classement, urgence-expliquee, brouillon-propose, validation-humaine, decision-tracee

`aller(id)` rejoue les étapes précédentes depuis les données d'origine : l'état est déterministe. `reinitialiser()` repart des données d'origine.

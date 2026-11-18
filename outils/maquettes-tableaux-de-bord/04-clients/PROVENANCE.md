# Provenance · maquette « Espace démo · Clients »

**Démonstration · données fictives.** Aucun montant, aucune donnée réelle.

## Source exacte
Dépôt privé `axion-plans-prive`, branche `main` :
`usine/generateurs-video/videos-tableaux-de-bord/sources-packs/04_CRM_BLUEFLOW/04_CRM_BLUEFLOW/90_SOURCES_PROJET_ORIGINAL/interface/index.html`

Copiée le 16/11 (sources du pack), neutralisée dans la fiche T-EXT-10.

## Changements (remplacements ciblés, mêmes sélecteurs et mêmes textes métier)
- Couleurs : lien vers `../charte/charte.css` ; palette d'origine remplacée par ivoire / noir / terracotta (orange et gris clair sur noir) ; aucun bleu, aucun jaune, aucun dégradé, aucune ombre. Police Manrope seule.
- Nom : produit « Espace démo · Clients », organisation « Entreprise exemple » (`charte/noms-neutres.json`) ; l'ancienne marque est remplacée partout (texte, adresses d'exemple, clé de session, nom du fichier CSV).
- Argent : tous les montants et formats monétaires retirés (cartes de pipeline, indicateurs, formulaire, export CSV) ; rien n'est remplacé par un autre montant.
- Chiffres de campagne, scores et indices : suivis de « exemple ».
- Bandeau `.mention-demo` « Démonstration · données fictives » visible ; décalage de la mise en page pour qu'il ne masque rien.
- Porte `window.demoMaquette = { aller(id), reinitialiser() }` ajoutée ; `reinitialiser()` repart des données d'origine (capture déterministe). Les ids reprennent le parcours animé d'origine (6 étapes), sans écran inventé.

## Ids d'étapes de demoMaquette
Ids d'étapes : demande, qualification, relance, reponse, opportunite, client

## Correctifs après relecture
- Sociétés d'exemple renommées « Société exemple A » à « Société exemple G » (plus aucun nom d'origine ni mot de couleur bleue) ; tous les courriels en `@exemple.invalid`.
- Symboles pouvant s'afficher en émoji couleur (⚙, ✉, ▶) remplacés par des signes monochromes (☰, ✎, ►) ; le test refuse tout émoji couleur.

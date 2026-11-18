# Provenance · maquette 05 Stocks (T-EXT-05)

**Démonstration · données fictives.** Tout ce dossier est une maquette locale : aucune donnée réelle, aucun appel réseau, aucun montant d'argent.

## Source exacte
Dépôt privé `axion-plans-prive`, branche `main`, copie du 16/11/2026 :
`usine/generateurs-video/videos-tableaux-de-bord/sources-packs/05_GESTION_STOCKS/05_GESTION_STOCKS/90_SOURCES_PROJET_ORIGINAL/GESTION_STOCKS_PACK_REVISION/01_INTERFACE/{index.html,app.js,demo-data.js,styles.css}`
(`OUVRIR_VERSION_MASQUEE.html` non repris). Fiche : `usine/generateurs-video/plan-v4/equipe2/T-EXT-05.md`. Charte : T-EXT-04 (#1159).

## Changements
- Couleurs : `styles.css` relié à `../charte/charte.css` ; ardoise → noir, orange → terracotta (orange sur noir seulement), pastille bleue → gris ; plus aucun dégradé, aucune ombre ; Manrope seule.
- Nom : ancien nom du produit → « Espace démo · Stocks » ; client → « Entreprise exemple » ; flou CSS supprimé (noms neutres) ; prénom/nom de l'utilisateur et des contacts fournisseurs → intitulés génériques (« Utilisateur exemple », « Contact exemple n »).
- Argent : format monétaire, carte « Valorisation », champ `price`, « Estimation hors frais » et « Prix unitaire » retirés. La carte Valorisation est remplacée par « Fournisseurs actifs » (nombre calculé), car « Références suivies » (calculée depuis `demo-data.js`) existe déjà sur la page : écart assumé par rapport à la fiche, pour éviter deux cartes identiques.
- Chiffres décoratifs : « 3 entrepôts », « 3/4 en attente », « 42 lots sur 7 jours », « 3 jours », « 35 lots » désormais calculés depuis les données.
- Porte : `window.ordivaTest` → `window.demoMaquette = { aller(id), reinitialiser() }` ; ids `alerte`, `seuil`, `analyse`, `proposition`, `validation`, `fin`. `reinitialiser()` repart des données d'origine, sans message ; l'état n'est plus relu depuis `sessionStorage` au chargement (capture déterministe).
- Bandeau `.mention-demo` « Démonstration · données fictives » sur toutes les pages.
- Aucun écran ni libellé de scan de codes-barres ou de réapprovisionnement automatique.

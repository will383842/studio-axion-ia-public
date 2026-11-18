# Provenance · maquette 07 « Espace démo · Connaissances »

## Source
Dépôt privé `axion-plans-prive`, branche `main` :
`usine/generateurs-video/videos-tableaux-de-bord/sources-packs/07_KNOWLEDGE_RAG/07_KNOWLEDGE_RAG/90_SOURCES_PROJET_ORIGINAL/VIDEO_DEMO_ORBIS_2026/01_TABLEAU_DE_BORD/orbis_mode_video.html`
(fichier unique, 40 943 octets ; traité comme donnée, jamais exécuté hors bac à sable cloud). `orbis_original.html` n'est pas repris.

## Changements (remplacements ciblés, structure et sélecteurs conservés)
- Charte : lien vers `../charte/charte.css` ; bleus `#3773a3`, `#326391`, `#eaf1fa` retirés ; police Inter et polices système remplacées par Manrope ; dégradés retirés (pastille de marque, courbe du graphique) ; bandeau `.mention-demo`.
- Noms : l'ancien nom du produit devient « Espace démo · Connaissances » (nom du pack 07 fixé par `AUDIT-COMPLET-18-11.md` § 2 et `charte/noms-neutres.json`, clé `07-taches`) ; l'ancienne organisation fictive devient « Entreprise exemple ».
- Honnêteté : libellés du film sans promesse (« L'assistant peut préparer une relance, à vérifier ») ; chaque chiffre affiché (+ 12 %, + 24 %, 93 %, 97 h, 1 284, 99,2 %) est suivi de « exemple » ; aucun montant d'argent.
- Porte `window.demoMaquette = { aller(id), reinitialiser() }` : étapes `taches`, `ensemble`, `reponse`, `relance`, `recherche`, `controle`, `fin`. `window.demoVideo` est gardé tel quel (sans lecture automatique par défaut) ; les scènes `guide` et `diagnostic` ne sont pas atteignables par `aller`.
- Texte parasite entre deux balises `<style>` de l'original transformé en commentaire HTML.

## Reste hors de cette fiche
`scenario.json`, `script-court.txt`, `donnees.json` (T-EXT-13) ; version 9:16 ; preuve de capture (7 images, session cloud).

# Maquette 02 · Espace démo · Projets (T-EXT-08)

Démonstration · données fictives.

## Source
Dépôt privé `axion-plans-prive`, branche `main`, copie du 16/11/2026 :
`usine/generateurs-video/videos-tableaux-de-bord/sources-packs/02_GESTION_PROJETS/02_GESTION_PROJETS/90_SOURCES_PROJET_ORIGINAL/01_INTERFACE/{index.html,app.js,demo-data.js,styles.css}`.
`product-blur.js` n'est pas repris.

## Changements
- Couleurs : toutes les couleurs d'origine ramenées à la palette de `../charte/charte.css` (ivoire, noir, terracotta, orange, gris) ; plus de vert forêt, de bleu, de jaune ni de dégradé (les 3 dégradés CSS deviennent des aplats ; l'anneau de répartition est tracé en SVG).
- Police : Manrope seule (lien vers `../charte/charte.css`).
- Nom : produit « Espace démo · Projets », organisation « Entreprise exemple » (`../charte/noms-neutres.json`) ; flou de nom retiré.
- `window.SylvaQA` retiré ; `window.demoMaquette = { aller(id), reinitialiser() }` ajouté.
- Pourcentages (avancement, tâches terminées) suivis de la mention « exemple ».
- Argent : champ `budget` retiré des données ; aucun montant affiché.
- Sauvegarde locale du navigateur retirée : `reinitialiser()` repart toujours des données d'origine (capture déterministe).
- Bandeau `.mention-demo` « Démonstration · données fictives ».

## Étapes de `demoMaquette` (mode vidéo d'origine, 8 étapes)
- compte-rendu-oublie
- reunion-recue
- decisions-relevees
- echeances-risque
- validation-humaine
- taches-creees
- resultat-kanban
- pilotage-a-jour

## Notes pour la capture
- `reinitialiser()` repart sans message (paramètre silencieux, comme `reset(true)` de la maquette 05) : la première image est identique à un chargement neuf.
- `aller(id)` vers une étape antérieure à `taches-creees` laisse l'état « approuvé » : appeler `reinitialiser()` avant chaque parcours.
- Les champs `type="date"` dépendent de la langue du navigateur : la capture doit fixer `locale: 'fr-FR'`.
- Couleurs : `styles.css` utilise les variables de `../charte/charte.css` ; l'orange n'est utilisé que sur fond noir ou en pastille, jamais comme texte sur fond clair (texte d'alerte en terracotta).
- Aucun émoji en couleur : seuls des signes monochromes sont utilisés (vérifié par test).

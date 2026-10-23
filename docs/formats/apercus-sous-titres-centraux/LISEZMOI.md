# Sous-titres du tableau sur le système central — aperçus réels (17/10/2026)

Rendus par le moteur (Remotion : `TableauScene` pour la page, `SousTitres` pour le calque), avec la chaîne de la
fabrication : `commandeTableau` (style choisi, bande réservée) → `fabriquerSousTitres` → `groupesTableau` →
`parametresComposition`. Rien n'est redessiné à la main. Aucun appel payant (minutage réaliste, pas de voix).

Refaire : `npx tsx tests/tableau/sous-titres-centraux/apercus.mts` (après `npm ci` dans `studio-rendu`).

- `planche-vertical.jpg` (9:16) et `planche-portrait.jpg` (4:5) : styles en lignes, fonds en colonnes.
- `<style>-<fond>-<format>.jpg` : chaque image en pleine taille, à un instant où un groupe est affiché.
- `resume.json` : style posé, gabarit retenu, contraste du texte, alerte éventuelle, pixels hors charte dans la bande.

| Style choisi | Tableau blanc | Ardoise | Paperboard |
|---|---|---|---|
| Pastille Axion (défaut) | pastille (9,3:1) | pastille ardoise (8,1:1) | pastille (9,3:1) |
| Karaoké (crème) | bandeau (16:1) | karaoké (6,0:1) | bandeau (16:1) |
| Axion pop (Impact) | bandeau (16:1) | Impact (6,0:1) | bandeau (16:1) |

Sur un fond clair, le texte crème d'un style du catalogue n'atteint pas 4,5:1 (l'ombre ne compte pas) : le tableau
passe au cran suivant de la règle centrale des décors, le bandeau (texte foncé sur crème). Même résultat en 9:16 et
en 4:5. Pixels verts, bleus ou violets dans la bande : 0 sur les 18 images.

Images regardées : chaque groupe est lisible, dans la bande basse, sous le contenu de la page ; rien ne monte sur la
page. Les groupes diffèrent d'un style à l'autre (le groupement suit le style : 2 à 4 mots en Karaoké/Pastille, 1 à 2 en
Impact), donc l'instant capturé et l'état de la page aussi.

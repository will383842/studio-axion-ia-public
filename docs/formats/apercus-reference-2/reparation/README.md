# Pages trop chargées, réparées (style « reference/2 », 14/10/2026)

Défaut réel : vidéo `v-b19aefb21d57`. Le découpage de Claude a été refusé deux fois par la règle « page lisible »
(page 6, étape « Automatisez » ; page 7, l'exemple du plombier). Les lignes avaient dû être raccourcies à la main.

Maintenant, avant tout refus, la page est réparée dans cet ordre :

1. le texte est réduit pas à pas jusqu'aux minimums lisibles (titre 70, phrase clé 56, détails 44 px) ; une longue
   ligne peut prendre 4 rangées ; en dernier, les écarts se resserrent ;
2. si la page ne tient toujours pas, sa dernière scène passe sur une page de plus, qui rappelle le même titre ;
3. le refus ne reste qu'en dernier recours, avec ce qu'il faut faire.

Planches (pages finies, rendues pour de vrai, dans les quatre sorties) :

- `planche-refusee-*.jpg` : la fiche refusée, lignes exactes de Claude. Pages 6 et 7 réparées par la seule réduction.
- `planche-page-de-plus-*.jpg` : la même avec un détail de plus à l'exemple. L'exemple passe sur une page de plus
  (page 8, même titre « Un plombier »).

Refaire : `npx tsx tests/tableau/gabarit-pages-chargees/planche.mts` (après `npm ci` dans `studio-rendu`).
Tests : `tests/tableau/gabarit-pages-chargees/pages-chargees.test.ts`.

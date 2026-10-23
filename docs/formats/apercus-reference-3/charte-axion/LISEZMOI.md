# Tableau « reference/3 » à la charte Axion (direction A « Page ivoire »)

Rendu réel (Remotion) du témoin du 15/10 (`tests/tableau/temoins/fabrication-arretee-ecriture-a-l-heure-2026-10-15.json`,
voix rapide), avec les sous-titres. Chaque image = la scène `TableauScene` + le calque `SousTitres` de la composition
complète (données construites par `parametresComposition`, comme à la fabrication).

- `defilement-vertical.jpg`, `defilement-portrait.jpg`, `defilement-carre.jpg`, `defilement-horizontal.jpg` : une image
  toutes les 2,5 s, et la dernière avant le fondu.
- `extrait-10s.mp4` : les 10 premières secondes du vertical (accroche, puis la douleur).
- `gros-plan-haut-et-sous-titres.jpg` : le haut de la page et la bande des sous-titres, en vraie taille, au début, au
  milieu et à la fin du chapitre le plus long.
- `controle-couleurs.json` : contrôle automatique des pixels de chaque image (aucun vert, bleu ni violet ; la teinte
  `#E8A27F` du mot dit est autorisée).

## Barre des chapitres nommés (choix de Will, 15/10)

Une barre arrondie par chapitre présent, dans l'ordre : **Douleur, Solution, Exemple, À vous**, son nom dessous
(Inter SemiBold). Fait : barre pleine `#110A05`, nom `#5E4F3E`. En cours : le rail `#96816A` se remplit en orange
`#B44F29` (temps écoulé dans le chapitre ÷ sa durée, courbe douce), nom `#110A05`. À venir : rail `#96816A`, nom
`#75644F`.

Règle de rattachement : **l'accroche ouvre « Douleur »** (c'est la douleur dite en une phrase) et **« À retenir » ouvre
« À vous »** (le résumé qui prépare l'appel ; sans page d'appel, il reste dans le chapitre d'avant). Le repère écrit
« • La solution » disparaît ; seule la page de l'exemple garde « Exemple illustratif » (l'exemple est inventé).
« Étape x sur N » et la pastille d'étape restent dans le contenu.

## Sous-titres « Pastille Axion »

Style nommé de la brique commune (`src/briques/sous-titres/pastille.ts`, ajout pur : les autres styles ne changent
pas). Groupes de 2 à 4 mots d'une même phrase dans une pastille pleine `#110A05`, texte ivoire `#F6F1E8` en Inter Bold
(62 px en 1080 × 1920, jamais sous 52), le mot dit en orange clair `#E8A27F` qui grossit de 5 % et monte un peu,
fondu court, ombre très douce. Toujours dans la bande basse réservée.

Refaire : `PYTHON=python3 npx tsx tests/tableau/reference-3/apercus-charte.mts --video --gros-plan` (après `npm ci`
dans `studio-rendu` ; Python avec Pillow et NumPy pour le contrôle des couleurs).

## Contraste mesuré (regard de Will du 15/10 : « il manque un peu de contraste »)

Règle : tout texte ≥ 4,5 pour 1 (WCAG AA) sur son fond, tout trait, icône ou élément graphique porteur de sens ≥ 3 pour 1
(`tests/tableau/reference-3/contraste.test.ts`, qui échoue sous le seuil et refuse une couleur dessinée sans mesure).

- `contrastes.json` : chaque couleur, son fond, son rapport (et l'avant).
- `contraste-avant-apres.jpg` : accroche, étape, exemple ; avant à gauche, après à droite.
- `controle-couleurs-gabarit-cadre.json` : contrôle des pixels du défilement de l'exemple validé (0 vert / bleu).

Refaire : `npx tsx tests/tableau/reference-3/apercus-charte.mts --formats vertical --fiche gabarit-cadre --pages-contraste <après> --contraste-avant <avant> --contrastes`
(le dossier `<avant>` rendu avec `--pages-contraste` sur le code d'avant).

Maquette d'origine : PR #241, `maquettes/tableau-charte-axion/A-1…A-4.png`.

# Carrousels : style C + A (ART-1)

Décision du propriétaire : le rendu « néo-brutaliste » (contours noirs de 3-4 px, ombres noires décalées, formes décoratives sans sens) est abandonné. Deux registres seulement :

- **C « typographique »** pour les pages fortes : couvertures (T01, T01B, T01C), idée reçue (T08, T22), citation (T10), appel final (T21). Un gros mot ou une grosse phrase en capitales Inter très grasse, de grands **blocs pleins** (orange `#D9622B` ou encre `#0D0A07`) qui structurent la page : bandeau pleine largeur, demi-page. Pas de cartes, pas de forme décorative.
- **A « éditorial »** pour les pages d'explication : cartes (T02), liste (T06), étapes (T20), questions (T23), sans / avec (T24), cas concret (T26), checklist (T27), schéma (T28). Filets fins de 2 px, air maîtrisé, rubrique en petites capitales espacées, numéros de rang, alignements stricts sur la grille.
- **B « doux »** (carte arrondie, ombre floue légère) : accent ponctuel seulement, quand une page a vraiment besoin d'une surface (nœuds de T28, carte « avec nous » de T26).

Charte inchangée : fond crème `#F8F0E3`, orange, encre, Inter (texte ET titres), Kalam pour UNE annotation manuscrite ponctuelle, une seule page sombre (la dernière). Ni bleu, ni Fraunces, ni JetBrains Mono, ni photo de personne, ni logo d'outil, ni chiffre factuel.

## Grille

| Élément | Valeur |
| --- | --- |
| Page | 1080 × 1350 px |
| Marges | 64 px à gauche, à droite, en haut et en bas (pied compris) |
| Colonne de texte | x = 64 → 912 (848 px) : au-delà, la flèche de LinkedIn (x ≥ 920, y 560-790) et le compteur (x ≥ 860, y ≥ 1080) recouvrent l'image |
| Rythme vertical | multiples de 8 px |
| Blocs pleins (C) | à fond perdu (bord à bord) ; le texte qu'ils portent reste dans la colonne |
| Pied | 56 px : marque « Axion-IA » à gauche (TOUTES les pages, couvertures et page sombre comprises), points de position au centre, flèche à droite (sauf dernière page) |

## Typographie

| Rôle | Police | Corps | Interligne |
| --- | --- | --- | --- |
| Titre de couverture (C) | Inter Display Black 900, capitales | 96-240 px, ajusté à la largeur | calculé (voir plus bas), ≥ 0,98 |
| Titre de page (A) | Inter Display Black 900, capitales | 72-124 px, 2 lignes au plus | calculé, ≥ 0,98 |
| Message clé (T10) | Inter Display Black 900, capitales | 64-150 px | calculé |
| Rubrique | Inter Bold 700, capitales, interlettrage 0,16 em | 26 px | 1 |
| Titre d'élément | Inter Bold 700 | 34-44 px | 1,15 |
| Texte courant | Inter SemiBold 600 | 30-40 px (jamais < 30) | 1,3 |
| Aide, légende | Inter Medium 500 | 30-34 px | 1,3 |
| Numéro de rang | Inter Display Black, orange | 64-88 px (« 01 ») ou pastille de 64 px | 1 |
| Annotation manuscrite | Kalam Bold | ≥ 34 px | 1,1 |

**Interligne des titres en capitales.** Il dépend des lignes : `interligneCapitales` prend, pour chaque paire de lignes voisines, la descente de la ligne n (Ç, virgule, point-virgule, Q, parenthèses) plus la montée de la ligne n + 1 (É, À, Ê…), plus un écart de 0,06 em ; jamais moins de 0,98. « IDÉE REÇUE, / RÉALITÉ » s'écarte donc tout seul, « RANGER / LE BUREAU » reste serré. La mesure du rendu le contrôle sur l'encre réelle (`collisionsInterligne`, comptée dans `chevauchements`).

**Espaces insécables** (`typographieFrancaise`, appliquée à tous les textes de toutes les pages) : espace fine insécable U+202F avant « ? ! ; », insécable U+00A0 avant « : » et « » », après « « ». L'apostrophe typographique ’ n'est jamais touchée.

## Filets, surfaces, numéros

- Filet : 2 px, encre ; il sépare les éléments d'une liste (au-dessus de chaque élément) et souligne le titre de page (pleine colonne).
- Aucune bordure de 3-4 px, aucune ombre décalée. Surface douce (B) : rayon 24 px, fond blanc chaud, ombre floue `0 12px 32px` encre à 10 %.
- Numéro de rang : « 01 », « 02 »… en Inter Display Black orange (grand texte : contraste 3,3:1 ≥ 3:1), ou pastille pleine orange de 64 px au chiffre encre. UN seul système par page : toutes les cartes numérotées OU toutes avec une icône.
- Icônes : banque Lucide (#618), deux tons, seulement quand elles portent un sens. Illustrations : banque maison I01-I12, choisies d'après le sujet (`choisirIllustration`, mots-clés du registre).

## Règles par gabarit

| Gabarit | Registre | Règle |
| --- | --- | --- |
| T01 | C | Titre géant en haut (4 lignes au plus, dernière ligne orange), filet, sous-titre ; bloc orange à fond perdu en bas qui porte l'illustration du sujet ou, sans illustration, le pied seul. Jamais de tiers vide. |
| T01B | C | Demi-page orange à fond perdu en haut avec l'illustration du sujet ; sans illustration, le titre lui-même entre dans le bloc. Titre et sous-titre dessous. Jamais d'aplat vide. |
| T01C | C | Titre en encre dans un grand bloc orange à fond perdu ; dessous, sous-titre et illustration du sujet. |
| T08 | C | Deux moitiés : « AVANT » sur crème, « APRÈS » dans un bloc orange à fond perdu ; textes en grand, aucune forme. |
| T22 | C | Idée reçue en grand, barrée fin, sur crème ; bandeau encre « RÉALITÉ » puis la réalité en grand, filet orange épais à gauche. |
| T10 | C | Bloc orange (le message en capitales, encre) ; légende sous un filet. Sans légende, le bloc prend toute la page. |
| T21 | C | Page sombre : appel en capitales géantes, ligne d'invitation, marque en pied ; trois variantes choisies d'après le sujet du carrousel (`varianteFin`) : bulle pleine orange à trois points crème, bulle au contour crème à trois points orange, ou la phrase d'invitation seule en grand, fin de phrase en orange (typographique, aucun rond). |
| T02 | A | Grille de 2 à 6 éléments : filet au-dessus de chaque élément, numéro OU icône (un seul système), titres alignés par rangée (sous-grille), hauteur au contenu, vide ≤ 25 %. |
| T06 | A | Liste : grand numéro orange, texte, filet entre les points. |
| T20 | A | Étapes : numéro, titre, texte ; filet vertical fin qui relie les numéros. |
| T23 | A | Questions : pastille, question, aide ; icône à droite seulement si CHAQUE question en a une qui a un sens (choisie dans son texte, `iconesDesQuestions`), toutes différentes ; jamais le « ? » répété ; annotation Kalam. |
| T24 | A | Tableau SANS / AVEC : croix et coche dans les en-têtes en petites capitales, filets entre lignes, rangées de même hauteur ; colonne AVEC teintée jusqu'au bord de page, son texte jusqu'au bord permis (912, 860 en bas) ; repli pleine largeur pour les mots longs. |
| T26 | A + B | Étiquette « Scénario type », AVANT (filets), AVEC NOUS (surface douce, pastilles d'outils sous l'illustration), bandeau orange « VOUS : … » dont le texte s'arrête à x = 860 quelle que soit l'étiquette (remplissage droit 220 px). |
| T27 | A | Cases à cocher vides (2 px), filets, jauge sans texte et phrase générique en bas. |
| T28 | A + B | Nœuds en surfaces douces reliés par des flèches fines ; les liaisons ne comptent pas dans le vide (hauteur plafonnée) ; repli à nœuds pleine largeur (icône plus grande) pour les mots longs. |

## Mesure de chaque rendu

0 débordement, 0 texte en zone réservée, 0 chevauchement (texte/texte, texte/dessin, jambage/accent entre lignes de titre), vide du corps ≤ 25 %, aucun texte sous 26 px.

Tour 2 : un mot insécable plus large que sa colonne n'est jamais posé. La porte qualité le refuse AVANT le rendu (MOT_TROP_LONG, chasses réelles d'Inter Bold, `largeur-mot.ts`, `places-mots.ts`) ; `Remplir` refuse un facteur où une ligne ou une pastille sort de sa place ; la mesure du rendu compte ce cas en débordement. Les bords droits de chaque gabarit sont des fonctions pures (`commun/geometrie.ts`, `tests/visuels/bords-droits.test.ts`).

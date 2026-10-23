# Dessin 4 : constat sur les quatre vidéos réelles

Fiches : `tests/tableau/temoins/fiche-*-prod.json`, passées par `remettreEnForme` comme en production, calées sur
0,3 s par mot (aucune voix lue, aucun appel payant), rendues pour de vrai (Remotion). Chaque planche montre la fin de
chaque écran, titré de son nom. Format réel de fabrication, plus le vertical pour toutes.

- `avant/` : le code d'avant ce dessin, sans rien changer.
- `apres/` : le code de cette branche.
- Planches refaites par `npx tsx tests/tableau/dessin-4/apercus.mts docs/formats/apercus-dessin-4/<avant|apres>`.

Défauts que les images de production montrent pendant une animation (texte coupé au bord gauche, rond vide) ne se
voient pas toujours sur une image figée : leur cause a été cherchée dans le rendu (`EcranV2.tsx`) et dans le
moment d'entrée des formes.

## AVANT : défauts vus écran par écran

### relances (vertical, vidéo validée)

- s01 constat : tampon « DEVIS ENVOYÉ » qui redit le titre « Devis envoyé. Puis plus rien. » ; la carte descend
  jusqu'en bas de l'image (vide sous les sous-titres).
- s02 idée reçue : ampoule et cible (la cible n'est pas dans la fiche) ; carte jusqu'en bas de l'image.
- s02 semaine : cinq cases L M M J V vides, flèche et calendrier sous elles.
- s03 à s05 étapes : bonnes (pictogrammes de la fiche).
- s06 exemple : bon.
- s07 récapitulatif : coche et liste cochée ajoutées sous la liste (la liste cochée n'est pas dans la fiche).
- s08 fin : bonne hiérarchie (ÉCRIVEZ / RELANCE / EN COMMENTAIRE), mais trois ronds génériques (bulle, flèche, étoile).

### taches-repetitives (portrait 4:5 réel, et vertical)

- s01 : en vertical, « ADRESSES », « FACTURES », « MÊME QUESTION » en trois tampons l'un sur l'autre, illisibles, sous
  un titre qui les écrit déjà ; en portrait, le titre « Adresses, factures, même question » au-dessus des trois cases qui
  les écrivent (texte en double).
- s02 idée reçue : flèche-boucle, ampoule, cible, clé (seule la flèche-boucle est dans la fiche) ; en vertical un grand
  rond au milieu d'une carte qui descend jusqu'en bas.
- s02 semaine : titre « En une semaine, avec une feuille » puis cinq jours vides (la « carte L perdue dans un grand
  vide »).
- s03 étape : « Feuille » et « Tâche notée » avec deux fois le même document ; « Feuille » redit le titre.
- s03 e1 étape : deux fois la liste cochée ; « Bâton » redit le titre.
- s05 étape : petites calculatrices, liste cochée ajoutée à droite du titre ; les deux cartes redisent le titre.
- s07 exemple : « LE TÉLÉPHONE ? » barré, puis « APRÈS : Recopier les mails vers les devis » : étiquette APRÈS sans
  raison ; trois ronds dessous.
- s08 exemple : « AVANT : Entre : le mail », « APRÈS : Sort : l'en-tête du devis » (entrée / sortie étiquetées avant /
  après) ; document, loupe, courbe ajoutés.
- s09 récapitulatif : « Feuille, bâtons, minutes » écrit au-dessus de la liste qui l'écrit déjà ; barre d'étapes où la
  cinquième case n'affiche que « 5 ».
- s10 fin : « LA / GRILLE / EST PRÊTE / ÉCRIVEZ / GRILLE / EN COMMENTAIRE » en petite colonne sans hiérarchie (la ligne
  « La grille est prête » coupée autour du mot) ; tableau à colonnes en plus.

### habitude-equipe (horizontal 16:9 réel, et vertical)

- s01 accroche : trois ronds génériques (croix, point d'interrogation, sablier) ; cases « UN MOIS APRÈS » et « VIEUX
  RÉFLEXES » qui redisent les lignes du titre.
- s01 constat : sablier, croix, horloge ajoutés (horizontal) ; carte jusqu'en bas (vertical).
- s02 idée reçue : « LE PROBLÈME : LA FORMATION » puis grand cadre (vertical : jusqu'en bas de l'image) avec trois
  petits ronds génériques.
- s02 semaine : « ANCRER UN SEUL RÉFLEXE » au-dessus de cinq jours vides, calendrier, flèche, étoile.
- s03 à s06 étapes : rangée de trois ronds génériques (flèche, coche, engrenage) à côté du numéro en horizontal ;
  cartes « Pour toute l'équipe », « Après chaque réunion », « Au même endroit », « Qu'est-ce qui coince ? » qui redisent
  le titre.
- s07 exemple : « Avant : comptes rendus tapés le soir » barré en titre, un seul panneau « APRÈS », téléphone,
  document, coche ajoutés.
- s08 exemple : sous « AVANT », « Fin du mois : toute l'agence » (c'est un résultat, pas un avant).
- s09 récapitulatif : grand rond liste cochée (de la fiche) ; bon.
- s10 fin : ÉCRIVEZ / HABITUDE / EN COMMENTAIRE / UNE SEULE / HABITUDE / SUFFIT en colonne de six rangées de même
  taille ; bulle, flèche, étoile.

### consigne-ia (vertical réel)

- s01 constat : carte jusqu'en bas ; texte « Chaque phrase, une par / une » ; à l'entrée, les rangées glissaient
  derrière un volet au bord gauche : sur une image prise pendant l'entrée on lit « : phrase, une par » coupé.
- s02 idée reçue : « LE PROBLÈME, C'EST L'IA » puis un grand cadre blanc jusqu'en bas, avec trois petits ronds (point
  d'interrogation de la fiche, ampoule et cible ajoutées).
- s03 à s06 étapes : cartes « Livrable », « Lecteur », « Critère », « Interdit » qui redisent le titre ; étape 4 : le rond
  entrait 120 ms avant son pictogramme (rond vide à l'écran pendant le tracé).
- s07 exemple : « APRÈS : Paragraphes polis, à réécrire » (c'est l'avant) ; enveloppe et document ajoutés.
- s08 exemple : bon (avant / après de la preuve).
- s09 récapitulatif : « Livrable, lecteur / Critère, interdit / UN MODÈLE QUI TIENT » au-dessus de la liste
  « LIVRABLE, LECTEUR, CRITÈRE, INTERDIT » : lignes écrites deux fois.
- s10 fin : seulement « CONSIGNE » en grand (ni « ÉCRIVEZ », ni « EN COMMENTAIRE »).

## Causes corrigées

1. Texte coupé : le rendu faisait glisser chaque rangée de 760 px derrière un volet (et sortir de 1300 px) ; il entre
   maintenant en fondu avec un glissé de 70 px, sans volet. Les tampons du constat sont posés l'un sous l'autre (rotation
   comprise) ; une idée reçue ou une ligne de liste ne coupe plus un signe seul (« ? ») sur sa rangée.
2. Cadres vides : plus aucune carte ne descend jusqu'en bas de l'image ; idée reçue, constat, cartes d'étape, jours de
   la semaine et panneaux de l'exemple s'arrêtent à ce qu'ils montrent ; les cartes de l'exemple et de l'idée reçue
   attendent leur contenu pour entrer.
3. Pictogrammes : seuls ceux de la fiche (élément « dessin » de l'écran) existant dans la banque, chacun une fois ; la
   table des pictogrammes « du moment » est supprimée. Un disque entre en même temps que son dessin. Sans rien à
   montrer, le texte de la scène grandit (titres jusqu'à +75 %, lignes de texte jusqu'à +125 %, quatre rangées
   permises), le titre d'étape passe à côté du numéro en côte à côte, et un contenu qui ne remplit pas est centré en
   hauteur.
4. Double écriture : une ligne dont chaque mot plein est déjà écrit par le corps (ou l'inverse) n'est écrite qu'une
   fois (récapitulatif, cases, cartes d'étape, tampons, panneaux). Barre des étapes : si un nom ne tient pas, l'étape en
   cours garde son nom entier et les autres leur numéro.
5. Avant / après : l'étiquette vient du préfixe de la ligne (« Avant : », « Après : ») ; une ligne « Entre : le mail »
   prend l'étiquette ENTRE ; sans préfixe, l'élément de liste de même rang ou aucune étiquette. Jamais l'ordre seul.
6. Semaine : seulement avec deux éléments au moins, ou un nombre de jours dit (« en 5 jours ») ; sinon écran simple.
7. Fin : la ligne d'appel est toujours posée en ÉCRIVEZ / MOT / EN COMMENTAIRE (ce qui manque est ajouté, une autre
   ligne d'appel de la fiche est remplacée), « ÉCRIVEZ » et « EN COMMENTAIRE » chacun sur une rangée et plus petits que
   le mot ; les autres lignes de la scène restent entières et secondaires.

Contrôles durcis (relecture, bloquants) : « Écran rempli » (un tiers de vide au plus, ou aucun bloc vide d'un seul
tenant de plus d'un tiers), « Texte écrit une fois » (mots couverts), « Cadre rempli », « Pictogrammes de la fiche »,
« Texte entier », « Avant / après ». `tests/tableau/dessin-4/dessin-4.test.ts` prouve, pour chaque fiche et chaque
sortie (vertical, vertical TikTok, portrait, carré, horizontal), que l'ancien rendu (`anciens.json.gz`) est refusé et
le nouveau accepté.

## APRÈS : écran par écran

### relances (vertical)

- s01 constat : bon (carte arrêtée sous le champ ; le tampon qui redisait le titre a disparu).
- s02 idée reçue : bon (ampoule de la fiche seule, carte arrêtée).
- s02 e1 (ancienne semaine) : bon, écran simple « Des relances qui partent seules » et la flèche-boucle de la fiche.
- s03 à s05 étapes : bons, identiques à la vidéo validée.
- s06 exemple : bon, identique.
- s07 récapitulatif : bon (coche de la fiche seule).
- s08 fin : bon, même hiérarchie ; la bulle de la fiche seule.

### taches-repetitives (portrait)

- s01 accroche : bon (titre « Où est passée la journée ? » et les trois cases, sans le titre en double).
- s02 idée reçue : bon ; s02 e1 : bon (écran simple, calendrier de la fiche, plus de jours vides).
- s03 étape : reste un petit défaut : la carte « Tâche notée » est une bande basse au texte assez petit, le document
  est à côté du titre.
- s03 e1, s04, s05, s06 : bons (barre des étapes lisible : « 2 · BÂTONS », « 5 · ENTRÉE, SORTIE » entiers).
- s07 exemple : bon (plus d'étiquette « APRÈS » ; téléphone et enveloppe de la fiche).
- s08 exemple : bon (ENTRE / SORT).
- s09 récapitulatif : bon (plus de ligne au-dessus de la liste).
- s10 fin : bon (« La grille est prête » en secondaire, puis ÉCRIVEZ / GRILLE / EN COMMENTAIRE).
- Vertical : bon partout ; s01 constat n'a plus de tampons (ils redisaient le titre).

### habitude-equipe (horizontal)

- s01 accroche : reste un défaut léger : seule la première case garde son libellé (« FORMÉE À L'IA ») ; les deux
  autres, dont le libellé redisait le titre, n'ont plus que leur croix.
- s01 constat, s02 idée reçue : bons (plus de pictogramme ajouté, carte réduite).
- s02 e1 (ancienne semaine) : bon (« ANCRER UN SEUL RÉFLEXE » et le calendrier de la fiche).
- s03 à s06 étapes : bons (titre à côté du numéro, pictogrammes de la fiche seulement, cartes qui redisaient le titre
  retirées). Le second pictogramme de la fiche (liste cochée, dossier) est en petit à côté de la carte.
- s07 exemple : bon (AVANT puis APRÈS, chacun sur sa ligne).
- s08 exemple : bon (« FIN DU MOIS » puis le résultat coché).
- s09 récapitulatif, s10 fin : bons.
- Vertical : bon partout ; le récapitulatif garde des lignes de tailles inégales (défaut d'avant, non traité ici).

### consigne-ia (vertical)

- s01 constat : bon (carte réduite ; texte entier pendant l'entrée).
- s02 idée reçue : bon (carte réduite à « LE PROBLÈME, C'EST L'IA » et son point d'interrogation de la fiche, petit).
- s03 à s06 étapes : bons (pictogramme de la fiche en grand, cartes qui redisaient le titre retirées ; le disque et son
  pictogramme entrent ensemble).
- s07 exemple : bon (panneau AVANT seul ; « Paragraphes polis, à réécrire » reste en titre barré, comme la fiche).
- s08 exemple : bon.
- s09 récapitulatif : bon (« UN MODÈLE QUI TIENT » puis la liste, rien d'écrit deux fois).
- s10 fin : bon (ÉCRIVEZ / CONSIGNE / EN COMMENTAIRE, champ, bulle de la fiche, adresse du site).

## Ce qui reste

- La fin de TikTok et Shorts (« axion-ia.com » seul) n'est pas jugée par « Écran rempli » : elle n'a rien d'autre à
  montrer et ne reçoit plus de pictogramme ajouté. Ses cadres, ronds et textes restent contrôlés.
- Les deux défauts légers notés plus haut (carte « Tâche notée » en portrait, cases sans libellé d'habitude-equipe).
- Le texte coupé vu en production venait d'images prises pendant une entrée : le nouveau rendu n'utilise plus de volet,
  mais seule une vraie fabrication le confirmera en vidéo.

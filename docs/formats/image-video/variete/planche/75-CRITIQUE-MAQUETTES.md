# 75 · Critique des maquettes de variété (15/10/2026)

**Ce que c'est.** (v3 en tête, puis v2 et v1 pour l'historique.) Le verdict du critique sur chaque maquette (image C, chatbot), jugée image par image contre le standard 74 (grille sur 20, seuil 18, test des vignettes de 200 px). Les notes des designers ont été revérifiées à l'œil et à la mesure (bords du texte, couleurs à la pipette). Règle suivie : *mieux vaut 4 variantes excellentes que 5 moyennes*.

Les références « aujourd'hui » ne sont pas notées : elles servent de comparaison.

## v3 · moitié basse remplie, mesure durcie (relecture du chef, 16/10/2026)

**Verdict du chef sur la v2** : la planche n'est pas au niveau du standard 74. En 9:16, la moitié basse est presque toujours vide, et l'ancienne mesure (`remplissage.py`) ne le voyait pas : elle comptait les bords, si bien qu'un filet ou une carte fantôme suffisaient. Toutes les variantes gardées ont été recomposées, rendues, **regardées une à une** et mesurées avec `prototypes/occupation.py`. Cette nouvelle mesure compte la masse visible et vérifie l'équilibre bas/haut et la zone d'appoint. Tableau complet : `../76-mesure-occupation.md`.

| # | Remarque du chef | Corrigée | Comment |
|---|---|---|---|
| 1 | Moitié basse vide sur presque tous les 9:16 | **Oui** | Contenu agrandi jusqu'aux sous-titres. Zone d'appoint (y 1300 → 1536) faite d'objets pleins et larges : cartes, téléphone, bulles, jauge, frise. Les fantômes en pointillés sont retirés. Les 50 images mesurées passent toutes (occupation de 63 à 100 %). |
| 2 | OUV-B : trou dans la grille de la planche ouverture | **Oui** | OUV-B-1 est refaite (l'ivoire se dévoile, « 4 s » claque) : OUV-B a 2 images. Les bulles d'OUV-B-2 forment une grille régulière, 2 × 2 sous les sous-titres. |
| 3 | TYP-A : « À » flou et coupé | **Oui** | Référence rendue à l'image 356 au lieu de 330 : « MÊME À » est entièrement net. |
| 4 | TRA-B : rectangle blanc derrière « RÉSOLU. » ; TRA-D : trait noir qui déborde | **Oui** | Rectangle et tache verte retirés. Pour TRA-D : fil d'arrivée retiré, pastille du chatbot dans le cadre, branches qui partent de l'intérieur, plus rien ne dépasse. |
| 5 | FIN-D : « 80 % » grisé ; jauge différente en 4:5 | **Oui** | 80 % en ivoire plein (contraste 17,2). Même jauge en 9:16 et en 4:5 : 8 cases pleines puis 2 vides, mêmes couleurs. |
| 6 | Sous-titre qui répète le titre | **Oui** | Chaque écran revérifié. CHI-C-1 répétait « attendre » : son sous-titre est devenu « Maintenant, c'est immédiat. ». |
| 7 | Charte | **Oui** | Nuit ou ivoire, orange terracotta, Anton et Inter Bold. Jamais « Villeexemple », jamais « Aucun gain garanti », aucun logo client. |

**Gardés tels quels** : OUV-A-1, CAM-C-2, CAM-E, l'anneau de CHI-B et le chiffre de CHI-D. Seules leurs zones d'appoint ont été remplies quand la mesure l'exigeait (OUV-A-2, CHI-D-1, CAM-C-1, R45-CAM-C-1). La planche 4:5 et la planche « 3 vidéos » ont été reconstruites avec les nouvelles images. Comme FIN-A est une référence, la vidéo 2 finit maintenant sur FIN-D et la vidéo 3 sur FIN-C.

**Les références « aujourd'hui »** ne sont plus dans les planches d'axe : elles sont sur `planche-0-aujourdhui.jpg`.

### Défauts mineurs qui restent (v3)
- **Sous y = 1536 (20 % du bas), le fond reste vide en 9:16.** C'est voulu : TikTok, Reels et Facebook y posent leur interface (§ 3). Une image JPG nue montre donc toujours une bande de fond en bas.
- **OUV-D-2 (63 %), REC-D-1 (67 %) et REC-D-2 (69 %)** passent les seuils, mais sous la cible interne de 70 %. Pour OUV-D-2, ce sont les interlignes, nécessaires aux accents. Pour REC-D, c'est la pastille « 1/3 », sombre, que la mesure ne compte pas.
- **Les cartes pleines de la zone d'appoint sont sans texte** (CAM-C-1, TRA-D-1, APP-B-2, R45-CAM-C-1), comme l'exige la règle « rien d'indispensable seul ». Elles restent un peu muettes.
- **OUV-B-1 et OUV-B-2 se ressemblent** : c'est le même écran, avant et après le dévoilement.
- **CHI-E-2** : les deux bulles « en vol » reviennent aussi dans la carte de l'équipe, en bas.
- **TYP-D-1** : la cloche est presque refermée (96 %), le geste du feutre se lit un peu moins.
- **TYP-B-2** : le centre du cadran de 3 h tombe dans le fondu du bas, mais il reste lisible.
- Les pastilles d'icônes de REC-B-2 et REC-D dépassent un peu à gauche de x = 65 : ce sont des icônes, pas du texte.
- TYP-A-1 (référence) : le vrai sous-titre de la galerie répète la phrase à l'écran. C'est un défaut du moteur actuel, laissé tel quel.

## v2 · ce qui a changé (relecture du chef de projet, 15/10/2026)

**Verdict du chef sur la v1** : bonne variété, moderne, mais pas au niveau « perfection ». Corrections faites, puis toutes les images v2 repassées une à une par le critique contre le standard 74, **y compris la nouvelle mesure de remplissage** (§ 2 bis : ≥ 60 % de la hauteur utile occupée hors zones protégées et hors bande des sous-titres, trou continu ≤ 15 %, contrôlé sur chaque image avec `prototypes/remplissage.py`). Une reprise ciblée a suivi la première critique, puis une contre-critique.

### Les 8 remarques du chef, une à une
| # | Remarque | Corrigée | Comment |
|---|---|---|---|
| 1 | Moitié basse des écrans 9:16 vide | **Oui** | Chaque écran recomposé : contenu sur toute la hauteur 0,12 → 0,60, éléments plus grands, schémas plus hauts et plus larges ; sous la bande des sous-titres (0,68 → 0,80), une **zone d'appoint** avec des objets qui prolongent l'écran (suite du schéma, téléphone, bulles, frise des étapes), rien d'indispensable seul ; sous 0,80, fond seulement. Sous-titre montré à sa vraie place (0,60 → 0,67). Toutes les images gardées passent la mesure (64 à 98 %). |
| 2 | FIN-D : 80 % fantôme derrière la phrase-choc | **Oui** | Le 80 % passe **au-dessus**, séparé par un filet, avec une jauge de 10 barres ; phrase-choc interlignée (accent de RÉPONSE à 18 px). FIN-D-1 n'est plus montrée (même vignette qu'OUV-A-1) : on garde FIN-D-2 et le 4:5. |
| 3 | TYP-D-1 : cloche en forme de crochet, ALERTE sur le trait | **Oui** | Vraie cloche (anse, épaules, bord évasé, battant) ; ALERTE à ≥ 24 px de chaque trait. |
| 4 | CAM-B-2 : carte CHATBOT IA coupée à gauche | **Oui** | Plongée recadrée, carte et pastille entières (x ≥ 65). |
| 5 | TRA-D : élément noir coupé, 80 % qui touche le trait | **Oui** | Pastille entière (x = 75), fils arrêtés à ≥ 25 px des chiffres. |
| 6 | APP-C : pastille 80 % sur les cartes | **Oui** | Pastille posée au-dessus, à 40 px, sans rien toucher. |
| 7 | Accents qui touchent la ligne du dessus | **Oui** | Interligne des libellés passé à 1,3 ; titres accentués espacés (≥ 8 px partout, 9 à 30 px mesurés). L'étiquette de l'en-tête réel collée à « CLÔTURÉ » vient du moteur (références seulement, voir plus bas). |
| 8 | Sous-titre qui répète le titre | **Oui** | Toutes les voix réécrites (ex. « DEUX CHEMINS. » → « Il trie chaque demande. », « SA LIMITE. » → « Trop complexe pour lui. ») ; ≤ 6 mots, et toutes finissent avant x = 886. |

### Ce que la critique v2 a encore fait corriger (reprise unique)
- **MAT-B / C / D et SOU-C** (17 → retirées, puis reprises) : l'étiquette orange de l'en-tête faisait deux oranges et l'écran comptait 12 mots. Titre local sans étiquette, carte réduite à « Chatbot IA » (6 mots), titre qui finit à x = 874. Puis gardées (18 à 18,5).
- **CHI-C-2** : plus de mot seul dans la zone d'appoint (bulle d'attente barrée). **CHI-D-1** : « 24h/24 » entier, sous la zone cachée du haut. **TYP-C-2** : bloc descendu, faux accent sous « MATIN » retiré. **REC-D-2** : texte de la carte en encre (le gris était hors charte). **CAM-E** : 80 % centré dans son panneau. Pastilles d'icônes ramenées à x ≥ 65 (REC-C-2, CAM-C-2, APP-C-2) ; pastille « équipe » nettoyée (CHI-B-2, CHI-E-2, TYP-D-2) ; R45-CHI-B-1 : sous-titre 4:5 ajouté, bas rempli ; R45-CAM-C-1 : marque dégagée.

### Images qui ne sont plus montrées en v2
- **TYP-C-1** : ses deux filets vides remplissaient le bas sans rien dire (§ 4.8). On garde TYP-C-2.
- **FIN-D-1** : même vignette qu'OUV-A-1. **FIN-C-2** : identique à OUV-C-1 (c'est la boucle), la planche large FIN-C-3 la montre déjà.
- Retraits de la v1 inchangés : CAM-D, TRA-E, FIN-B, SOU-A.

### Défauts mineurs qui restent (non bloquants)
- Casse des chiffres variable selon les écrans (« 23H14 » / « 23h14 », « 4 S » / « 4 s ») : les chiffres sont exacts.
- « Il trie chaque demande. » revient dans plusieurs variantes (Matière, CAM-C) : normal, c'est le même moment de la vidéo.
- OUV-D sans sous-titre montré (écran de texte géant), comme en v1.

### Verdict v2 par variante


#### Axe 1 · Ouverture

| Code | Nom | Décision | Note | Images montrées | Remplissage | Ce qui a changé en v2 |
|---|---|---|---|---|---|---|
| OUV-A | Résultat d'abord | **Gardée** | 18,5 | OUV-A-1, OUV-A-2 | 90 % / trou 5 % ; 73 % / trou 9 % | Bulles 8/10 sous le sous-titre, sous-titres « Pendant votre sommeil. » / « Revenons au tout début. ». |
| OUV-B | Avant / après | **Gardée** | 18,5 | OUV-B-2 | 100 % (bord vertical) / trou 0 % ; vérifié à l'œil : bien rempli | Bulles prolongées dans la zone d'appoint, sous-titre « Le client n'attend plus. ». |
| OUV-C | Horloge à 23h14 | **Gardée** | 18,5 | OUV-C-1, OUV-C-2 | 90 % / trou 4 % ; 65 % / trou 11 % | Téléphone posé dans la zone d'appoint, sous-titres qui ne répètent plus 23h14. |
| OUV-D | Question géante | **Gardée** | 18 | OUV-D-1, OUV-D-2 | 92 % / trou 3 % ; 83 % / trou 7 % | Horizon et lune (plus bulles en D-2) ajoutés dans le bas. |
| OUV-E | Détail puis recul | **Gardée** | 18,5 | OUV-E-1, OUV-E-2 | 94 % / trou 3 % ; 86 % / trou 5 % | Carte de l'équipe en gros plan dessous ; schéma entier étalé sur la hauteur. |

#### Axe 2 · Déroulé du récit

| Code | Nom | Décision | Note | Images montrées | Remplissage | Ce qui a changé en v2 |
|---|---|---|---|---|---|---|
| REC-A | Dans l'ordre | Référence | — | REC-A-1 | — | Niveau d'aujourd'hui, pour comparer. |
| REC-B | Résultat puis comment | **Gardée** | 18 | REC-B-1, REC-B-2 | 77 % / trou 7 % ; 84 % / trou 4 % | Carte fantôme sous le sous-titre (B-1), deux branches (B-2), sous-titre « Il prend le relais. ». |
| REC-C | Suivre un message | **Gardée** | 18,5 | REC-C-1, REC-C-2 | 89 % / trou 6 % ; 87 % / trou 3 % | Téléphone du client dans la zone d'appoint ; pastille du chatbot ramenée à x = 72. |
| REC-D | Trois étapes annoncées | **Gardée** | 18 | REC-D-1, REC-D-2 | 68 % / trou 9 % ; 81 % / trou 6 % | Branches et carte suivante en fantôme dans le bas ; reprise : texte de la carte passée en encre. |

#### Axe 3 · Chiffres

| Code | Nom | Décision | Note | Images montrées | Remplissage | Ce qui a changé en v2 |
|---|---|---|---|---|---|---|
| CHI-A | Compteur | Référence | — | CHI-A-1 | — | Niveau d'aujourd'hui, pour comparer. |
| CHI-B | Jauge en anneau | **Gardée** | 18,5 | CHI-B-1, CHI-B-2 | 81 % / trou 7 % ; 95 % / trou 2 % | Bulles et icône de l'équipe dans la zone d'appoint, sous-titres nouveaux. |
| CHI-C | Duel de tailles | **Gardée** | 18,5 | CHI-C-1, CHI-C-2 | 77 % / trou 9 % ; 77 % / trou 8 % | Bulles en appui ; reprise : « LE LENDEMAIN » barré remplacé par une bulle barrée. |
| CHI-D | Chiffre géant | **Gardée** | 18,5 | CHI-D-1 | 92 % / trou 3 % | Chiffre agrandi puis redescendu sous y = 269 ; « /24 » entier ; demi-cadran dans le bas. |
| CHI-E | Compter en objets | **Gardée** | 18 | CHI-E-2 | 86 % / trou 6 % | Grille 4 × 2 sous le 80 %, équipe dans la zone d'appoint ; pastille de l'équipe nettoyée. |

#### Axe 4 · Caméra

| Code | Nom | Décision | Note | Images montrées | Remplissage | Ce qui a changé en v2 |
|---|---|---|---|---|---|---|
| CAM-A | Suivi | Référence | — | CAM-A-1, CAM-A-2 | — | Niveau d'aujourd'hui, pour comparer. |
| CAM-B | Vue d'ensemble d'abord | **Gardée** | 18,5 | CAM-B-1, CAM-B-2 | 67 % / trou 6 % ; 78 % / trou 11 % | Carte CHATBOT IA recadrée (plus coupée à gauche), schéma prolongé sous le sous-titre. |
| CAM-C | Voyage du message | **Gardée** | 18,5 | CAM-C-1, CAM-C-2 | 70 % / trou 7 % ; 65 % / trou 11 % | Cartes suivantes en fantôme dans la zone d'appoint ; pastilles d'icônes ramenées à x ≥ 68. |
| CAM-D | Plan fixe construit | Retirée | 16 | — | — | Trop de libellés (8) et presque identique à APP-C en vignette. |
| CAM-E | Deux branches côte à côte | **Gardée** | 18,5 | CAM-E-1, CAM-E-2 | 98 % (bord vertical) / trou 2 % ; vérifié à l'œil : bien rempli | Panneaux étirés, étapes sous le sous-titre ; reprise : 80 % centré. |

#### Axe 5 · Écrans de texte

| Code | Nom | Décision | Note | Images montrées | Remplissage | Ce qui a changé en v2 |
|---|---|---|---|---|---|---|
| TYP-A | Mot par mot | Référence | — | TYP-A-1 | — | Niveau d'aujourd'hui, pour comparer (mot flou : défaut connu). |
| TYP-B | Un mot géant | **Gardée** | 18 | TYP-B-2 | 77 % / trou 9 % | Horloge à 3h ajoutée dans la zone d'appoint. |
| TYP-C | Lignes qui glissent | **Gardée** | 18 | TYP-C-2 | 90 % / trou 5 % | Texte agrandi et descendu sous y = 269, point du filet placé après le point final, bulle répondue en bas. |
| TYP-D | Le mot devient objet | **Gardée** | 18,5 | TYP-D-1, TYP-D-2 | 88 % / trou 6 % ; 95 % / trou 3 % | Cloche redessinée, ALERTE ne touche plus le trait ; alerte Telegram et équipe dans le bas. |

#### Axe 6 · Apparition du schéma

| Code | Nom | Décision | Note | Images montrées | Remplissage | Ce qui a changé en v2 |
|---|---|---|---|---|---|---|
| APP-A | Surgit avec rebond | Référence | — | APP-A-1, APP-A-2 | — | Niveau d'aujourd'hui, pour comparer. |
| APP-B | Tracé au feutre | **Gardée** | 18 | APP-B-2 | 75 % / trou 14 % | Carte agrandie, cadre tracé plus grand, carte fantôme dans la zone d'appoint. |
| APP-C | Fantôme qui s'allume | **Gardée** | 18 | APP-C-2 | 73 % / trou 10 % | Pastille 80 % déplacée au-dessus de la carte, pastilles d'icônes à x ≥ 68, schéma étalé jusqu'en bas. |
| APP-D | Cartes qui tombent | **Gardée** | 18,5 | APP-D-1 | 70 % / trou 12 % | Cartes agrandies, fiche suivante dans la zone d'appoint. |

#### Axe 7 · Transitions

| Code | Nom | Décision | Note | Images montrées | Remplissage | Ce qui a changé en v2 |
|---|---|---|---|---|---|---|
| TRA-B | Raccord d'objet | **Gardée** | 18,5 | TRA-B-1, TRA-B-2 | 66 % / trou 12 % ; 89 % / trou 6 % | Frise des quatre étapes dans la zone d'appoint, carte agrandie. |
| TRA-C | Balayage orange | **Gardée** | 18 | TRA-C-1 | 67 % / trou 7 % | Coche en double supprimée, branches de l'équipe dans le bas. |
| TRA-D | On entre dedans | **Gardée** | 18,5 | TRA-D-1 | 83 % / trou 6 % | Pastille du chatbot entière (x = 75), 80 % à 28 px du trait, cartes suivantes dessous. |
| TRA-E | Poussée | Retirée | 16 | — | — | La marque est coupée par la jointure, le mouvement ne se devine pas et l'image ressemble à CAM-E. |

#### Axe 8 · Fin

| Code | Nom | Décision | Note | Images montrées | Remplissage | Ce qui a changé en v2 |
|---|---|---|---|---|---|---|
| FIN-A | Phrase-choc seule | Référence | — | FIN-A-1 | — | Niveau d'aujourd'hui, pour comparer. |
| FIN-B | Schéma puis phrase | Retirée | 16 | — | — | Schéma minuscule sans libellés, et l'écran de la phrase est presque celui de FIN-D. |
| FIN-C | Boucle | **Gardée** | 18,5 | FIN-C-1, FIN-C-3 | 88 % / trou 7 % ; FIN-C-3 98 % | Téléphone répondu dans le bas, 24H/24 agrandi, planche large de la boucle. |
| FIN-D | Le chiffre reste | **Gardée** | 18 | FIN-D-2 | 95 % / trou 3 % | 80 % sorti de derrière la phrase, interligne élargi (accent à 18 px), jauge dans la zone d'appoint. |

#### Axe 9 · Matière

| Code | Nom | Décision | Note | Images montrées | Remplissage | Ce qui a changé en v2 |
|---|---|---|---|---|---|---|
| MAT-A | Net et plat | Référence | — | MAT-A-1 | — | Niveau d'aujourd'hui, pour comparer. |
| MAT-B | Papier | **Gardée** | 18 | MAT-B-1 | 78 % / trou 6 % | Étiquette orange et « analyse la demande » supprimées, voix « Il trie chaque demande. », branches dans le bas. |
| MAT-C | Trait fait main | **Gardée** | 18,5 | MAT-C-1 | 92 % / trou 5 % | Même nettoyage que MAT-B ; branches hachurées dans le bas. |
| MAT-D | Profondeur douce | **Gardée** | 18 | MAT-D-1 | 79 % / trou 6 % | Même nettoyage que MAT-B ; second plateau dans le bas. |

#### Axe 10 · Sous-titres

| Code | Nom | Décision | Note | Images montrées | Remplissage | Ce qui a changé en v2 |
|---|---|---|---|---|---|---|
| SOU-A | Sous-titres calmes | Retirée | 15 | — | — | Impossible à distinguer d'aujourd'hui (SOU-B) en vignette. |
| SOU-B | Équilibré | Référence | — | SOU-B-1 | — | Niveau d'aujourd'hui, pour comparer. |
| SOU-C | Sous-titres appuyés | **Gardée** | 18 | SOU-C-1 | 77 % / trou 6 % | Étiquette et libellé long supprimés, pavé passé d'orange à encre. |

#### Format 4:5

| Image | Décision | Pourquoi |
|---|---|---|
| R45-OUV-A-1 | **Gardée** | Chiffre géant, libellé, jauge et sous-titre à sa place ; tout tient entre x = 60 et 1020. |
| R45-CHI-B-1 | **Gardée** | Sous-titre « Un humain s'en charge. » à sa place, pastille de l'équipe en appui ; le bas n'est plus vide. |
| R45-CHI-D-1 | **Gardée** | Remplit le cadre sans déborder ; « sans pause » sous le filet. |
| R45-CAM-C-1 | **Gardée** | Point, fils et icônes lisibles, sous-titre à sa place ; marque à 50 px de la carte. |
| R45-FIN-D-1 | **Gardée** | 80 % et jauge au-dessus, phrase-choc mot pour mot, accent de RÉPONSE à 18 px. |
| R45-ENS-1 | Retirée | 8 libellés (maximum 6) et une coche qui mord sur « SANS ». |

### Décompte v2
- **30 variantes gardées**, toutes à 18/20 ou plus, toutes au-dessus du seuil de remplissage.
- **4 retirées** (comme en v1) : CAM-D, TRA-E, FIN-B, SOU-A.
- **Images non montrées dans une variante gardée** : TYP-C-1, FIN-C-2, FIN-D-1 (nouveau en v2), plus OUV-B-1, CHI-D-2, CHI-E-1, APP-B-1, APP-C-1, TYP-B-1 (v1) ; en 4:5, R45-ENS-1.
- Les références « aujourd'hui » n'ont pas été retouchées : elles montrent le niveau actuel du studio (leur bas vide inclus).

### Défauts du vrai moteur relevés en v2 (non modifiés)
- `TemoinSousTitres` centre la ligne sur 1080 px sans limite à droite : au-delà d'environ 23 caractères à 58 px, elle passe x = 886 (zone des boutons). En v1, « Le chatbot règle tout seul. » allait jusqu'à x ≈ 908.
- Le mot orange `*…*` du témoin n'est reconnu que sur un seul mot.
- L'en-tête réel colle son étiquette (« CHEMIN 1 · 80 % ») au titre accentué « TICKET CLÔTURÉ. », et l'étiquette est orange en plus du mot orange (déjà relevé en v1).

---

# v1 (historique)

## Axe 1 · Ouverture

| Code | Nom | Décision | Note | Pourquoi |
|---|---|---|---|---|
| OUV-A | Résultat d'abord | **Gardée** | 18,5 | Le 80 % claque plein écran puis rembobine vers 23h14 ; un seul point focal, très peu de texte. |
| OUV-B | Avant / après | **Gardée** | 18 | Écran coupé net : nuit sans réponse à gauche, panneau ivoire « 4 s » à droite ; OUV-B-1 est un doublon, non montré. |
| OUV-C | Horloge à 23h14 | **Gardée** | 18,5 | Un vrai objet du quotidien (horloge, téléphone qui vibre), lisible au premier coup d'œil. |
| OUV-D | Question géante | **Gardée** | 18,5 | Typo géante mot par mot sur ivoire ; refaite : la queue du Q touchait l'accent de RÉPOND. |
| OUV-E | Détail puis recul | **Gardée** | 18 | Gros plan sur l'alerte Telegram puis recul sur tout le schéma : le mouvement se lit sur les deux images. |

## Axe 2 · Déroulé du récit

| Code | Nom | Décision | Note | Pourquoi |
|---|---|---|---|---|
| REC-A | Dans l'ordre | Référence | — | Niveau d'aujourd'hui, pour comparer. |
| REC-B | Résultat puis comment | **Gardée** | 18 | Le 80 % d'abord, puis « Voici comment » ; 2e image refaite (cartes agrandies, plus de vide à droite). |
| REC-C | Suivre un message | **Gardée** | 18,5 | La bulle 23h14 devient un personnage qu'on suit jusqu'au ticket clôturé en 4 s. |
| REC-D | Trois étapes annoncées | **Gardée** | 18 | Repère 1/3, 2/3 net et vraie carte du schéma ; propre et lisible. |

## Axe 3 · Chiffres

| Code | Nom | Décision | Note | Pourquoi |
|---|---|---|---|---|
| CHI-A | Compteur | Référence | — | Niveau d'aujourd'hui, pour comparer. |
| CHI-B | Jauge en anneau | **Gardée** | 18,5 | L'anneau se remplit à 80 %, puis le reste part à l'équipe ; étiquette passée en encre (un seul orange). |
| CHI-C | Duel de tailles | **Gardée** | 18,5 | « Le lendemain » rétrécit et se raye, « 4 s » envahit l'écran : très fort et simple. |
| CHI-D | Chiffre géant | **Gardée** | 18 | « 24h/24 » plein écran qui monte ligne par ligne ; CHI-D-2 retirée (trois chiffres, plus de point focal). |
| CHI-E | Compter en objets | **Gardée** | 18 | Huit bulles cochées, deux partent à l'équipe ; CHI-E-1 retirée (aucun chiffre à l'écran), sous-titre corrigé en « 20 % ». |

## Axe 4 · Caméra

| Code | Nom | Décision | Note | Pourquoi |
|---|---|---|---|---|
| CAM-A | Suivi | Référence | — | Niveau d'aujourd'hui, pour comparer. |
| CAM-B | Vue d'ensemble d'abord | **Gardée** | 18,5 | Schéma en silhouette sur nuit, puis plongée sur le Chatbot IA : la caméra se devine. |
| CAM-C | Voyage du message | **Gardée** | 18,5 | Le point lumineux court sur le fil ; peu de mots, vrai mouvement. |
| CAM-D | Plan fixe construit | Retirée | 16 | Trop de libellés (8) et presque identique à APP-C en vignette. |
| CAM-E | Deux branches côte à côte | **Gardée** | 18,5 | Écran partagé orange / nuit, très lisible ; accents qui touchaient la ligne du dessus corrigés. |

## Axe 5 · Écrans de texte

| Code | Nom | Décision | Note | Pourquoi |
|---|---|---|---|---|
| TYP-A | Mot par mot | Référence | — | Niveau d'aujourd'hui, pour comparer (mot flou : défaut connu). |
| TYP-B | Un mot géant | **Gardée** | 18 | « 3H. » plein écran sur panneau orange ; recentré (débordait à gauche) ; TYP-B-1 « À. » retirée (ne veut rien dire seul). |
| TYP-C | Lignes qui glissent | **Gardée** | 18,5 | Phrase-choc qui sort de ses caches, filet qui se trace ; très éditorial. |
| TYP-D | Le mot devient objet | **Gardée** | 18,5 | « Alerte » devient la cloche qui sonne : idée claire, image forte. |

## Axe 6 · Apparition du schéma

| Code | Nom | Décision | Note | Pourquoi |
|---|---|---|---|---|
| APP-A | Surgit avec rebond | Référence | — | Niveau d'aujourd'hui, pour comparer. |
| APP-B | Tracé au feutre | **Gardée** | 18 | Le feutre trace le fil sous la vraie carte ; APP-B-1 retirée (trop vide, tracé illisible). |
| APP-C | Fantôme qui s'allume | **Gardée** | 18 | Schéma pâle, une seule étape allumée ; APP-C-1 retirée (8 libellés, trop proche de CAM-D). |
| APP-D | Cartes qui tombent | **Gardée** | 18,5 | Fiches qui tombent et se posent, ombre au sol ; carte élargie pour garder le libellé sur une ligne. |

## Axe 7 · Transitions

| Code | Nom | Décision | Note | Pourquoi |
|---|---|---|---|---|
| TRA-B | Raccord d'objet | **Gardée** | 18,5 | La coche grossit jusqu'à devenir l'écran « Résolu » : la transition se comprend sans bouger. |
| TRA-C | Balayage orange | **Gardée** | 18 | Bande orange en diagonale qui révèle « Sa limite » ; petit défaut : coche en double sur la carte. |
| TRA-D | On entre dedans | **Gardée** | 18 | La carte remplit l'écran et devient la scène des deux chemins. |
| TRA-E | Poussée | Retirée | 16 | La marque est coupée par la jointure, le mouvement ne se devine pas et l'image ressemble à CAM-E. |

## Axe 8 · Fin

| Code | Nom | Décision | Note | Pourquoi |
|---|---|---|---|---|
| FIN-A | Phrase-choc seule | Référence | — | Niveau d'aujourd'hui, pour comparer. |
| FIN-B | Schéma puis phrase | Retirée | 16 | Schéma minuscule sans libellés, et l'écran de la phrase est presque celui de FIN-D. |
| FIN-C | Boucle | **Gardée** | 18,5 | L'horloge passe de 3h à 23h14 : la fin retombe sur le début, sans coupure. |
| FIN-D | Le chiffre reste | **Gardée** | 18,5 | Le 80 % reste en fantôme derrière la phrase-choc. |

## Axe 9 · Matière

| Code | Nom | Décision | Note | Pourquoi |
|---|---|---|---|---|
| MAT-A | Net et plat | Référence | — | Niveau d'aujourd'hui, pour comparer. |
| MAT-B | Papier | **Gardée** | 18 | Refaite : le fond « marbré » sale est devenu un grain de papier léger et chic. |
| MAT-C | Trait fait main | **Gardée** | 18 | Contours tremblés et hachures : se voit même en petit. |
| MAT-D | Profondeur douce | **Gardée** | 18 | Cartes avec épaisseur et plateau en relief ; subtil mais propre. |

## Axe 10 · Sous-titres

| Code | Nom | Décision | Note | Pourquoi |
|---|---|---|---|---|
| SOU-A | Sous-titres calmes | Retirée | 15 | Impossible à distinguer d'aujourd'hui (SOU-B) en vignette. |
| SOU-B | Équilibré | Référence | — | Niveau d'aujourd'hui, pour comparer. |
| SOU-C | Sous-titres appuyés | **Gardée** | 18 | Mot-étiquette orange penché dans le sous-titre : nettement plus appuyé. |

## Format 4:5

| Image | Décision | Pourquoi |
|---|---|---|
| R45-OUV-A-1 | **Gardée** | Tient dans le cadre 4:5, chiffre géant lisible. |
| R45-CHI-B-1 | **Gardée** | Anneau bien centré, marges respectées. |
| R45-CHI-D-1 | **Gardée** | Remplit le cadre sans déborder. |
| R45-CAM-C-1 | **Gardée** | Point et fils lisibles, peu de texte. |
| R45-FIN-D-1 | **Gardée** | Phrase-choc lisible sur le 80 % fantôme. |
| R45-ENS-1 | Retirée | 8 libellés (maximum 6) et une coche qui mord sur « SANS ». |

## Paires suspectes (test des vignettes)

| Paire | Distinctes ? | Pourquoi |
|---|---|---|
| CAM-D / APP-C | non | Même fond ivoire, même colonne de cartes, même fantôme à droite : on ne les distingue pas en 200 px. CAM-D retirée. |
| FIN-B / FIN-D | non | Les écrans de phrase ont la même mise en page (phrase à gauche, 3H orange) ; seul le fond change. FIN-B retirée. |
| SOU-A / SOU-B | non | Seuls le soulignement et un mot orange diffèrent : invisible en vignette. SOU-A retirée. |
| OUV-D / OUV-E | oui | Typo géante contre carte en gros plan : forme et point focal différents. |
| MAT-B / MAT-D | oui | De justesse : fond grainé plus sombre contre plateau en relief ; l'axe Matière reste subtil par nature. |

## Décompte

- **30 variantes gardées** (toutes à 18/20 ou plus après reprise).
- **4 retirées** : CAM-D, TRA-E, FIN-B, SOU-A.
- **8 références** « aujourd'hui » : REC-A, CHI-A, CAM-A, APP-A, TYP-A, FIN-A, MAT-A, SOU-B.
- Images retirées dans une variante gardée : OUV-B-1 (doublon), CHI-D-2, CHI-E-1, APP-B-1, APP-C-1, TYP-B-1 ; en 4:5 : R45-ENS-1.

## Ce que le critique a refait

- **OUV-D-1** : « RÉPOND » descendu, la queue du Q ne touche plus l'accent.
- **REC-B-2** : cartes agrandies et recentrées, pastille 80 % remontée ; plus de grand vide à droite, rien dans la bande des sous-titres.
- **TYP-B-2** : « 3H. » réduit et décalé (il commençait à x = 48, dans la zone cachée par Instagram).
- **TYP-C-1** : lignes un peu réduites (le point final dépassait x = 886).
- **MAT-B** : grain de papier allégé (le fond faisait « marbre sale »).
- **CHI-E-2** : sous-titre « Deux pour l'équipe » remplacé par « 20 % pour l'équipe » (chiffre réel de l'image C).
- **Étiquettes du groupe 2** (CHI-B, CHI-C, REC-B, REC-C) : passées en encre / gris clair, pour qu'il ne reste qu'un seul orange par écran.
- **Cartes du groupe 3** : interligne des libellés sur 2 lignes élargi (les accents de « GÉNÉRÉE » touchaient « RÉPONSE ») ; APP-D-1 : carte élargie.

## Défauts du vrai moteur relevés en passant

- **Deux oranges par écran** : l'étiquette d'en-tête (« LE CHATBOT DÉCIDE », « CHEMIN 1 · 80 % ») est orange en plus du mot orange du titre.
- **Blanc sur orange vif** dans la pastille « 80 % » de l'écran « Deux chemins » (contraste 3,0, interdit).
- **Mot flou** pendant le mot par mot (« À » flou dans TYP-A).
- **Interligne trop serré** des libellés Anton sur deux lignes : les accents touchent la ligne du dessus (à vérifier dans `Noeud`).
- **L'étiquette « CHEMIN 1 · 80 % »** (28 px) porte un chiffre : interdit pour l'étiquette selon le standard.
- **Référence des chiffres** : CHI-A montre « 74 % », chiffre d'une autre image de la galerie, pas de l'image C.

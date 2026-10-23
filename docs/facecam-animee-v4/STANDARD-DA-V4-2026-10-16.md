# Standard artistique « v4 » : Face caméra animée, style « qui claque » (16/10/2026)

*Directeur artistique. Ce document **remplace sur le style** `STANDARD-DA-V3-2026-10-16.md` : le verre, les ombres douces, les dégradés, la perspective 3D et le flou de mouvement sont **abandonnés**. Il garde de la v3 la géométrie de la zone du visage, l'idée de fenêtres vidéo et les 14 éléments retenus par Will (re-habillés). Il s'appuie sur les deux nouvelles références d’un créateur de référence (Instagram « repartir de zéro », LinkedIn « équipe d'agents ») mesurées le 16/10. Aucun code n'a été écrit.*

**Ce document est autonome.** Un designer (agent Claude qui code en Remotion/React dans le cloud) doit pouvoir tout faire avec lui seul, sans voir aucun autre fichier.

---

## 0. Lecture, unités, règles fixes

### 0.1 Étiquettes

- **[MESURÉ]** : mesuré sur les références (images à 4 et 30 i/s, pixels échantillonnés) ou calculé (contrastes WCAG).
- **[WILL]** : décision de Will. Non discutable.
- **[CHOIX DA]** : mon choix, à juger par Will **sur extrait vidéo**.
- **[SUPPOSÉ]** : déduction non vérifiée.

### 0.2 Unités

- Image finale **1080 × 1920**, 30 i/s. **L** = largeur (0,01 L = 10,8 px), **H** = hauteur (0,01 H = 19,2 px).
- **Tous les px de ce document sont à 1080 de large.** Les extraits se rendent à 540 × 960 avec `scale: 0.5` : on code en 1080, jamais en 540.
- Temps en **images (i)** à 30 i/s. **i0** = l'image où le mot déclencheur commence.
- Coordonnées en fraction de L (x) et de H (y), origine en haut à gauche.

### 0.3 Ce qui change par rapport à la v3

| v3 (abandonné) | v4 (nouveau) |
|---|---|
| Verre (`backdrop-filter`), ombres douces en 3 couches, dégradés, reflets | **Aplats francs**, **contour encre épais**, **ombre dure encre sans flou** |
| Perspective 3D, `rotateX/rotateY`, flou de mouvement, mise au point | Mouvements **2D secs** : chute, pop, glissement, rotation dans le plan (`rotateZ`) |
| Orange #B44F29 en plaque, texte ivoire dessus (3,8:1) | **Accent clair et vif** (turquoise ou orange vif), **texte encre dessus** (7,2 à 12,5:1) |
| Sous-titres 2-3 mots, ≈ 0,042 L par capitale, bas fixe | **1-2 mots, capitales ≈ 1,4 fois plus grandes**, position qui suit la mise en page |
| 1 événement toutes les 1 à 2,5 s, rien sur le visage avant 5 s, aucune carte avant 8 s | **1 événement toutes les ≈ 0,4 s**, **objet au-dessus de la tête dès 0,0 s**, carte haute dès ≈ 0,7 s |
| 24 éléments | **38 éléments** en 5 lots, dont les 14 gardés par Will |

### 0.4 Règles fixes [WILL]

1. **Aucun zoom, aucun recadrage, aucun changement d'échelle de la prise.** La seule chose permise : la **translation verticale** de la prise (descente sous une carte ou une étiquette, puis remontée, avec léger rebond).
2. **Visage entier ou entièrement couvert.** Tolérance unique : visage à moitié caché **≤ 3 images** quand une grande fenêtre glisse.
3. **Visage visible au début** : rien ne couvre le visage avant **5,0 s**. Les objets au-dessus de la tête et les cartes hautes (prise descendue, visage visible) sont permis dès 0,0 s.
4. **Aucune musique.** Bruitages oui.
5. **Sous-titres jamais sur les yeux.**
6. **Chaque animation représente littéralement ce qui est dit.** Aucun chiffre ni mot affiché que Will n'a pas dit (les valeurs intermédiaires d'un compteur qui défile sont permises).
7. **Pas de faux visages générés présentés comme de vraies personnes** (DGCCRF) : vraies personnes avec leur accord, ou pictogrammes.
8. Jamais « Villeexemple ». Jamais « aucun gain garanti ». Pas d'avis clients affichés (les avis sont éteints sur le site).
9. Chaque `.tsx` commence par `import React from "react";`. La signature du composant `Icone` existant ne change pas.
10. Aucun rendu sur le PC de Will : rendus **dans le cloud** uniquement.

### 0.5 La prise de Will (géométrie, image commune) [MESURÉ sur `prise-commune-1080x1920.png`]

- Plan buste, regard caméra, lunettes noires, **sweat bleu roi** (≈ #0D3C75 à #145297), **mur gris-bleu froid** (≈ #A5ACB0 à #B6BCC5), plante verte à gauche vers 0,42-0,46 H, bureau gris en bas.
- Haut des cheveux **0,14 H**, yeux **0,31 H**, bouche 0,42 H, menton **0,49 H**. Visage de x 0,27 à 0,76 L.
- **Zone interdite Z** (visage + cheveux + marge) : **x 0,25 → 0,75 L, y 0,12 → 0,58 H**, translatée de la descente `D` en cours (y 0,12 + D → 0,58 + D).
- **Bande des yeux** (interdite aux sous-titres) : y (0,27 + D) → (0,36 + D).

---

## A. Palettes (Will choisit sur extrait : A ou B)

### A.1 Couleurs de base (communes aux deux palettes)

| Jeton | Hex | Rôle |
|---|---|---|
| `ENCRE` | **#110A05** | Contours, ombres dures, texte posé sur un accent, plaques « interjection », pastilles « n/N ». Encre chaude de la marque (gardée à la place du bleu nuit #00102A des références : même contraste, 12,5 contre 12,1:1 sur le turquoise). |
| `IVOIRE` | **#E9DCC8** | Ivoire de la marque : **bande du haut** quand la prise descend, **panneau de fin**, fond des plaques secondaires. |
| `IVOIRE_CLAIR` | **#FBF7EF** | **Corps des cartes**, fenêtres de navigateur, champs (ivoire éclairci « écran », proche du crème #FAF7EF des références). |
| `BLANC` | **#FFFFFF** | Mots déjà dits des sous-titres, tuiles de logo, champs de saisie. |
| `GRIS` | **#9A948C** | État « éteint » : ce qui ne marche pas, case vide, logo désactivé (texte ENCRE dessus : 6,5:1). |
| `ORANGE_MARQUE` | **#B44F29** | **Texte** orange sur fond clair (4,8:1 sur IVOIRE_CLAIR), filets fins. **Jamais en plaque** (trop sombre, 3,8:1). |
| `TURQUOISE_TEXTE` | **#0A6E74** | **Texte** turquoise sur fond clair (5,6:1 sur IVOIRE_CLAIR). Jamais en plaque. |

### A.2 Les deux accents

| Jeton | Hex | Lumin. | Encre dessus | Sur sweat bleu | Sur mur gris |
|---|---|---|---|---|---|
| `TURQUOISE` | **#5CE1E6** (le cyan mesuré des références) | 0,62 | **12,5:1** | 5,0 à 7,0:1 | 1,2 à 1,5:1 |
| `ORANGE_VIF` | **#F07C3E** (repli si Will le trouve trop vif : **#E8743F**, 6,6:1) | 0,33 | **7,2:1** | 2,9 à 4,0:1 | 1,2 à 1,4:1 |

**Conséquence [MESURÉ]** : sur le mur gris de Will, **aucun** des deux accents ne se détache par la lumière seule (≤ 1,5:1). Chez le créateur de référence, le cyan ressortait parce que son mur est beige chaud (teinte opposée). Chez Will, c'est **le contour encre et l'ombre dure qui détachent l'objet du mur**. Ils sont donc **obligatoires sur toute surface d'accent posée sur la prise** (éliminatoire H.1-E7). Le turquoise est de la même famille froide que le mur, l'orange est la couleur opposée au sweat et au mur : **je m'attends à ce que B « claque » davantage chez Will, et A ressemble davantage aux références** [SUPPOSÉ, à trancher sur extrait].

### A.3 Qui va où

| Usage | Palette **A « turquoise »** | Palette **B « orange vif »** |
|---|---|---|
| `ACCENT_1` (principal) | TURQUOISE | ORANGE_VIF |
| `ACCENT_2` (second) | ORANGE_VIF | TURQUOISE |
| Part de l'ACCENT_2 dans les surfaces d'accent | ≤ 25 % | ≤ 15 % (« touches ») |
| Sous-titre : mot déjà dit | BLANC, contour ENCRE | idem |
| Sous-titre : mot en cours | Texte ACCENT_1, contour ENCRE | idem |
| Sous-titre : mot fort | Plaque ACCENT_1, texte ENCRE | idem |
| Sous-titre : **chiffre ou montant** dit | Plaque **ACCENT_2**, texte ENCRE | idem |
| Étiquette au-dessus de la tête (standard) | Plaque ACCENT_1 **ou** BLANC (alterner), texte ENCRE | idem |
| Sur-étiquette (petit titre posé sur une étiquette) | Plaque ENCRE, texte BLANC | idem |
| Interjection de chapitre (« REGARDEZ. ») et moments forts | Plaque ENCRE, texte ACCENT_1 | idem |
| En-tête de carte | Bandeau ACCENT_1, titre ENCRE | idem |
| Corps de carte | IVOIRE_CLAIR, texte ENCRE | idem |
| Ligne active / surlignage dans une carte | Fond ACCENT_1 à 100 % sur la ligne (texte ENCRE) pendant 12 i, puis ACCENT_1 en **filet gauche** de 8 px | idem |
| Coches, cases cochées, puces de statut « fait » | ACCENT_1 + coche ENCRE | idem |
| Puce qui déborde de la carte (« ↗ A EXPLOSÉ ») | Plaque ACCENT_2, texte ENCRE | idem |
| Compteur (chiffre) | Texte ENCRE sur plaque ACCENT_2 (ou ENCRE sur BLANC dans une carte) | idem |
| Barres de graphique, jauges | ACCENT_1 ; la barre « gagnante » ou citée en ACCENT_2 | idem |
| Barre de progression du haut | Rempli ACCENT_1, reste ENCRE | idem |
| Pastille d'étape active / flèche ronde du CTA | ACCENT_1 / ACCENT_2 | idem |
| Contours, ombres | ENCRE, toujours | idem |
| Barré (« 2 000 € » barré, pictos barrés) | Trait ACCENT_2 de 12 px + contour ENCRE 3 px | Trait ENCRE de 12 px |

**Interdits** : toute autre teinte hors palette (sauf **à l'intérieur** d'une vraie vidéo, d'une vraie capture ou d'un vrai logo tiers), tout dégradé, toute transparence de surface (une surface est opaque à 100 % ; seule l'**opacité d'animation** d'entrée ou de sortie varie, et jamais plus de 2 images).

---

## B. Grammaire visuelle

### B.1 Jetons (à recopier tels quels dans `motion-v4/socle/jetons.ts`)

```ts
export const COULEURS = {
  ENCRE: "#110A05", IVOIRE: "#E9DCC8", IVOIRE_CLAIR: "#FBF7EF", BLANC: "#FFFFFF",
  GRIS: "#9A948C", ORANGE_MARQUE: "#B44F29", TURQUOISE_TEXTE: "#0A6E74",
  TURQUOISE: "#5CE1E6", ORANGE_VIF: "#F07C3E",
} as const;
export type Palette = "A" | "B";
export const accents = (p: Palette) => p === "A"
  ? { ACCENT_1: COULEURS.TURQUOISE, ACCENT_2: COULEURS.ORANGE_VIF }
  : { ACCENT_1: COULEURS.ORANGE_VIF, ACCENT_2: COULEURS.TURQUOISE };
export const TRAIT = { FORT: 7, MOYEN: 5, FIN: 3 };            // px à 1080
export const OMBRE = { S: [5, 6], M: [8, 9], L: [11, 12] };     // décalage x, y en px, flou 0
export const RAYON = { PLAQUE: 10, CHAMP: 12, TUILE: 14, CARTE: 18, FENETRE: 22, PILULE: 999 };
export const DESCENTE = { D0: 0, D1: 0.06, D2: 0.26, D3: 0.32 }; // fraction de H
```

Toute palette est passée en propriété `palette: "A" | "B"` à chaque élément.

### B.2 Contours

| Objet | Contour ENCRE |
|---|---|
| Cartes, fenêtres vidéo, téléphone, panneau de fin | **7 px** (`TRAIT.FORT`) |
| Étiquettes, plaques de sous-titre, badges, puces, tuiles, pastilles | **5 px** (`TRAIT.MOYEN`) |
| Éléments internes d'une carte (champs, cases, vignettes, barres) | **3 px** (`TRAIT.FIN`) |
| Texte des sous-titres et des mots géants | Contour de texte : `paint-order: stroke fill` + `WebkitTextStroke` de **0,14 em** (donc ≈ 0,07 em visible à l'extérieur, ≈ 6 px à 84 px de corps) |

Le contour est **intérieur au rectangle** (`box-sizing: border-box` + `border`) pour que les cotes du document soient les cotes extérieures.

### B.3 Ombres

- **Ombre dure, sans aucun flou**, couleur ENCRE à 100 %, décalée **vers le bas et la droite** (une seule direction de lumière, partout).
- `box-shadow: Xpx Ypx 0 0 #110A05` pour les boîtes ; `filter: drop-shadow(Xpx Ypx 0 #110A05)` pour le texte libre et les formes non rectangulaires.
- Tailles : **S (5, 6)** sur étiquettes, puces, plaques de sous-titre ; **M (8, 9)** sur cartes et badges ; **L (11, 12)** sur fenêtres vidéo, téléphone et mots géants.
- Un objet **posé sur** un autre (puce qui déborde d'une carte) a sa propre ombre S : la superposition fait la profondeur, pas le flou.
- **Interdits** : flou d'ombre, ombre colorée, ombre intérieure, lueur, `backdrop-filter`, `filter: blur()`.

### B.4 Rayons et inclinaisons

- Rayons : plaques et étiquettes **10 px**, champs 12, tuiles 14, **cartes 18**, **fenêtres 22**, pastilles et pilules complètement rondes.
- Inclinaisons au repos : **étiquettes -4° à +3°** (alterner le signe d'une étiquette à la suivante), plaques de mot fort -2° / +1,5° alternés, puces qui débordent -6° à +6°, **cartes 0°** (elles arrivent inclinées puis se redressent), fenêtres ±2°.

### B.5 Typographie

Chargement (paquet `@remotion/google-fonts`, à la **même version exacte** que le paquet `remotion` du projet s'il n'est pas déjà installé) :

```ts
import { loadFont as chargerMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as chargerInter } from "@remotion/google-fonts/Inter";
export const { fontFamily: MONTSERRAT } = chargerMontserrat("normal", { weights: ["800", "900"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: INTER } = chargerInter("normal", { weights: ["600", "700", "800"], subsets: ["latin", "latin-ext"] });
```

| Usage | Police | Corps (px à 1080) | Casse, interlettrage |
|---|---|---|---|
| Sous-titres | Montserrat **900** | **84** (min 62, max 96) | Capitales, 0,01 em |
| Étiquette au-dessus de la tête | Montserrat 900 | **60-72** | Capitales, 0,01 em, ponctuation gardée (« REGARDEZ. ») |
| Sur-étiquette | Montserrat 800 | 36-40 | Capitales, 0,03 em |
| Mot géant (coups de poing) | Montserrat 900 | 220-420 | Capitales, -0,01 em |
| Titre d'en-tête de carte | Montserrat 900 | **38** | Capitales, 0,04 em |
| Pastille « n/N », « #n » | Montserrat 800 | 30 | Capitales |
| Texte porteur dans une carte (ce qui est dit) | Inter **700** | **36** (min 32) | Phrase normale |
| Texte secondaire porteur | Inter 600 | 32 | Phrase normale |
| Texte de décor (adresse de site, horodatage, « Tapez une commande… ») | Inter 600 | 24-28 | Jamais essentiel |
| Chiffres de compteur | Montserrat 900, `fontVariantNumeric: "tabular-nums"` | 72-140 | — |

- **Minimums absolus** : texte porteur **≥ 32 px**, texte de décor **≥ 24 px**. Rien en dessous.
- Accents des capitales obligatoires (É, È, À, Ç, Û : « DÛ », « ÉTAPE »). Vérifier sur extrait.
- Pas de minuscules dans les étiquettes et sous-titres.

### B.6 Icônes et logos

- Icônes du composant `Icone` existant : taille **≥ 44 px**, trait ENCRE, remplissage ACCENT_1 ou BLANC. Dans une pastille ronde ACCENT_1 de 64 à 88 px à contour 5 px.
- **Vrais logos** d'outils (Claude, LinkedIn, Gmail…) : toujours dans une **tuile BLANC** à contour 5 px et ombre S, rayon 14, logo à 70 % de la tuile. Ce sont les seules couleurs hors palette permises hors vidéo.
- **Personnes** : pictogramme (silhouette ENCRE sur pastille ACCENT_1) ou **initiales** (Montserrat 900 ENCRE sur pastille ACCENT_1). Vraie photo **uniquement** de Will ou d'une personne réelle ayant donné son accord, fournie par Will. Jamais de visage généré.

### B.7 Primitives communes (chaque lot code les siennes à l'identique de cette fiche ; l'intégration les fusionnera)

| Primitive | Description exacte |
|---|---|
| `Plaque` | Rectangle à rayon 10, contour 5, ombre S, padding 0,16 em (vertical) × 0,30 em (horizontal), texte Montserrat 900 capitales. Props : `fond`, `texte`, `inclinaison`, `corps`. |
| `SurEtiquette` | `Plaque` ENCRE / texte BLANC, corps 38, posée à cheval sur le **bord haut-gauche** de l'étiquette principale (débord vers le haut de 55 % de sa hauteur, décalage x +0,04 L), inclinaison principale -1,5°. |
| `Puce` | Pilule ronde, contour 5, ombre S, corps 34-40, icône optionnelle à gauche (44 px). |
| `CoqueCarte` | Carte : largeur **0,86 L** (928 px), hauteur 0,26 à 0,40 H, rayon 18, contour 7, ombre M. **En-tête** : hauteur 0,055 H (106 px), ACCENT_1, filet bas ENCRE 5 px, titre à gauche (38 px), pastille « n/N » ou étiquette ENCRE/BLANC à droite. **Corps** : IVOIRE_CLAIR, marge intérieure 0,035 L. **L'en-tête ne défile jamais** avec le contenu. |
| `CoqueFenetre` | Fenêtre vidéo : rayon 22, contour 7, ombre L, vidéo en `objectFit: "cover"` **sans échelle ni zoom**. Barre de titre facultative (navigateur : 3 pastilles ENCRE/ACCENT_1/ACCENT_2 de 22 px, barre d'adresse BLANC). |
| `DescentePrise` | Translation verticale de la prise (seule transformation permise sur la prise), révèle la bande IVOIRE au-dessus (§ D.4). |
| `BarreProgression` | Barre tout en haut, y 0 → **10 px**, pleine largeur : fond ENCRE, rempli ACCENT_1 proportionnel au temps écoulé, petit trait vertical BLANC de 4 px au bout du rempli. Toujours visible, au-dessus de tout sauf du panneau de fin. |
| `SousTitresV4` | § C. |

---

## C. Sous-titres

### C.1 Format

- **Montserrat 900, capitales, corps 84 px** (≈ 0,078 L ; capitales ≈ 0,055 L, soit ≈ 1,3-1,4 fois la v3) [MESURÉ sur les références : 0,075-0,08 L de corps].
- **1 à 2 mots** par groupe. 3 seulement si le 3ᵉ fait ≤ 3 lettres (« DE », « ET », « LA »). Les mots de liaison ne sont jamais seuls.
- Largeur maximale du groupe **0,88 L** ; s'il dépasse, le corps descend jusqu'à **62 px**, puis le groupe se coupe.
- Une seule ligne. Hauteur de ligne 1,0. Centré horizontalement (sauf gabarit M8, § E).
- Pas de bandeau ni de fond : posé sur la prise (le sweat bleu fait un fond sombre naturel : BLANC sur sweat = 7,8 à 10,9:1).

### C.2 Les trois états (plus un)

| État | Rendu |
|---|---|
| **Dit** | Texte BLANC, contour de texte ENCRE 0,14 em (`paint-order: stroke fill`), ombre `drop-shadow(4px 5px 0 #110A05)`. |
| **En cours** (le mot qui se prononce) | Texte **ACCENT_1**, même contour et même ombre. |
| **Mot fort** (≈ 1 mot sur 3, noms, verbes d'action, mots-clés du script) | **Plaque ACCENT_1**, texte ENCRE, contour plaque 5 px, ombre S, rayon 10, padding 0,10 em × 0,24 em, inclinaison alternée -2° / +1,5°. Reste en plaque tant que le groupe est affiché. |
| **Chiffre / montant dit** | Comme le mot fort mais **plaque ACCENT_2**. |

### C.3 Position (suit la mise en page)

| Gabarit (§ E) | Centre vertical du groupe |
|---|---|
| Prise seule ou M1 (D = 0 ou 0,06 H) | **0,66 H + D** (sur le sweat, sous le menton) |
| M2 carte (D2 = 0,26 H) | **0,375 H** : collé sous la carte (bord bas de carte + 0,045 H), sur les cheveux, au-dessus des yeux (yeux à 0,57 H) |
| M3 grande carte (D3 = 0,32 H) | **0,445 H** |
| M4 fenêtre sur le visage | **0,72 H** (sous la fenêtre) |
| M5 plein cadre | 0,82 H, ou masqué si le mot géant est le même mot |
| M6 épaule, M7 bas | **0,075 H** (bascule en haut, au-dessus des cheveux) |
| M8 tête + épaule | 0,68 H, groupe aligné à gauche dans x 0,04 → 0,52 L |

**Contrôle** : la boîte du groupe ne touche jamais la bande des yeux (y 0,27 + D → 0,36 + D) ni un objet posé. Changement de position : **coupe sèche** au changement de groupe, jamais de glissement.

### C.4 Animation au mot

- Chaque mot apparaît à son début exact : **échelle 0,5 → 1 en 4 i** avec le ressort `POP` (§ D.1), opacité 0 → 1 en 1 i, origine au centre du mot. Pas de fondu, pas de flou.
- La plaque d'un mot fort : **la plaque s'étire** de scaleX 0 → 1 depuis la gauche en 3 i (`GLISSE`), le texte fait son pop 1 i après.
- Le passage « en cours → dit » est instantané (au début du mot suivant).
- Remplacement du groupe : **coupe sèche** (0 image de transition).
- ≈ 3 changements de sous-titre par seconde (débit naturel de 3,3 à 5 mots/s).

---

## D. Mouvements

### D.1 Ressorts nommés (`spring({ frame, fps: 30, config })`)

Valeurs calculées (oscillateur amorti) ; **à vérifier avec `measureSpring`** sur extrait.

| Nom | damping | stiffness | mass | Dépassement | Pic atteint | Usage |
|---|---|---|---|---|---|---|
| `POP` | 14 | 300 | 0,6 | ≈ 15 % | ≈ 5 i | Étiquettes, mots, puces, pastilles (échelle 0,3 → 1) |
| `CHUTE` | 18 | 320 | 0,8 | ≈ 12 % | ≈ 6 i | Cartes qui tombent du haut, panneaux |
| `CLAQUE` | 20 | 500 | 0,5 | ≈ 8 % | ≈ 4 i | Impacts, mots géants, coches, chiffre qui se pose |
| `DESCENTE` | 20 | 300 | 0,7 | ≈ 5 % | ≈ 6 i | Descente et remontée de la prise (léger rebond) |
| `GLISSE` | 28 | 400 | 0,6 | ≈ 0 % | ≈ 7 i | Glissements latéraux, étirements de plaque, barres |

### D.2 Entrées (≤ 6 images jusqu'au pic) et sorties (3 à 5 images)

| Code | Entrée | Recette |
|---|---|---|
| **E-POP** | Pop sur place | Échelle 0,3 → 1 (`POP`), rotation de (inclinaison finale - 6°) → inclinaison finale, opacité 0 → 1 en 2 i. |
| **E-CHUTE** | Chute du haut | translateY -0,40 H → 0 (`CHUTE`), rotateZ -5° → 0 au même rythme. Synchronisée avec la descente de la prise. |
| **E-COTE** | Arrivée latérale | translateX ±1,0 L → 0 (`GLISSE` ou `CHUTE`), rotateZ ±6° → ±2°. |
| **E-BAS** | Montée du bas | translateY +0,6 H → 0 (`CHUTE`), rotateZ +4° → +2°. |
| **E-ETIRE** | Étirement | scaleX 0 → 1 depuis un bord (`GLISSE`), le contenu pop 2 i plus tard. |
| **E-COUPE** | Coupe franche | Apparaît en 1 image, posé. Réservé aux fenêtres vidéo plein visage (max 1 sur 3). |

| Code | Sortie | Recette |
|---|---|---|
| **S-REMONTE** | Carte qui remonte | translateY 0 → -0,45 H en **3 i**, `Easing.in(Easing.cubic)`. La prise remonte ensuite en 4 i. |
| **S-RETRECIT** | Rétrécissement | Échelle 1 → 0 en **2-3 i**, `Easing.in(Easing.back(1.6))`. Étiquettes, badges, puces. |
| **S-COTE** | Glissement sec | translateX 0 → ∓1,1 L en **4 i**, `Easing.in(Easing.cubic)`, sans rotation. Fenêtres. |
| **S-BAS** | Retombée | translateY 0 → +0,7 H en 4 i. |

Règles :
- **Tout ce qui sort part plus vite que ce qui entre.**
- **Aucun reste** : à l'image qui suit la fin de la sortie, aucun pixel de l'élément (ni plaque, ni icône, ni ombre).
- **Enchaînement sans temps mort** : l'élément suivant commence son entrée **dans l'image même** où le précédent finit sa sortie (échange complet de deux cartes ≈ 0,4 s = 3 i de sortie + 1 i de bande + 6-8 i d'entrée).
- **Interdits** : fondu de plus de 2 i, flou, perspective, `rotateX/rotateY`, échelle de la prise.

### D.3 Construction du contenu (ce qui fait « vivre » un objet posé)

**Règle** : un objet posé change **toutes les 0,25 à 0,75 s** (8 à 22 i). Jamais plus de **0,75 s** sans changement visible. Chaque changement est calé sur **le mot dit** à ±3 i.

| Geste | Recette exacte |
|---|---|
| **Ligne qui s'ajoute** | Hauteur 0 → h en 3 i (`GLISSE`), les lignes dessous se décalent ; texte qui pop (`POP` à 60 % d'amplitude) 1 i après ; **fond ACCENT_1 sur la nouvelle ligne pendant 12 i**, puis filet gauche ACCENT_1 de 8 px. |
| **Texte tapé** | 2 caractères par image (ou réparti pour finir sur la fin du mot dit), curseur ENCRE de 4 × 0,9 em qui clignote 15 i allumé / 15 i éteint, son `click` toutes les 3 lettres. |
| **Menu d'autocomplétion** | Liste BLANC contour 3 sous le champ, 3-4 lignes, la ligne qui correspond se colore ACCENT_1 en 2 i, puis le menu se replie en 3 i (scaleY → 0). |
| **Envoi** | Le bouton (rond ACCENT_1 à flèche ENCRE) fait `CLAQUE` 1 → 0,85 → 1, le texte du champ part dans une bulle en 4 i. |
| **Coche** | Case 52 px BLANC contour 3 → remplissage ACCENT_1 en 2 i, puis la coche ENCRE (trait 8 px) se trace en 4 i (`strokeDashoffset`). Cascade : 1 coche toutes les 6 à 10 i, sur le mot. |
| **Compteur** | Défile de la valeur de départ à la valeur **dite** en **10 à 15 i**, `Easing.out(Easing.cubic)`, chiffres `tabular-nums`, puis `CLAQUE` de 1,12 → 1 sur la valeur finale. Son `tick` au plus toutes les 2 i, `ding` à l'arrivée seulement si c'est une réussite. |
| **Barre qui monte** | Hauteur 0 → h en 8 i (`GLISSE`), cascade de 3 i entre barres, valeur pop au sommet à la fin. |
| **Recoloration** | GRIS → ACCENT_1 (ou l'inverse : « ne marche pas ») en 3 i, interpolation de couleur directe (pas de fondu). |
| **Grisé / barré** | Trait de 12 px tracé de gauche à droite en 5 i, à -8°, puis l'objet passe GRIS en 3 i. |
| **Cascade** | 1 élément toutes les **2 i** (logos, carrés numérotés, pictos), chacun en `POP`. |
| **Changement de titre sans sortie** | La carte reste, son titre change : ancien texte translateY -100 % en 3 i, nouveau texte de +100 % à 0 en 4 i (effet « compteur à rouleau »). |
| **Puce qui déborde** | Puce ACCENT_2 qui pop à cheval sur un bord de carte (débord ≥ 40 % de sa largeur), inclinée ±6°. |

### D.4 Descente et remontée de la prise

- Seule transformation permise de la prise : `translateY(D × 1920 px)`. Jamais d'échelle.
- Valeurs : **D1 = 0,06 H** (115 px, objet au-dessus de la tête), **D2 = 0,26 H** (499 px, carte), **D3 = 0,32 H** (614 px, grande carte).
- **Descente** : en même temps que l'entrée de l'objet, ressort `DESCENTE` (≈ 5 % de rebond, pic en ≈ 6 i).
- **Remontée** : commence **1 image après** la fin de la sortie de l'objet ; 4 i, `Easing.out(Easing.back(1.3))` (≈ 3 % de rebond).
- Passer d'une profondeur à une autre (D1 → D2) se fait directement, sans repasser par 0.
- Si deux objets « tête » se suivent, la prise **reste** à D1 entre les deux (pas de yo-yo).
- La bande révélée en haut est **IVOIRE** (#E9DCC8), sans ombre ni filet. Elle reste visible **1 image** après la sortie d'une carte, puis la prise remonte.
- Astuce : quand une fenêtre couvre entièrement le visage (M4, M5), la prise peut changer de D **sous la fenêtre** (invisible).

---

## E. Mises en page (gabarits)

Coordonnées en fraction de L et H, à l'état posé, D comprise. Toute surface posée sur la prise visible fait **≥ 8 %** de l'image ; une sur trois dépasse **15 %**.

| Code | Nom | Prise | Zone de l'objet | Sous-titres | Visage |
|---|---|---|---|---|---|
| **M0** | Prise seule | D0 | — | 0,66 H | entier (≤ 0,5 s) |
| **M1** | **Objet au-dessus de la tête** | **D1 = 0,06 H** (cheveux à 0,20 H) | x 0,10 → 0,90, **y 0,02 → 0,185 H** ; centré ou décalé de ±0,08 L | 0,72 H | entier |
| **M2** | **Carte haute** | **D2 = 0,26 H** (cheveux à 0,40 H, yeux à 0,57 H) | x 0,07 → 0,93, y 0,035 → **0,33 H** | 0,375 H | entier |
| **M3** | Grande carte | **D3 = 0,32 H** (cheveux à 0,46 H, yeux à 0,63 H) | x 0,07 → 0,93, y 0,035 → **0,40 H** | 0,445 H | entier |
| **M4** | Fenêtre sur le visage | D0 (ou D quelconque, la fenêtre couvre) | **x 0,06 → 0,94, y 0,09 → 0,63 H** (couvre Z) | 0,72 H | couvert (≥ 5 s) |
| **M5** | Plein cadre | — | 0 → 1 | 0,82 H ou aucun | couvert (≥ 8 s) |
| **M6** | Épaule | D0 | gauche **x 0,03 → 0,47** ou droite **x 0,53 → 0,97**, **y 0,57 → 0,86 H** | 0,075 H | entier |
| **M7** | Bas | D0 | x 0,04 → 0,96, y 0,60 → 0,90 H | 0,075 H | entier |
| **M8** | Tête + épaule | D1 | M1 + un 2ᵉ objet en M6 côté droit (y 0,62 → 0,88 H) | 0,68 H, à gauche (x 0,04 → 0,52) | entier |
| **M9** | Panneau de fin | panneau IVOIRE qui monte du bas en 5 i et pousse la prise vers le bas | plein cadre | aucun | couvert |

**Répartition cible du temps** (sur une vidéo de 60-90 s) [MESURÉ sur les références, adapté] :
- **M2 + M3 (cartes) : 40-50 %** ;
- **M1 + M8 (au-dessus de la tête) : 30-38 %** ;
- **M4 + M5 (visage couvert) : 12-18 %**, jamais avant 5 s (M4) / 8 s (M5) ;
- **M6 + M7 : 5-10 %** ;
- **M0 : ≤ 3 %**, par tranches de **0,5 s au plus** ;
- M9 : ≈ 1-2 s à la fin.

**Alternance** : changement de gabarit toutes les **2 à 3,5 s** en moyenne ; jamais plus de **5,5 s** dans le même gabarit ; deux cartes peuvent s'enchaîner en M2 (échange en 0,4 s) au plus 2 fois de suite.

---

## F. Catalogue : 38 plaquettes et animations, 5 lots

**Lecture des fiches** : *Montre* · *Quand* (exemple de phrase de Will) · *Gabarit* · *Déroulé* (en images à partir de i0 ; « mot n » = le n-ième mot déclencheur) · *Durée* · *Son* · *Palette* (ce qui change entre A et B, si autre chose que ACCENT_1/ACCENT_2). Les sons sont ceux du dossier `sons/` du studio (familles `click`, `drop`, `ding`, `eclats`, `maximize`, `minimize`, `select`, `tick`, `vibreur`, `whoosh-in`, `whoosh-out`, `confirmation`) ; « (à sourcer) » = à chercher en **CC0** (Kenney ou équivalent), jamais en banque payante. ★ = l'un des 14 éléments gardés par Will.

### Lot 1 « Au-dessus de la tête » (designer 1) : 8 éléments + `Plaque`, `SurEtiquette`, `Puce`, `SousTitresV4`

**1. `EtiquetteTete`** — l'objet de base.
- *Montre* : 1 plaque (1-5 mots dits), éventuellement coiffée d'une `SurEtiquette`. Ex. « SANS ME VANTER… », « CLAUDE M'A CRÉÉ / UNE ÉQUIPE D'AGENTS IA ».
- *Quand* : promesse d'ouverture, thème d'une phrase. « Je vais vous montrer comment relancer vos devis. »
- *Gabarit* : M1, largeur 0,40-0,72 L, inclinaison -4° à +3°.
- *Déroulé* : i0 E-POP de la plaque + DESCENTE D1 ; i4 sur-étiquette en E-POP ; si 2 lignes, la 2ᵉ en E-ETIRE au mot 2 ; changement de texte en place (rouleau, § D.3) si la phrase continue ; sortie S-RETRECIT 3 i.
- *Durée* : 0,7-1,5 s. *Son* : `select` discret (-24 dB) ou aucun.
- *Palette* : alterner fond ACCENT_1 / BLANC d'une étiquette à l'autre.

**2. `Interjection`** — étiquette de chapitre.
- *Montre* : 1-3 mots + point final : « REGARDEZ. », « ATTENTION. », « ET PLUS LOIN. », « TOUT SEULS. ».
- *Quand* : mots charnières. « Maintenant, regardez. » / « Mais attention. »
- *Gabarit* : M1, plaque **ENCRE**, texte **ACCENT_1**, corps 72, largeur 0,45-0,65 L, inclinaison -3°.
- *Déroulé* : i0 E-POP (`CLAQUE`, échelle 0,3 → 1) ; i6 secousse de ±0,006 L sur 4 i ; sortie S-RETRECIT 2 i.
- *Durée* : 0,7-1,1 s. *Son* : `drop` court.

**3. `BadgeCompteur`** — étiquette + compteur + logos.
- *Montre* : titre (« ABONNÉS SUR MES RÉSEAUX ») + rangée de 1-4 tuiles logo à gauche + compteur sur plaque ACCENT_2 à droite.
- *Quand* : un chiffre dit en ouverture. « J'ai envoyé 1 200 relances ce mois-ci. »
- *Gabarit* : M1, 0,72 L × 0,13 H.
- *Déroulé* : i0 plaque-titre E-ETIRE ; i3-i9 tuiles en cascade (2 i) ; i6 compteur qui défile jusqu'à la valeur dite (12 i) + `CLAQUE` ; s'il y a un 2ᵉ chiffre dit, nouveau défilement (même montant ou en descente) ; **inversion** possible sur le mot de rupture (« zéro ») : la plaque passe ENCRE, les logos passent GRIS en 3 i.
- *Durée* : 1,2-3 s. *Son* : `tick` pendant le défilement, `ding` à l'arrivée.

**4. `BadgeProfil`** — carte de personne (pictogramme, jamais faux visage).
- *Montre* : pastille ronde 120 px (pictogramme ou initiales sur ACCENT_1, ou vraie photo fournie par Will) + prénom ou rôle (Montserrat 900, 48) + puce métier (ACCENT_1, 34) + mini-titre « AGENT 3/12 » (Inter 700, 26, décor) ; point vert remplacé par un point ACCENT_2.
- *Quand* : Will présente un rôle, un agent, un client type. « Mon agent de relance s'occupe des devis. »
- *Gabarit* : M1, 0,48 × 0,10 H, centré au-dessus de la tête.
- *Déroulé* : i0 E-COTE depuis la gauche (`GLISSE`) ; i5 pastille `POP` ; i8 nom ; i8 + 0,25 s puce métier E-ETIRE ; badges successifs : le suivant entre dans l'image où le précédent sort (S-RETRECIT 3 i) ; variante « avant/après » : silhouette GRIS « BASIQUE » → ACCENT_1 « EXPERT » + 5 étoiles qui se remplissent.
- *Durée* : ≈ 1 s par badge (série de 2 à 6). *Son* : `select` à chaque badge.

**5. `LogoOutil`** — l'outil nommé et son rôle.
- *Montre* : tuile BLANC 180 px avec le vrai logo + nom sous la tuile (Montserrat 900, 36) + étiquette de rôle ACCENT_1 à droite avec icône (« LE RÉDACTEUR »).
- *Quand* : « Le premier outil, c'est Claude, notre rédacteur. »
- *Gabarit* : M1 ou M8 (tuile à gauche, x 0,10-0,30 ; rôle x 0,34-0,86).
- *Déroulé* : i0 tuile `POP` depuis un point (0,1 → 1) ; mot « rédacteur » : rôle E-ETIRE ; les deux sortent ensemble en S-RETRECIT 3 i juste avant la carte suivante.
- *Durée* : 1-2 s. *Son* : `select`.

**6. `RangeePastilles`** — cascade de petits objets numérotés ou de logos.
- *Montre* : 3 à 8 pastilles carrées (88 px, rayon 14) : chiffres 1…6, logos, pictos ; titre court au-dessus (« LES 6 ÉTAPES »).
- *Quand* : annonce d'une liste. « Voici les 6 étapes. » / « Sur LinkedIn, Facebook et Instagram. »
- *Gabarit* : M1, largeur ≤ 0,86 L.
- *Déroulé* : i0 titre E-POP ; i4 pastilles en cascade de 2 i (BLANC, chiffre ENCRE) ; sur « la première », la pastille 1 passe ACCENT_1 (recoloration 3 i) ; sortie : cascade inverse de rétrécissement 1 i par pastille.
- *Durée* : 1-2,5 s. *Son* : `tick` à chaque pastille (volume -26 dB).

**7. `Equation`** — empilement construit au mot.
- *Montre* : « SCRIPT VIRAL » + « MON POINT DE VUE » = « QUI MARCHE », chaque terme sur sa plaque, les signes (+, =) dans des pastilles rondes ENCRE à texte ACCENT_1.
- *Quand* : Will additionne deux idées. « Votre savoir-faire, plus l'IA, égale du temps gagné. »
- *Gabarit* : M1 (empilé verticalement y 0,02 → 0,185 H, 2-3 lignes de 60 px) ou M3 si 3 termes longs.
- *Déroulé* : terme 1 E-POP au mot ; « + » `CLAQUE` au mot « plus » ; terme 2 E-ETIRE ; « = » ; résultat sur plaque **ACCENT_2** en `CLAQUE` + secousse ; sortie de bas en haut, 1 i par ligne.
- *Durée* : 1,5-3 s. *Son* : `click` sur les signes, `ding` sur le résultat.

**8. ★ `MotSaute`** (re-habillé)
- *Montre* : le mot fort quitte le sous-titre et va se poser au-dessus de la tête, sur une plaque ACCENT_1 de **0,42 L**.
- *Quand* : le mot-clé d'une phrase. « Tout ça, c'est du TEMPS. »
- *Gabarit* : départ du sous-titre (M0/M1), arrivée M1 en (0,70 L ; 0,10 H) à -6°.
- *Déroulé* : i0 la plaque du mot fort se détache du sous-titre ; i0-i8 arc parabolique passant **à droite de Z** (jamais dedans), échelle 1 → 1,6 ; i8 `CLAQUE` à l'arrivée + 2 traits d'impact ENCRE (12 px, 0,05 L) qui jaillissent en 4 i ; changement de contenu à +0,5 s (sur-étiquette qui pop) ; sortie S-RETRECIT 3 i.
- *Durée* : 1-1,8 s. *Son* : `select` au départ + `drop` à l'arrivée.

### Lot 2 « Cartes qui se construisent » (designer 2) : 8 éléments + `CoqueCarte`, `DescentePrise`

Toutes en M2 (ou M3), entrée **E-CHUTE + DESCENTE D2** (son `whoosh-in` à chaque entrée de carte), sortie **S-REMONTE 3 i** puis remontée de la prise. Contenu qui change toutes les 0,25-0,75 s.

**9. ★ `CarteChecklist`** (l'ancienne « carte », re-habillée)
- *Montre* : en-tête (« CE QUI S'AUTOMATISE » + pastille « 1/3 »), 3-5 lignes avec case, cochées une à une.
- *Quand* : « On automatise les relances, les devis et les rendez-vous. »
- *Déroulé* : i0 chute ; chaque mot cité → ligne qui s'ajoute (§ D.3) ; 4-8 i plus tard sa coche ; dernière coche → puce ACCENT_2 « ✓ FAIT » qui déborde en bas à droite ; option « mémoire » : pastille « EN MÉMOIRE » sur l'en-tête.
- *Durée* : 2-5 s. *Son* : `tick` par coche, `ding` sur la dernière.

**10. `CarteCommande`** — motif récurrent (peut revenir 2-3 fois dans une vidéo).
- *Montre* : en-tête « COMMANDE » ; grille de 4 boutons (« /relance », « /devis », « /rdv », « /facture ») ; champ « Tapez une commande… » en bas avec bouton d'envoi.
- *Quand* : « Je tape une seule commande : relance. »
- *Déroulé* : i0 chute, boutons en cascade de 2 i ; « une seule commande » → étiquette BLANC qui déborde sur l'en-tête ; les boutons sortent (rétrécissent 1 i chacun) ; texte tapé dans le champ + menu d'autocomplétion ; « envoie » → envoi, bulle ; réponse (« L'agent relance s'en occupe ») tapée en 2 car/i.
- *Durée* : 2-4 s. *Son* : `click` toutes les 3 lettres, `whoosh-out` à l'envoi.

**11. `CarteCommentaire`** — le parcours du spectateur.
- *Montre* : en-tête « COMMENTAIRES » ; champ ; le mot-clé tapé (« RELANCE ») ; publication ; notification ENCRE « Nouveau message : votre guide » qui glisse sous le commentaire.
- *Quand* : appel à l'action. « Commentez RELANCE et je vous envoie le guide. »
- *Déroulé* : chute ; mot tapé ; publication (le texte monte dans une ligne avec icône personne + cœur ACCENT_2 qui `POP`) ; notification E-COTE depuis la droite en 5 i.
- *Durée* : 2-3 s. *Son* : `click`, puis `confirmation`, puis `vibreur` court.

**12. `CarteStatuts`** — l'équipe au travail.
- *Montre* : 3-4 lignes « pictogramme + rôle + action » (« Agent relance · écrit ») avec puce de statut « EN COURS » (BLANC) → « FAIT » (ACCENT_1 + coche).
- *Quand* : « Le premier trie les demandes, le deuxième écrit, le troisième envoie. »
- *Déroulé* : lignes déjà présentes en GRIS ; chaque rôle dit → sa ligne s'allume (recoloration 3 i + fond ACCENT_1 12 i) et sa puce passe « EN COURS » ; au rôle suivant, la précédente passe « FAIT ».
- *Durée* : 2-4 s. *Son* : `select` par ligne.

**13. `GraphiqueBarres`** — graphique qui monte.
- *Montre* : 3-6 barres ACCENT_1 contour 3, axe ENCRE 5 px, la barre citée en ACCENT_2 avec sa valeur dite, flèche « ↗ » sur une puce qui déborde.
- *Quand* : « Le taux de réponse a doublé. »
- *Déroulé* : axe E-ETIRE 4 i ; barres qui montent en cascade de 3 i ; au mot fort, la dernière barre grandit encore (`CLAQUE`) et passe ACCENT_2 ; puce « ↗ ×2 » `POP` (seulement si « deux fois » est dit) ; variante jauge « NIVEAU » qui se remplit à droite.
- *Durée* : 1,5-3 s. *Son* : `tick` par barre, `ding` final.

**14. `CarteCalendrier`** — la semaine qui se remplit.
- *Montre* : grille LUN → DIM (7 colonnes, en-têtes Inter 800 28), pastilles (icônes ou logos) qui **tombent** dans les cases.
- *Quand* : « Vos rendez-vous se calent tout seuls dans la semaine. »
- *Déroulé* : chute ; 1 pastille toutes les 4-6 i, chute de 0,05 H avec `CLAQUE` ; au mot « tout seuls », 3 pastilles d'un coup ; compteur « 12 RDV » en en-tête s'il est dit.
- *Durée* : 2-3,5 s. *Son* : `drop` léger par pastille (1 sur 2).

**15. `CarteComparaison`** — deux colonnes face à face.
- *Montre* : colonne gauche « À LA MAIN » (GRIS), colonne droite « AVEC L'IA » (ACCENT_1), signe **≠** ou « VS » dans un rond ENCRE au centre ; lignes qui s'empilent (« MOIS 1 », « MOIS 2 »… contre « 1 HEURE »).
- *Quand* : « Une agence met des mois ; vos agents mettent une heure. »
- *Déroulé* : chute ; colonne gauche se construit (lignes de 4 i) ; le rond `CLAQUE` ; colonne droite s'allume d'un coup sur le mot ; ses 3 coches en cascade.
- *Durée* : 2-4 s. *Son* : `drop` sur le rond, `ding` sur la colonne droite.

**16. `FriseEtapes`** — frise verticale qui s'allume.
- *Montre* : 4-5 étapes en ligne verticale reliées par un trait ENCRE 5 px ; rond numéroté à gauche, libellé à droite.
- *Quand* : « La demande arrive, le devis part, la relance suit, le client signe. »
- *Gabarit* : **M3** (grande carte).
- *Déroulé* : chute ; étapes GRIS déjà dessinées ; chaque étape dite → rond ACCENT_1 + libellé ENCRE + trait qui se remplit jusqu'à elle (6 i) ; badge « ● Devis signé » qui `POP` à droite sur la dernière.
- *Durée* : 2,5-5 s. *Son* : `tick` par étape, `confirmation` à la fin.

### Lot 3 « Fil conducteur, chiffres et preuves » (designer 3) : 8 éléments + `BarreProgression`

**17. `FilEtape`** — le fil conducteur (motif récurrent).
- *Montre* : (a) pastille « ÉTAPE 2/6 » ENCRE + 6 points (pleins ACCENT_1, vides GRIS) ; (b) carte-titre « ÉTAPE 2 · LE FORMAT » avec 6 carrés dont les précédents sont **cochés** ; (c) la `BarreProgression` permanente.
- *Quand* : début de chaque étape d'une vidéo en liste. « Deuxième étape : le format. »
- *Gabarit* : (a) collée au **bas de la bande IVOIRE** quand la prise est descendue, sinon M1 ; (b) M1.
- *Déroulé* : (b) i0 E-POP du titre ; carrés en cascade 2 i ; cascade de coches sur les étapes passées (2 i chacune) ; le carré actif passe ACCENT_1 ; sortie S-RETRECIT 3 i. (a) le point actif se remplit en 3 i, reste tant que l'étape dure.
- *Durée* : (b) 0,8-1,3 s. *Son* : `tick` par coche.

**18. `Chrono`** — le temps qui file.
- *Montre* : cadran rond 0,30 L (BLANC contour 7, aiguille ENCRE 8 px) + temps numérique sur plaque ACCENT_2 (« 2:00 »), libellé (« POUR CRÉER UN AGENT »).
- *Quand* : « Ça prend deux minutes. » / « 45 minutes par devis. »
- *Gabarit* : M1 (cadran à gauche, x 0,10-0,30) ou M6.
- *Déroulé* : i0 cadran `POP` ; l'aiguille fait 1 à 3 tours (rotation continue) pendant que le temps défile jusqu'à la valeur dite (12-18 i) ; `CLAQUE` à l'arrivée ; option « trop long » : le cadran passe GRIS et se fait barrer.
- *Durée* : 1-2 s. *Son* : `tick` rapide (toutes les 2 i), `ding` final.

**19. `AvisEtoiles`** — note en étoiles (jamais d'avis client inventé ni affiché).
- *Montre* : 5 étoiles (64 px, contour ENCRE 5, remplissage ACCENT_2) + libellé dit (« NIVEAU EXPERT », « 5/5 »).
- *Quand* : uniquement pour qualifier ce que Will dit lui-même : « Là, l'agent devient expert. » **Jamais** de note de clients, de faux avis ou de chiffre d'avis.
- *Gabarit* : M1, sous un `BadgeProfil` ou seul.
- *Déroulé* : étoiles vides GRIS en cascade 2 i ; remplissage gauche → droite 1 étoile toutes les 3 i (`CLAQUE` à 1,2 → 1) ; dernière étoile : 4 petits éclats ENCRE.
- *Durée* : 0,8-1,5 s. *Son* : `tick` par étoile, `ding` final.

**20. ★ `EclatChiffre`** (re-habillé)
- *Montre* : plein cadre ACCENT_1 uni, **sans dégradé** ; chiffre géant ENCRE (320-420 px) avec contour BLANC 10 px et ombre L ; unité dite sur plaque ENCRE/BLANC ; **anneau** ENCRE de 0,9 L (trait 18 px) qui se trace autour ; 8 éclats rectangulaires ENCRE (14 × 70 px) qui jaillissent en étoile **sans flou**.
- *Quand* : un chiffre fort. « 45 minutes par devis. »
- *Gabarit* : M5 (≥ 8 s).
- *Déroulé* : i0 aplat qui entre par E-COUPE ou balayage diagonal 3 i ; i1 compteur 0 → valeur dite en 12 i ; i13 `CLAQUE` 1,3 → 1 + anneau qui se trace en 8 i + éclats 6 i ; i20 unité `POP` ; sortie : balayage de l'aplat vers le haut-droit en 3 i, **le chiffre part avec l'aplat**.
- *Durée* : 1-1,4 s. *Son* : `tick` + `eclats`.

**21. `PageWebDefile`** — la preuve : une vraie page qui défile.
- *Montre* : fenêtre de navigateur (`CoqueFenetre` avec barre d'adresse) contenant une **vraie capture** fournie (site, console, e-mail reçu, devis) qui défile vers le haut ; curseur ENCRE 0,05 L qui clique (anneau ACCENT_1 de 0,04 → 0,10 L en 8 i) ; surlignage ACCENT_1 sur la ligne citée ; étiquette « FAIT EN 1 HEURE » qui chevauche le bord.
- *Quand* : « Voilà la page qu'il a construite. »
- *Gabarit* : **M4** (couvre le visage, ≥ 5 s).
- *Déroulé* : i0 E-COTE depuis la droite (Z couvert à i3) ; défilement continu 0,35 H/s ; au mot cité, arrêt 6 i + clic + surlignage ; étiquette E-POP à +0,3 s ; sortie S-COTE gauche 4 i.
- *Durée* : 1,5-3,5 s. *Son* : `whoosh-in`, `click` au clic.
- *Pour l'extrait* : capture factice **neutre** autorisée (page Axion-IA générique), marquée « démo » dans le rapport.

**22. `CarrouselFeuillete`** — un vrai carrousel feuilleté.
- *Montre* : publication LinkedIn (en-tête : pastille Axion-IA, nom, « · 1 j ») contenant des pages carrées qui se feuillettent à **≈ 3 pages/s** ; points de pagination ; étiquettes successives « CARROUSEL ENTIER », « À MA CHARTE », « PRÊT À PUBLIER ».
- *Quand* : « Il me sort un carrousel entier, à ma charte. »
- *Gabarit* : M4.
- *Déroulé* : i0 E-COTE droite ; une page toutes les 10 i (glissement 4 i vers la gauche) ; une étiquette par mot fort (E-POP, chevauche le bas de la fenêtre) ; sortie S-COTE gauche 4 i.
- *Durée* : 2-3,5 s. *Son* : `whoosh-in`, `select` léger par page (1 sur 2).

**23. `JaugePourcentage`** — le montage ou le travail qui avance.
- *Montre* : carte « MONTAGE · AGENT VIDÉO » avec 3 pistes (vidéo ACCENT_1, texte BLANC, son GRIS) et une tête de lecture ENCRE qui avance ; pourcentage géant (« 96 % ») qui saute 12 → 38 → 69 → 96 %.
- *Quand* : « Et il me sort la vidéo montée. »
- *Gabarit* : M2.
- *Déroulé* : chute ; la tête de lecture traverse en 22 i ; pourcentage par sauts de 6 i (`CLAQUE` à chaque saut) ; à 96 %, puce « PRÊT » ACCENT_2 qui déborde.
- *Durée* : 1-2 s. *Son* : `tick` par saut, `ding` final.

**24. ★ `PileNotifications`** (re-habillé)
- *Montre* : 1 à 3 bulles de notification (BLANC, contour 5, ombre S, rayon 18), icône dans une pastille ACCENT_1 à gauche, titre Inter 800 36 (« Relance envoyée »), sous-ligne Inter 600 28 (décor).
- *Quand* : « Le client reçoit la relance, puis le devis signé arrive. »
- *Gabarit* : **M7** (bas) ou M1 en version 1 bulle.
- *Déroulé* : chaque bulle E-BAS en 5 i, sur son mot ; les précédentes **remontent de 0,05 H** (titres toujours lisibles) et passent à l'échelle 0,96 ; sortie : cascade S-COTE droite de 3 i, l'icône part avec sa bulle.
- *Durée* : 1,5-3 s. *Son* : `vibreur` court + `ding` sur la dernière.

### Lot 4 « Fenêtres vidéo » (designer 4) : 7 éléments + `CoqueFenetre`

Vidéos : vraies vidéos Pexels/Pixabay **nettes** (source ≥ 1080 px du côté affiché, ≥ 10 % de pixels qui bougent, contraste normal), **littérales**, jamais zoomées, jamais d'image fixe, jamais de photo générée. Une étiquette (`Plaque`) chevauche toujours le bord de la fenêtre.

**25. ★ `FenetrePleinCadre`** (re-habillée)
- *Montre* : une fenêtre M4 qui s'ouvre jusqu'au plein cadre, puis se referme.
- *Quand* : une scène forte. « Pendant que vous êtes sur le chantier… »
- *Gabarit* : M4 → M5 (≥ 8 s).
- *Déroulé* : i0 E-COTE droite (Z couvert à i3) ; i10 l'**enveloppe** (pas la vidéo) s'agrandit jusqu'aux bords en 6 i, rayon 22 → 0, contour 7 → 0 ; étiquette ACCENT_1 0,40 L en bas qui `POP` ; à la fin, l'enveloppe se rétracte en 4 i et sort S-COTE gauche (Z découvert en ≤ 3 i), sans reste.
- *Durée* : 1,5-2,5 s. *Son* : `maximize` / `minimize`.

**26. ★ `FenetreTelephone`** (re-habillé)
- *Montre* : téléphone (cadre ENCRE 24 px, rayon 64, îlot noir 0,16 L × 0,02 H) avec une vidéo verticale ou une **capture d'appli** qui défile ; un doigt (pastille BLANC 0,06 L contour 5) qui touche.
- *Quand* : « Le client valide depuis son téléphone. »
- *Gabarit* : M4 réduit : x 0,20 → 0,80, y 0,07 → 0,66 (couvre Z, qui va de x 0,25 à 0,75 et de y 0,12 à 0,58).
- *Déroulé* : i0 E-BAS (Z couvert à i3) ; i12 doigt `POP` + toucher (anneau ACCENT_1 8 i) ; défilement ; étiquette sur le bord droit ; sortie S-BAS 4 i.
- *Durée* : 1,5-3 s. *Son* : `maximize` + `tick` au toucher.

**27. ★ `FenetreDouble`** (re-habillé)
- *Montre* : fenêtre A sur le visage (M4, -2°) + fenêtre B 0,44 L × 0,30 H en bas à droite (x 0,50 → 0,94, y 0,52 → 0,82, +4°), chacune avec son étiquette.
- *Quand* : deux exemples ou un avant/après dits. « Le devis part… et il revient signé. »
- *Déroulé* : A en E-COTE droite ; B en E-COTE depuis le bas-droit **8 i plus tard**, au 2ᵉ mot, avec secousse ±0,006 L ; B sort 4 i avant A ; tout reste dans le cadre.
- *Durée* : 2-3 s. *Son* : `whoosh-in` + `drop`.

**28. ★ `BandeVideo`** (re-habillée)
- *Montre* : bande diagonale pleine largeur (épaisseur **0,18 H**, -12°, contour 7 haut et bas) avec **une seule** vidéo paysage qui défile latéralement (la source, pas la prise) ; puce ACCENT_1 de 0,28 L au bout.
- *Quand* : un mouvement, un flux. « Les demandes arrivent toute la journée. »
- *Gabarit* : sous le menton : bord haut ≥ 0,60 H (M7).
- *Déroulé* : i0 E-COTE gauche (`GLISSE`) ; défilement 0,01 L/i ; puce `POP` à +0,3 s ; sortie S-COTE droite 4 i, sans bande vide.
- *Durée* : 1,2-2 s. *Son* : `whoosh-in`.

**29. ★ `CercleEpaule`** (re-habillé)
- *Montre* : vidéo dans un cercle de **0,46 L** (contour 7, ombre L) entièrement dans le cadre (centre x 0,74 L, y 0,72 H, ou miroir à gauche), anneau ACCENT_1 décalé de 0,012 L qui tourne ; puce sous le cercle.
- *Quand* : un détail concret. « Un coup de fil de moins. »
- *Gabarit* : M6.
- *Déroulé* : i0 le cercle `POP` depuis 0,1 ; l'anneau se trace en 9 i puis tourne à 0,6°/i ; puce E-ETIRE à +0,3 s ; sortie S-RETRECIT 3 i vers le bord.
- *Durée* : 1,2-2,5 s. *Son* : `select` + `tick`.

**30. ★ `MosaiqueVideos`** (re-habillée, sans perspective)
- *Montre* : grille 3 × 3 de tuiles vidéo (rayon 14, contour 5, ombre S) sur fond ENCRE, **inclinée -8° dans le plan** (rotateZ seulement), qui défile vers le haut ; 6 sources différentes.
- *Quand* : une énumération. « Des dizaines de devis, de chantiers, de clients. »
- *Gabarit* : M5 (≥ 8 s).
- *Déroulé* : i0 tuiles présentes dès la 1ʳᵉ image (cascade d'apparition 1 i) ; défilement 0,6 % H/i ; au mot fort, **une tuile sort de la grille** (échelle 1 → 1,7, rotateZ → 0, contour ACCENT_1 10 px) avec sa `Plaque` ; sortie : la grille glisse vers le haut en 4 i.
- *Durée* : 1,8-2,5 s. *Son* : `whoosh-in` + `select`.

**31. `AvantApres`** — fenêtre coupée en deux.
- *Montre* : une fenêtre M4 coupée verticalement : gauche « AVANT » (vidéo en **noir et blanc**), droite « APRÈS » (vidéo en couleur) ; une poignée ronde ENCRE/ACCENT_1 sur la ligne de séparation, qui balaie de gauche à droite.
- *Quand* : « Avant, tout à la main. Maintenant, c'est automatique. »
- *Gabarit* : M4.
- *Déroulé* : i0 E-COTE ; la ligne commence à 0,85 de la largeur (AVANT presque plein) ; au mot « maintenant », la poignée balaie jusqu'à 0,15 en 10 i (`GLISSE`) ; étiquettes AVANT (GRIS) / APRÈS (ACCENT_1) collées en haut de chaque côté ; sortie S-COTE.
- *Durée* : 2-3 s. *Son* : `whoosh-in` + `select` au balayage.

### Lot 5 « Coups de poing, typo et fin » (designer 5) : 7 éléments + panneau de fin

**32. ★ `DalleClaquee`** (la dalle « STOP », re-habillée)
- *Montre* : plein cadre ACCENT_1 uni ; mot géant ENCRE (1-2 mots dits) avec contour BLANC 10 px et ombre L ; soulignement ENCRE de 24 px tracé ; 4 traits d'impact ENCRE.
- *Quand* : « STOP. » / « Arrêtez de relancer à la main. »
- *Gabarit* : M5 (≥ 8 s).
- *Déroulé* : i0 aplat E-COUPE ; mot échelle 1,5 → 1 (`CLAQUE`, pic i4), traits d'impact i4-i8 ; soulignement i6-i12 ; micro-secousse ±0,004 L pendant la pose ; sortie : l'aplat **et le mot** partent ensemble en balayage diagonal 3 i (Z découvert en ≤ 2 i).
- *Durée* : ≈ 0,9 s. *Son* : `drop` + « boum » (à sourcer).

**33. ★ `RafaleTroisMots`** (re-habillée)
- *Montre* : 3 mots dits à moins de 0,9 s d'écart, chacun sur un aplat plein cadre différent (ACCENT_1, ENCRE, IVOIRE), puis récapitulatif : les 3 mots sur 3 plaques inclinées ±3° alignées à gauche.
- *Quand* : « Relancer. Facturer. Planifier. »
- *Gabarit* : M5.
- *Déroulé* : chaque mot : aplat E-COUPE + mot `CLAQUE` ; récapitulatif à i(mot 3) + 8 : plaques E-ETIRE en cascade 3 i ; sortie avant 1,8 s, balayage 4 i, mots avec l'aplat.
- *Durée* : 1,2-1,8 s. *Son* : `click`, `click`, `drop`.

**34. ★ `DuelVideo`** (re-habillé)
- *Montre* : 2 triangles le long de la diagonale bas-gauche → haut-droit, chacun une vidéo (gauche en **noir et blanc**, droite en couleur) ; liseré ENCRE 14 px sur la diagonale ; mot A sur plaque BLANC, mot B sur plaque ACCENT_1 ; disque ENCRE de 0,14 L au centre avec « VS » ACCENT_1.
- *Quand* : « Le bureau… ou le chantier. »
- *Gabarit* : M5 (≥ 8 s).
- *Déroulé* : triangles depuis leurs coins en 3 i ; disque `CLAQUE` + secousse 0,010 L ; mot A `POP` i2, mot B au mot B ; verdict s'il est dit : le perdant passe GRIS-noir et blanc et recule de 0,05 L à mi-parcours ; sortie vers les coins en 3 i.
- *Durée* : 1,5-2,5 s. *Son* : `whoosh-in` + `drop`.

**35. ★ `MotDerriere`** (re-habillé)
- *Montre* : un mot dit (≤ 8 lettres) en Montserrat 900 de 0,9-1,1 L de large, **derrière** Will (sa tête passe devant grâce au détourage), lettres ACCENT_1 avec contour ENCRE 10 px et ombre L.
- *Quand* : le thème de la vidéo. « Le TEMPS, c'est ce qui vous manque. »
- *Gabarit* : derrière la tête, y 0,03 → 0,26 H (avec D0). Visage entier.
- *Déroulé* : lettres qui montent depuis le bas du mot, 1 i par lettre (`POP`) ; défilement latéral 0,15 % L/i ; changement à +0,5 s : une lettre clé passe ACCENT_2 ; sortie : lettres qui retombent en cascade 1 i.
- *Durée* : 1,2-2,2 s. *Son* : `whoosh-in` grave.
- *Si le détourage n'est pas disponible* : le mot passe **au-dessus** de la tête (M1), sans chevauchement.

**36. `ElementBarre`** — ce qu'on raye.
- *Montre* : une étiquette (« 2 000 € », « UNE AGENCE ») ou une rangée de 10 pictogrammes de personnes, **barrés** d'un trait.
- *Quand* : « Plus besoin de payer une agence 2 000 euros. » / « Il aurait fallu dix personnes. »
- *Gabarit* : M1 (ou sur une fenêtre M4 en étiquette).
- *Déroulé* : objet E-POP ; au mot de négation, trait tracé en 5 i à -8° (§ D.3) puis objet GRIS en 3 i ; option : une étiquette ACCENT_1 « 1 HEURE » `CLAQUE` par-dessus.
- *Durée* : 1-1,8 s. *Son* : `select` au trait (ou « feutre » rapide).

**37. `AppelFinalPile`** — l'appel à l'action qui s'empile.
- *Montre* : étiquette ENCRE « COMMENTEZ « RELANCE » » (texte ACCENT_1, guillemets français), puis 2-3 lignes cochées dessous (plaques BLANC, coche ACCENT_1), et une **pastille ronde ACCENT_1 avec flèche ENCRE** (96 px) à droite des sous-titres.
- *Quand* : « Commentez RELANCE : je vous envoie le guide, le modèle et la vidéo. »
- *Gabarit* : M1 (pile y 0,02 → 0,185 H, plaque principale corps 60, lignes corps 38) + flèche à (0,86 L ; 0,72 H).
- *Déroulé* : plaque principale `CLAQUE` ; une ligne cochée par bénéfice dit (E-ETIRE + coche en 4 i) ; flèche `POP` puis pulsation 1 → 1,08 toutes les 20 i ; dure jusqu'au panneau de fin.
- *Durée* : 3-4,5 s. *Son* : `ding` par ligne cochée.

**38. `PanneauFin`** — la fin.
- *Montre* : panneau IVOIRE qui **monte du bas en 5 i** et pousse la prise vers le bas ; puis en cascade (1 élément par image) : logo Axion-IA, nom « Williams Jullin » (Montserrat 900, 64), 3-5 pastilles d'outils, bouton ACCENT_1 « COMMENTEZ « RELANCE » ».
- *Quand* : dernière seconde.
- *Gabarit* : M9.
- *Déroulé* : i0 panneau E-BAS (`CHUTE` inversée, sans rebond au-dessus du haut) ; i5-i10 cascade ; bouton qui pulse.
- *Durée* : 1-1,5 s. *Son* : son qui monte (à sourcer, ≈ 1,2 → 2,6 kHz) ou `confirmation`.

### F.1 Contrôle du catalogue

- **38 éléments** : lot 1 = 8, lot 2 = 8, lot 3 = 8, lot 4 = 7, lot 5 = 7.
- **Les 14 gardés** (★) : MotSaute (1), CarteChecklist (2), EclatChiffre et PileNotifications (3), FenetrePleinCadre, FenetreTelephone, FenetreDouble, BandeVideo, CercleEpaule, MosaiqueVideos (4), DalleClaquee, RafaleTroisMots, DuelVideo, MotDerriere (5).
- **Couverture des gabarits** : M1 (1-8, 17-19, 36, 37), M2/M3 (9-16, 23), M4 (21, 22, 25-27, 31), M5 (20, 30, 32-34), M6 (18, 29), M7 (24, 28), M9 (38), derrière la tête (35).
- **Motifs récurrents** prévus : `CarteCommande`, `FilEtape`, `BadgeProfil` (peuvent revenir 2-3 fois par vidéo, contenu différent).
- **Réserve** (si un designer finit en avance) : `CarteReseau` (nœud central + 6 pictos reliés par des pointillés qui se tracent), `TapisRoulant` (rail pointillé où défilent des icônes vers un compteur « n CONTENUS »).

---

## G. Rythme

### G.1 Règles chiffrées (vérifiables par code sur le plan de montage)

| # | Règle | Seuil |
|---|---|---|
| R1 | **Densité** : événements graphiques hors sous-titres (entrée, sortie, étape de contenu, changement de gabarit, saut de compteur) | **≥ 2,2 par seconde** sur toute fenêtre glissante de 5 s ; **cible 2,6/s (1 toutes les ≈ 0,4 s)** [MESURÉ : 2,6/s sur la référence LinkedIn] |
| R2 | **Prise seule** (aucun objet hors sous-titres et barre) | **≤ 0,5 s** d'affilée ; ≤ 3 % du temps |
| R3 | **Objet posé immobile** (aucun changement de contenu) | **≤ 0,75 s** |
| R4 | Entrées | **≤ 6 i** jusqu'au pic |
| R5 | Sorties | **3 à 5 i** ; l'élément suivant entre dans la même image |
| R6 | Étiquettes au-dessus de la tête | 0,7-1,5 s chacune (CTA : jusqu'à 4,5 s s'il grandit) |
| R7 | Cartes | 1,0-5,5 s, une étape de contenu toutes les 0,25-0,75 s |
| R8 | Fenêtres sur le visage | 1,2-3,6 s ; aucune avant 5,0 s ; plein cadre (M5) aucun avant 8 s |
| R9 | Changement de gabarit | toutes les 2-3,5 s en moyenne ; jamais > 5,5 s dans le même |
| R10 | Diversité | jamais 2 fois de suite le même élément (sauf échange de carte M2 → M2) ; **≥ 8 éléments différents par tranche de 30 s** ; un même élément ≤ 3 fois par vidéo (motifs récurrents compris) |
| R11 | Coups de poing (M5) | 2 à 4 par 60 s, jamais deux de suite, le dernier ≥ 6 s avant la fin |
| R12 | Motif récurrent | **1 à 2 motifs** qui reviennent 2-3 fois dans la vidéo (fil conducteur, carte commande, badge) |
| R13 | Bruitages | ≈ 1 son par entrée de carte ou de fenêtre (`whoosh-in`), `tick` sur compteurs et coches, **`ding` réservé aux réussites** (≤ 1 toutes les 6 s) ; un même fichier ≤ 30 % des sons, jamais 2 fois de suite à moins de 0,3 s ; crêtes -12 dBFS max ; aucune musique |
| R14 | Palette | ACCENT_2 ≤ 25 % (A) / ≤ 15 % (B) des surfaces d'accent sur toute fenêtre de 10 s |

### G.2 Les 5 premières secondes (gabarit d'ouverture)

| Temps | Prise | Ce qui se passe |
|---|---|---|
| **0,00 s (image 0)** | descente D1 en 6 i | **`EtiquetteTete` déjà en pop dès l'image 0** (la promesse, ex. « VOS DEVIS » / sur-étiquette « SANS RELANCER »). 1ᵉʳ mot de sous-titre. Barre de progression visible. **Visage entier.** |
| 0,15-0,5 s | D1 | Sur-étiquette ou 2ᵉ ligne qui pop ; mot fort en plaque dans les sous-titres. |
| 0,5-0,7 s | D1 | Étiquette change de contenu (rouleau) **ou** sort en S-RETRECIT. |
| **≈ 0,7 s** | D1 → **D2** | **1ʳᵉ carte qui tombe** (souvent `BadgeCompteur` agrandi ou `CarteChecklist` « preuve »), `whoosh-in`. |
| 0,9-2,4 s | D2 | Contenu de carte : un changement toutes les 0,5 s (compteur qui défile, ligne, logo, titre « 1/3 → 2/3 → 3/3 »). |
| ≈ 2,5 s | D2 → D1 | Carte S-REMONTE 3 i, la prise remonte à D1 ; **`BadgeCompteur` / `RangeePastilles`** au-dessus de la tête (cascade de logos). |
| 3,0-3,8 s | D1 | Changement de sens : `Interjection` ou inversion ENCRE du badge sur le mot de rupture (« mais », « zéro »). |
| 3,8-4,6 s | D1 | Annonce du fil : « LES 5 ÉTAPES » + carrés en cascade (`RangeePastilles`). |
| 4,6-5,0 s | D1 | `FilEtape` « ÉTAPE 1 » ; à partir de 5,0 s, la 1ʳᵉ fenêtre sur le visage devient permise. |

Sur ces 5 s : **≥ 12 événements**, **0 image de prise seule**, visage toujours visible.

---

## H. Grille du critique

### H.1 Éliminatoires (un seul suffit : l'élément est refait, sans note)

| # | Éliminatoire | Comment juger |
|---|---|---|
| **E1** | **Ne ressemble pas aux 2 vidéos de référence** | Côte à côte à taille téléphone avec le passage de référence de même nature (étiquette contre étiquette, carte contre carte, fenêtre contre fenêtre). Le critique répond oui/non : même famille (aplat, contour épais, ombre dure, capitales Black, contenu qui se construit) ? |
| **E2** | **Moins rapide que les références** | Entrée > 6 i, sortie > 5 i, objet immobile > 0,75 s, prise seule > 0,5 s dans l'enchaînement, ou densité < 2,2 événements/s sur l'enchaînement de 15 s. |
| **E3** | **Illisible sur téléphone** | Extrait réduit à 30 % : un texte porteur < 32 px (décor < 24 px), un mot coupé par erreur, un texte d'accent sans contour encre posé sur la prise, ou on ne comprend pas l'idée en 0,5 s. |
| E4 | Visage | Visage à moitié caché à l'état posé ; plus de 3 images de visage partiel ; un élément « entier » qui entre dans Z ; visage couvert avant 5 s. |
| E5 | Prise | Le moindre zoom, recadrage, changement d'échelle ou mouvement autre que la translation verticale. |
| E6 | Contenu | Chiffre ou mot non dit, « Villeexemple », « aucun gain garanti », faux visage présenté comme réel, avis client affiché. |
| E7 | Palette | Couleur hors palette (hors contenu vidéo/capture/logo réel) ; surface d'accent sur la prise sans contour encre. |
| E8 | Style v3 | Verre, flou (d'ombre, de mouvement, de mise au point), dégradé, perspective 3D, ombre douce, lueur. |
| E9 | Restes | Un pixel d'élément visible plus d'1 image après sa sortie. |
| E10 | Son | Extrait sans piste audio, ou musique. |
| E11 | Code | `.tsx` sans `import React`, signature d'`Icone` modifiée. |

### H.2 Notation /10 (si aucun éliminatoire)

| # | Critère | Points |
|---|---|---|
| 1 | **Punch de la matière** : contour épais net, ombre dure cohérente (bas-droite), aplats francs, plaques bien proportionnées | 1,5 |
| 2 | **Vitesse et ressort** : élan, dépassement visible, arrêt net, sortie plus vive que l'entrée | 1,5 |
| 3 | **Contenu vivant** : construction au mot (±3 i), un changement toutes les 0,25-0,75 s | 1,5 |
| 4 | **Lisibilité téléphone** : taille, contraste, compréhension en 0,5 s | 1,5 |
| 5 | **Littéralité** : on voit exactement ce qui est dit | 1 |
| 6 | **Singularité** : silhouette et geste différents des 37 autres | 1 |
| 7 | **Fidélité à la fiche** : gabarit, cotes, durées, ressorts | 0,5 |
| 8 | **Marque et palette** : rôles A/B respectés, reconnaissable Axion-IA | 0,5 |
| 9 | **Bruitage** : calé à ±1 i, adapté, pas envahissant | 0,5 |
| 10 | **Enchaînement** : sortie propre, s'enchaîne sans temps mort dans le 15 s | 0,5 |
| | **Total** | **10** |

**Seuils** : **≥ 8,5** = montré à Will ; 7 à 8,4 = corrections chiffrées puis nouvelle critique **sur un nouvel extrait** ; < 7 = refait.

**Règles du critique** : il juge **l'extrait vidéo avec le son**, jamais une image fixe ; il cite l'image précise (« i4 : … ») ; il note A **et** B ; il fait le côte à côte avec la référence à la même taille ; une note donnée sans avoir regardé l'extrait est nulle.

---

## I. Spécification commune des extraits

### I.1 Format

- Composition **1080 × 1920, 30 i/s**, rendue avec **`scale: 0.5` → 540 × 960**. H.264, `crf` 18, `yuv420p`. Audio AAC 48 kHz stéréo 192 kb/s. **Une piste audio obligatoire**, même si elle ne contient que des bruitages.
- **Fond** : l'image `prise-commune-1080x1920.png` en `<Img>` plein cadre (`objectFit: "cover"`, **aucune échelle**). Zone du visage : **x 0,25 → 0,75 L, y 0,12 → 0,58 H** (yeux à 0,31 H, haut des cheveux 0,14 H, menton 0,49 H). La descente est une `translateY` de cette image, rien d'autre.
- **Voix de Will absente** : bruitages seulement. Si un fichier `voix-demo.wav` est fourni avec ses mots horodatés, il remplace la phrase de démonstration et tout se cale dessus.
- **Sous-titres obligatoires dans chaque extrait** : chaque élément a un fichier `mots-demo.json` (`[{ "mot": "VOS", "debut": 0.10, "fin": 0.32, "fort": false }, …]`) écrit par le designer à partir de la phrase d'exemple de sa fiche, au débit de 3,5 mots/s, avec ≥ 1 mot fort ; les déclencheurs de l'élément sont calés sur ces mots.
- **Barre de progression** présente dans chaque extrait (elle avance sur la durée de l'extrait).

### I.2 Ce que chaque designer rend (dossier `extraits-v4/lot{N}/`)

1. **Un extrait par élément**, 3 à 6 s : 0,3 s de prise + sous-titres, l'élément complet (entrée, vie, sortie), 0,4 s après la sortie. **En palette A et en palette B** : `{NomCode}-A.mp4`, `{NomCode}-B.mp4`.
2. **Un enchaînement de 15 s du lot**, en A et en B (`lot{N}-enchainement-15s-A.mp4`, `-B.mp4`) : sous-titres continus (phrase de démonstration de ≈ 52 mots), barre de progression, ≥ 5 éléments du lot, complétés d'`EtiquetteTete` génériques pour tenir R1-R3 (densité ≥ 2,2/s, prise seule ≤ 0,5 s). Les lots 4 et 5 ouvrent leur enchaînement par 5 s sans visage couvert (règle des 5 s).
3. **Une bande de 6 images** par élément (palette A : i0, i2, i4, i8, posé, sortie) en JPG, **pour mémoire seulement**.
4. Un **`RAPPORT.md`** de lot : pour chaque élément, mesures réelles (images d'entrée, images de sortie, plus longue immobilité, plus petit texte en px, images de visage partiel, sons utilisés, surface en % de l'image) et écarts à la fiche.

### I.3 Code

- Fichiers : `motion-v4/lot{N}/{NomCode}.tsx`, primitives dans `motion-v4/socle/` (jetons du § B.1 recopiés à l'identique).
- Chaque élément prend en props au minimum : `palette: "A" | "B"`, les textes dits, les instants des mots déclencheurs (en images), et pour les fenêtres la source vidéo.
- `import React from "react";` en tête de chaque `.tsx`. Ne pas toucher la signature d'`Icone`. Aucun nouveau paquet, sauf `@remotion/google-fonts` à la version exacte de `remotion` s'il manque.
- Rendus **dans le cloud uniquement**, un à la fois.

---

## J. Ce que j'ai dû interpréter (à confirmer par Will sur extrait)

1. **Turquoise** = exactement le cyan mesuré des références (#5CE1E6), sans le retoucher. **Orange vif** = #F07C3E, avec #E8743F en repli.
2. **Encre** : je garde l'encre chaude de la marque (#110A05) au lieu du bleu nuit des références : même effet, même contraste.
3. **Ivoire** : la marque (#E9DCC8) reste pour la bande du haut et la fin ; les cartes passent en ivoire éclairci #FBF7EF (plus « écran », comme le crème des références). L'orange de marque #B44F29 ne sert plus qu'au texte sur fond clair.
4. **Le mur de Will est gris-bleu froid** (≈ #A5ACB0-#B6BCC5) : contrairement aux références (mur beige), aucun accent ne s'en détache par la lumière ; c'est le contour encre + l'ombre dure qui font le travail, d'où leur caractère obligatoire. La palette B risque de « claquer » davantage chez lui.
5. **Objet au-dessus de la tête** : les cheveux de Will montent à 0,14 H, il reste peu de place. Je généralise la **petite descente de 0,06 H** (que Will a validée le 15/10) à tous les objets « tête ».
6. **Visage visible au début** : je garde « rien sur le visage avant 5 s » mais **j'autorise étiquettes et cartes hautes dès 0 s** (visage visible), ce qui annule les anciennes règles v3 « aucune carte avant 8 s » et « 1 s de Will seul après un coup de poing ».
7. **Taille des textes** : texte porteur ≥ 32 px, texte de décor ≥ 24 px (les références utilisent de petits textes « pour faire vrai » ; la v3 interdisait tout sous 26 px).
8. **Personnes** : `BadgeProfil` en pictogramme ou initiales ; `AvisEtoiles` limité à ce que Will dit, jamais d'avis clients.
9. **Plus aucun flou ni perspective** : les références n'en ont pas ; la v3 en vivait. Les 14 éléments gardés perdent donc leur 3D, leurs dégradés et leur verre (`MosaiqueVideos` passe en simple inclinaison dans le plan).

---

## K. Résumé

1. Style v4 = **les deux références** : aplats francs, contour encre 5-7 px, ombre dure encre (5-12 px, flou 0), capitales Montserrat Black. Plus de verre, de dégradé, de flou ni de 3D.
2. **Palette A** : turquoise #5CE1E6 principal + orange vif #F07C3E second. **Palette B** : orange vif principal + touches turquoise. Base encre #110A05, ivoire #E9DCC8, ivoire clair #FBF7EF, blanc. Texte encre sur accent : 12,5:1 (turquoise), 7,2:1 (orange).
3. Sous-titres 84 px, 1-2 mots, trois états (blanc / accent / plaque), chiffres sur plaque d'accent 2, position qui suit la mise en page, jamais sur les yeux.
4. Ressorts `POP`, `CHUTE`, `CLAQUE`, `DESCENTE`, `GLISSE` ; entrées ≤ 6 i, sorties 3-5 i, aucun reste.
5. 10 gabarits (M0-M9), dont l'objet au-dessus de la tête (descente 0,06 H) dès l'image 0 et la carte haute (descente 0,26 H) dès 0,7 s.
6. **38 éléments** en 5 lots (8/8/8/7/7), dont les 14 gardés par Will, re-habillés.
7. Rythme : ≥ 2,2 événements/s (cible 2,6), prise seule ≤ 0,5 s, objet immobile ≤ 0,75 s.
8. Critique : seuil 8,5/10, avec trois éliminatoires de tête : ressemble aux références ? aussi rapide ? lisible sur téléphone ?
9. Extraits 540 × 960, 30 i/s, avec son et sous-titres, sur la prise commune, en palette A **et** B, plus un enchaînement de 15 s par lot.

---

## J. RÈGLE AJOUTÉE PAR WILL (16/10 22 h) — L'ARRIÈRE-PLAN CHANGE D'UNE VIDÉO À L'AUTRE

Will ne filmera pas toujours au même endroit : mur gris-bleu aujourd'hui, mais demain mur blanc, mur beige, bureau sombre, extérieur, fond chargé (étagères, plantes, fenêtre lumineuse). **Aucun élément ne doit dépendre de la couleur du fond.**

1. **On ne modifie JAMAIS l'arrière-plan de la prise** (ni flou, ni teinte, ni remplacement, ni assombrissement global). La prise reste telle que filmée.
2. Chaque plaquette porte **son propre fond plein** (ivoire éclairci, encre ou accent) + **contour encre 5-7 px** + **ombre dure** : elle doit rester lisible posée sur n'importe quoi.
3. **Aucun texte posé directement sur la prise** sans plaque, sauf les sous-titres, qui ont toujours contour encre épais + ombre dure (lisibles sur fond blanc ET sur fond noir).
4. Les accents (turquoise, orange) ne servent jamais de seul séparateur entre un élément et le fond : c'est le contour encre qui sépare.
5. **Test obligatoire** (designers et critique) : chaque extrait est vérifié sur **4 fonds** — la prise de Will (gris-bleu), un aplat blanc #FFFFFF, un aplat noir #111111, et un fond chargé (une image B-roll de bureau ou de chantier mise en plein cadre). Critère éliminatoire de la grille : « lisible sur les 4 fonds ? ».


---

## K. DÉCISION DE WILL (16/10 ~23 h 50) — PALETTE B ORANGE RETENUE

Will a tranché : « ce ne sera pas turquoise mais orange ». **Palette B seule** : orange vif #F07C3E en accent principal (texte encre dessus, repli #E8743F si trop vif), touches de turquoise limitées à 15 %. La palette A (turquoise principal) est abandonnée : ne plus la rendre ni la proposer.



---

## L. DÉCISION DE WILL (17/10 nuit) — ZÉRO TURQUOISE, 26 PLAQUETTES GARDÉES

Will garde les 26 plaquettes de la sélection tour 2 et exige : « il ne faut pas de turquoise ». **Plus AUCUNE couleur turquoise/cyan nulle part** (ni accent 2, ni plaque de chiffre, ni coche, ni contour, ni mot en cours des sous-titres, ni turquoise foncé #0A6E74). Palette unique : orange vif #F07C3E (accent unique), encre #110A05, ivoire #E9DCC8 / ivoire éclairci #FBF7EF, blanc, gris neutre #9A948C. Là où le turquoise servait à distinguer un 2e état (mot en cours, chiffre), utiliser : encre sur orange, orange sur encre, ou blanc sur encre. #B44F29 reste possible pour du texte sur fond clair.


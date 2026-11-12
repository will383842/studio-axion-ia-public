# Couleurs communes du Studio

Source unique : `src/app/globals.css` (bloc `:root`). Les noms ne changent pas ; seules les valeurs changent. Les écrans sombres (aperçus de vidéo, écran caméra) emploient les mêmes noms avec des valeurs bleutées (`.theme-sombre`). La barre de gauche et les onglets du bas emploient les mêmes noms aux couleurs de la barre (`.theme-barre`).
Règle d'or : **un seul orange plein par écran** (le bouton principal). Un texte orange est toujours en orange foncé. Une couleur n'est jamais seule : le nom (famille, statut) est toujours écrit à côté.

## Fonds, traits et textes
| Nom | Valeur | Usage |
|---|---|---|
| `--fond` | #f3f7fb | fond de toutes les pages |
| `--surface-1` | #ffffff | cartes, fenêtres, champs |
| `--surface-2` | #eef3f8 | un cran plus foncé que la carte : survol, bloc en retrait |
| `--surface-3` | #e6edf4 | pastille neutre, piste de barre, bouton éteint |
| `--trait` | #d6e0ea | bord des cartes, séparateurs |
| `--trait-fort` | #b3c2d1 | bord des boutons secondaires |
| `--trait-champ` | #7b8fa3 | bord des champs et des cases (3,3:1 sur blanc) |
| `--texte` | #14212e | texte principal |
| `--texte-doux` | #44566a | texte secondaire |
| `--texte-faible` | #566779 | aide, légendes (4,5:1 mini sur toutes les surfaces) |

## Orange et accent
| Nom | Valeur | Usage |
|---|---|---|
| `--orange` | #b4512a | le bouton principal (un seul par écran) |
| `--orange-vif` | #a54623 | survol du bouton ; texte orange |
| `--sur-orange` | #ffffff | texte sur le bouton orange |
| `--orange-doux` | orange à 10 % | fond très léger (à éviter, voir `--accent-doux`) |
| `--accent` | #14507f | liens, onglet actif, contour de sélection (focus), étape en cours, surlignage du texte |
| `--accent-doux` | #e1effb | fond léger de l'accent |
| `--sur-accent` | #ffffff | texte sur fond accent |

## États
| Nom | Valeur | Fond doux | Usage |
|---|---|---|---|
| `--sauge` | #2a6234 | `--sauge-doux` #e3f0e2 | réussi, accepté, programmé |
| `--ambre` | #7a4f00 | `--ambre-doux` #fbecc8 | à valider, en retouche, attention |
| `--brique` | #a8321c | `--brique-doux` #f9e0da | erreur, à corriger |

## Statuts (`--statut-<nom>-fond` et `--statut-<nom>-texte`)
Brouillon (gris) · Fabrication (bleu) · Valider (ambre) · Retouche (ambre, bord en pointillés) · Accepté (vert) · Programmé (vert) · Publié (gris en contour) · Corriger (rouge) · Refusé (gris en pointillés).

## Familles de contenu
| Famille | Couleur | Fond doux |
|---|---|---|
| Vidéo | `--fam-video` #5b3cb0 | `--fam-video-doux` #ece7fa |
| Carrousel | `--fam-carrousel` #56650f | `--fam-carrousel-doux` #edf0d4 |
| Infographie | `--fam-infographie` #8e3a80 | `--fam-infographie-doux` #f6e4f2 |

(Les couleurs de réseaux `--res-*` sont ajoutées par la fiche CAL-06 de l'usine, dans le même fichier.)

## Barre de gauche et onglets du bas
`--barre-fond` #a9d6f5 · `--barre-trait` #86bfe8 · `--barre-actif` #e4f3fd · `--barre-texte` #071f33 · `--barre-doux` #0f2e47 · `--barre-faible` #173650 · `--barre-accent` #0f3a5c · `--barre-encre` #ffffff · `--barre-ok` #1c6b2c (icônes et textes gras seulement, 4,3:1).
Les classes de la barre gardent leurs noms (`text-texte`, `bg-surface-2`…) : `.theme-barre` leur donne les couleurs de la barre.

## Aperçu vidéo, messages, chargement
| Nom | Valeur | Usage |
|---|---|---|
| `--ecran` / `--ecran-texte` | #16202b / #f3f7fb | cadre d'aperçu vidéo |
| `--toast` / `--toast-texte` / `--toast-accent` | #14212e / #ffffff / #9fd3f7 | petits messages en bas ou en haut d'écran |
| `--squelette` | #c9d6e2 | animation de chargement |

## Charte figée (contenu produit, ne change jamais avec l'interface)
`--charte-orange` #B23F16 · `--charte-orange-vif` #9A3412 · `--charte-ivoire` #FAF9F5 · `--charte-noir` #141413.
Les couleurs proposées par défaut pour une marque ou l'aperçu des sous-titres (`bibliotheque/outils.ts`) les lisent : les vidéos produites ne changent pas.

## Formes
Une seule ombre `--ombre` (`--ombre-carte` et `--ombre-orange` la reprennent). Les halos orange (`--lueur`, `--lueur-forte`) sont neutralisés. Rayons : cartes 12 px (`rounded-carte`), champs et boutons 10 px (`rounded-champ`), pastilles rondes. Titres : Manrope gras.

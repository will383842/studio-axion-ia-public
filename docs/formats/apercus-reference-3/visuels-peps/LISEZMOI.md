# Visuels dessinés et peps — rendu par le moteur (style « reference/3 »)

Preuves de la PR « Tableau : banque de 16 visuels dessinés + peps dans le moteur », d'après la maquette validée par
Will le 15/10/2026 (« parfait », PR #260, `maquettes/tableau-visuels-peps/`). Tout est rendu PAR LE MOTEUR (Remotion,
`TableauScene` → `PageReference3`, plan `animation-3.ts`, banque `src/briques/tableau-scene/reference/visuels-3.ts`) :
aucune image n'est redessinée à la main.

| Fichier | Contenu |
| --- | --- |
| `banque-16-visuels.png` | Planche 4 × 4 des 16 visuels finis, même mise en planche que la maquette (nom, usage, ce qui bouge) |
| `banque-16-visuels-trace.jpg` | Chaque visuel à 4 instants de son tracé : traits au crayon un par un, hachures, textes, puis la touche orange |
| `comparaison.jpg` | Accroche, étape, exemple : la maquette #260 à gauche, le moteur à droite (fiche témoin AVEC visuels) |
| `moteur-accroche.png` · `moteur-etape.png` · `moteur-exemple.png` | Les trois pages du moteur, pleine taille (1080 × 1920), sous-titres compris |
| `defilement-vertical-gabarit-cadre-visuels.jpg` | Défilement vertical de la fiche témoin avec visuels, une image toutes les 2,5 s, sous-titres compris |
| `extrait-10s.mp4` | Les 10 premières secondes du vertical : l'accroche (document tracé, bloc orange 0 → 3, flèche), puis la douleur |
| `controle-couleurs-*.json` | Contrôle automatique des pixels de chaque image rendue : zéro pixel vert, bleu ou violet |

Fiche témoin : `tests/tableau/temoins/fiche-gabarit-cadre-visuels-reference-3.json` (l'exemple validé « Ce devis collé
dans ChatGPT contient trois données de trop », même texte dit mot pour mot, où le découpage a posé des visuels :
document aux lignes barrées et bloc orange « 3 données de trop. » sur l'accroche, liste cochée sur la promesse, schéma
personne → A sur l'étape 1, document sur l'étape 2, e-mail sur l'étape 3, bouclier coché sur l'exemple).

## Refaire les preuves

```
npx tsx tests/tableau/reference-3/apercus-visuels.mts docs/formats/apercus-reference-3/visuels-peps --planche --comparaison <dossier maquettes/tableau-visuels-peps de la PR #260>
npx tsx tests/tableau/reference-3/apercus-charte.mts docs/formats/apercus-reference-3/visuels-peps --formats vertical --fiche gabarit-cadre-visuels --video
```

Besoins : `npm ci` dans `studio-rendu`, Chromium (`/opt/pw-browsers`), ffmpeg, Python 3 avec Pillow et NumPy.

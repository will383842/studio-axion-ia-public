# Galerie L9b « Image → vidéo » — micro-objets

Rendues comme en prod (L10). `planche.jpg` : toutes les images de ce dossier.

- `A-1` … `A-5`, `A-recapitulatif` ; `B-1` … `B-5`, `B-recapitulatif` : les cinq bénéfices en rangées qui se partagent la zone utile ; une rangée pas encore dite est déjà là en creux (pointillés), la liste occupe toute la zone dès le début.
- `banque-mi-course`, `banque-posee` : les 12 dessins (3 × 4) remplissent la zone, dans l'ordre de `MICRO_OBJETS` : horloge à l’envers, tâches cochées, post-it, jauge, tirelire, cible, courbe, bouton « décider », course, escalier, calendrier, engrenages (ligne par ligne). Leur nom n'est plus écrit sous le dessin (il passerait sous le plancher de lisibilité).

## Mise en page (corrections de la direction, branche `image-video/mise-en-page`)

Règles posées par `studio-rendu/compositions/image-video/mise-en-page.ts` et contrôlées à chaque instant clé par `tests/image-video/mise-en-page.test.ts` (emprise lue dans les mêmes plans que les composants : `emprise.ts`) :

1. **Zone utile** : du bas de l'en-tête (0,245 + 0,02 de la hauteur) au haut de la bande des sous-titres (0,71 − 0,02). La bande des sous-titres (0,71 → 0,79) reste hors des 20 % du bas, comme la maquette validée. Chaque bloc de contenu y est **centré** et la **remplit à 70 % au moins** (cartes + micro-objet, entonnoir et sorties, avant/après, additionneur en rangées, schéma, téléphone de l'alerte, grande carte du résultat de recherche…).
2. **Marges** : aucun bloc à moins de 5 % de la largeur du bord (les deux sorties de l'entonnoir comprises) ; l'écran partagé devient deux panneaux arrondis dans les marges.
3. **Scène « Ensemble » lisible** : chaque bloc porte son icône et un **libellé court** (≤ 3 mots, nombre et unité comptant pour un) au plancher de lisibilité ou au-dessus ; les parts « 80 % / 20 % » coiffent leur colonne. Libellé court : champ `court` du nœud, sinon tiré du libellé (préfixe de branche et « auto » retirés, coupe jamais sur un mot outil).
4. **Pictogrammes fidèles** : temps = horloge, clarté = coche, productivité = courbe, coûts = « € », résultats = cible ; jamais la même icône pour deux éléments d'une même image (bénéfices, blocs d'ensemble, sources). La table de lecture (`src/domaine/image-video/icones.ts`) connaît désormais « € », « cible », « courbe », « clarté », « ticket », « scan », « USB », « drive », « chatbot » (robot), « alerte » (cloche).

**Témoin des sous-titres** (galeries seulement) : la phrase courte en bas (Inter Bold, mot orange, trait orange) montre l'image entière telle qu'elle sera lue ; c'est le titre de l'en-tête ou une phrase du script. En vidéo, ce sont les vrais sous-titres de la voix.

## Comment elles sont rendues

```
pnpm tsx scripts/image-video/galerie-prod.ts --navigateur /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
pnpm tsx scripts/image-video/galerie-prod.ts --piege --navigateur …   # preuve : le piège DOIT casser
```

Le banc construit `studio-rendu` comme la prod (`npm ci --omit=dev`, sans typescript ni `NODE_PATH`), rend TOUTES les galeries en JPEG (`galerie/`, `galerie-l9a/`, `galerie-micro-objets/`), une `planche.jpg` par galerie et `../planche-recapitulative.jpg`.

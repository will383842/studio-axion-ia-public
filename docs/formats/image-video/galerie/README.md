# Galerie « Image → vidéo » — image C (scène continue) et objets des images D, E, F

Rendues comme en prod (L10). `planche.jpg` : toutes les images de ce dossier.

- C (« Chatbot support client ») : `C-1-entree`, `C-2-separation`, `C-3-branche-a`, `C-4-retour`, `C-5-branche-b`, `C-6-ensemble` (vue d'ensemble lisible, libellés courts, parts en tête de colonne). La toile s'efface désormais avant la bande des sous-titres (aucun nœud sous un sous-titre) ; le cadrage de la caméra (`src/briques/schema-motion/cadrage.ts`) est inchangé.
- D (tri des e-mails) : `D1-chute`, `D2-sorties`, `D3-cascade`, `D4-seize-sur-vingt`.
- E (classement des documents) : `E1-avant`, `E2-volet`, `E3-apres`.
- F (saisie unique) : `F1-avant`, `F2-apres`, `F3-minuteurs`, `F4-addition`, `F5-quarante-cinq`.

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

L'ancienne `comparaison-maquette.jpg` (rendu d'avant ces corrections) est retirée : la maquette validée reste dans `../maquette-chatbot/`.

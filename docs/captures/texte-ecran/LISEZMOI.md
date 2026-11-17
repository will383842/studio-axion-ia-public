# Planche de référence du texte à l'écran (C2-U15a)

**Quoi.** 30 planches PNG des pièces du texte à l'écran déjà fusionnées sur `master`, rendues avec le vrai moteur
(`src/briques/sous-titres/`, `src/moteurs/montage-tableau/`) et le vrai calque Remotion. En 9:16 et en 16:9, sur fond clair
(`fond-clair.jpg`) et sur fond sombre. Aucune vraie vidéo, aucun réseau, aucun fournisseur, aucun son. Rien n'est allumé.

| Fichiers | Contenu |
|---|---|
| `marqueur-*` | marqueur : 3 teintes (terracotta, ivoire, ardoise) × 2 cibles (« expression », « mot dit ») — U5, U6 |
| `pave-*` | pavé : règles « forts », « chiffres », « forts et chiffres » — U7a/b |
| `outils-*` | noms d'outils : étiquette dans la ligne (U8) et étiquette autonome (U9) |
| `bandeau-nom-*` | bandeau « nom et fonction » — U10, U11 |
| `styles-*` | les 5 styles de la Bibliothèque (migration 25 inactive) — U12, U13, U14 |
| `pastille-3-textes-*` | « Pastille Axion » sur 3 phrases de `tests/briques/faits-script/dix-scripts.ts` (scripts 1, 6, 10) |
| `tableau-*` | tableau à part : fonds tableau blanc, ardoise, paperboard (bande de fond) + Pastille sur l'ardoise |
| `sortie-u19-*` | sortie animée : avant, pendant, après |
| `planche.txt` | une ligne par planche + mesures de la sortie + temps de rendu |

**Relancer** (racine du dépôt ; `npm ci` fait dans `studio-rendu/`) :
`pnpm exec tsx outils/captures-sous-titres/planche-texte-ecran.mts`
(`NAVIGATEUR=/chemin/du/chromium` si Remotion ne trouve pas de navigateur). Temps de rendu total mesuré : environ 28 à 35 s
pour les 30 planches (session de fabrication, Chromium headless, `gl: swangle`).

**Ce qui est simulé (et pourquoi).**
- *Sortie U19* : l'interrupteur `SORTIE_ACTIVE` reste éteint, le calque ne dessine donc pas le fondu. L'image « pendant » est le
  groupe passé dans l'opacité et le glissement calculés par `sortieDuGroupe` (mi-sortie : opacité 0,5, glissement 8 px à
  1 080 de large). « Avant » et « après » sont le vrai rendu.
- *Pastille* : montrée en Manrope Bold (`enManrope: true` sur une copie), la police prévue par U14 ; l'interrupteur `PASTILLE_EN_MANROPE` n'est pas touché.
- *Étiquette autonome U9* : posée par `etiquettesAutonomes(..., { actif: true })` pour la planche seulement.
- *Tableau* : la bande réservée aux sous-titres est une maquette (bas de l'image) ; couleurs, bande de fond et gabarits sont ceux du moteur.
- Sur fond sombre, la Pastille (noir) se confond avec le fond : c'est le cas que le bord gris de « Pastille Axion (ardoise) » corrige.

**Ce qui manque.** L'escalier dessiné (U20b) n'est pas encore fusionné : il sera ajouté par **C2-U15b**. Aucune vraie vidéo
n'est utilisée (textes seuls). Les planches sont montrées à Williams (règle 12) ; rien n'est mis en ligne.

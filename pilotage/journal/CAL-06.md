# CAL-06 : couleurs et pictogrammes par réseau (FAIT, à relire, 12/11/2026)
- Fait : un jeton `--res-<réseau>` pour les six réseaux (LinkedIn, Instagram, Facebook, TikTok, YouTube, YouTube Shorts) dans `:root` ET `.theme-sombre` ; `couleurs-reseaux.ts` (réseau → `var(--res-...)`) ; `PictoReseau.tsx` (picto monochrome + nom écrit) ; la carte et les filtres l'emploient.
- Point d'extension de L4-03 : `styleReseau` posait déjà `--c` depuis `--res-<réseau>`. Le liseré de la carte (`border-l` en `--c`) existait donc : seule la source du jeton passe par `couleurReseau`. Aucun composant réécrit.
- Valeurs : clair repris de la maquette (LinkedIn #0a66c2, Instagram #d6336c, Facebook #3b5bdb, TikTok #0b8f8a) et YouTube #cc0000 (fiche). YouTube Shorts reprend le rouge de YouTube (aucune valeur de maquette). Valeurs du thème sombre (éclaircies pour garder 3:1 sur le fond sombre) : choisies ici, absentes de la maquette, à confirmer.
- Carte : picto + nom du réseau à côté de l'heure. Filtres (légende) : pastille de couleur + picto + nom. Les 9 statuts sont intacts ; « Publiée » reste en contour (table libellés non touchée).
- Tests : `tests/calendrier/cal-06-couleurs.test.ts`, rouge avant (modules absents), vert après. Chaque réseau a son jeton dans les deux blocs ; libellé ≥ 4,5:1 et liseré ≥ 3:1 dans les deux thèmes ; picto et nom présents pour chaque réseau ; aucune couleur en dur dans les composants. Avec `tests/calendrier`, `couleurs-theme-seulement` et `coul-01-jetons` : 23 fichiers, 568 passés, 0 échoué.
- `tsc --noEmit` : aucune erreur nouvelle (erreurs existantes ailleurs, ex. tests/zernio et module remotion absent). `eslint` sur les fichiers touchés : aucune erreur.
- Douteux : le picto est un monogramme (pas de logo de marque) ; les valeurs sombres sont à valider.
- Reste : néant pour cette fiche.
- contrôle anti-fuite : vide

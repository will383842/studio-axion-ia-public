Lot M2 — calque Remotion des sous-titres.

- `CalqueSousTitres.tsx` : traduit la scène du moteur UNIQUE (`src/briques/sous-titres/scene.ts`) en éléments, image par image ; fond transparent (calques 7-8 du lot M4, recalque gratuit).
- `ApercuSousTitres.tsx` : captures de contrôle (`still`) sur fond noir, image claire, photo ; simulation de deutéranopie.
- `polices.ts` : Poppins ExtraBold, Poppins Medium, Montserrat Black, chargées en local (`src/briques/sous-titres/polices/`, SIL OFL 1.1).
- Style nommé « Pastille Axion » (`src/briques/sous-titres/pastille.ts`, tableau « reference/3 », ajout pur) : le calque le dessine en Inter Bold (`commune/polices.ts`) quand `donnees.pastille` est présent ; sans lui, rien ne change.

⚠️ Image Docker (lot M4) : ces fichiers importent `../../../src/briques/sous-titres/` (moteur pur, sans dépendance). Le Dockerfile de `studio-rendu` doit copier ce dossier à `/src/briques/sous-titres` (chemin relatif depuis `/app/compositions/sous-titres`).

# Carrousel continu : architecture (lot P1)

Une toile unique de N × 1080 px (hauteur 1350 en 4:5, 1440 en 3:4), découpée en N pages. Version fixe : des images, aucune vidéo. Réseaux V1 : Instagram et Facebook. Référence visuelle : `MAQUETTE-v3.html`.

## Modèle `toile/1`
`{ format: "4:5" | "3:4", pages: Page[], raccords: Raccord[] }`, de 3 à 10 pages (6 par défaut au plus).
- **Page** : objet strict `{ type, alt (≤ 125), rubrique?, … }` ; `type` désigne un gabarit (plaquette) du registre.
- **Raccord** : `{ type: "R01" | "R02" | "R03", couture, y }`, un objet posé à cheval sur une couture interne (sphère, tuile à icône, étincelle).

## Règles de la toile (`schema-toile.ts`, un seul `superRefine`, messages en français)
1. Chaque page passe le schéma de son gabarit ; type inconnu, clé inconnue, lien dans un texte : refus.
2. Une même plaquette n'est utilisée qu'une fois.
3. Deux pages sombres ne se suivent pas.
4. Un seul parcours par toile ; ses pages sont complètes, dans l'ordre et d'un seul tenant.
5. La page 1 est une couverture, sauf si un parcours qui commence l'ouvre.
6. Un raccord se pose sur une couture interne (1 à N-1), jamais sur une couture interne à un parcours, un seul par couture.

## Versions
`VERSION_TOILE_SOCLE` (`src/domaine/visuels/continu/version.ts`, `toile-continue/0`) et le champ `version` de chaque gabarit. `VERSION_RENDU` et `VERSION_COMPOSITION` du carrousel classique ne bougent pas. `validerProprietesToile` refuse un socle ou une version de gabarit différents (message « Version de toile… »). L'empreinte (`empreinte.ts`) combine le socle, les versions utilisées et la toile canonique (`canonique.ts`, copie locale pour que le domaine ne dépende pas des services).

## Registres (`src/briques/visuels/continu/`)
- `registre-gabarits.ts` : `GABARITS` = familles (`familles/*.ts`, vides en P1), gabarits d'essai `X00` (couverture), `X01` (contenu), `X02` (appel), et pages de parcours. `GABARITS_PRODUCTION` = actifs et hors essai.
- `registre-parcours.ts` : parcours de 3 ou 4 pages ; `PX` (essai) en P1.
- `registre-raccords.ts` : `R01`, `R02`, `R03`.

## Charte et polices
`CHARTE_CONTINU`, `alpha`, `degrade`, `DEGRADES_CONTINU` dans `charte-carrousel.ts` (seul endroit où les couleurs littérales sont permises). Polices OFL dans `studio-rendu/compositions/commune/polices/` : Bricolage Grotesque (variable), Instrument Serif (romain et italique).

## Sécurité de lecture
Texte ≥ 26 px mesuré, marge sûre 80 px, rien d'important dans le coin bas droit 200 × 200 px de chaque page, orange seulement en grands titres, vouvoiement.

## Modèle de données
`Visuel.famille` accepte `"carrousel-continu"` ; `toile?` et `renduToile?` (empreinte, format, clés des pages, bande, vignette) portent la toile et son rendu. Rien n'est rendu en P1.

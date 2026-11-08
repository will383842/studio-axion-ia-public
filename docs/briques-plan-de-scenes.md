# Plan de scènes (lot C)

Socle du motion composé par l'IA et de la future retouche par chat. Code : `src/briques/plan-scenes/`, rendu : composition Remotion `PlanDeScenes`.

## Le schéma (`schema.ts`)

Un plan (`version: "plan-scenes-1"`) : format (25 i/s), face caméra oui/non, durée, habillage (`fond` ivoire|noir, `accent` terracotta|orange), minutage des mots, et des **scènes** :

| champ | rôle |
|---|---|
| `id`, `version`, `empreinte` | identité ; l'empreinte (FNV-1a 64 bits du contenu, `empreinte.ts`) change seulement si la scène change → `scenesARerendre(ancien, nouveau)` |
| `mots: {premier, dernier}` | mots du script couverts ; `debutMs` = début du premier mot, `finMs` ≥ fin du dernier |
| `niveau` | 1 pièce en stock · 2 composition de `calques` choisie par l'IA · 3 code libre (désactivé : `CODE_LIBRE_ACTIF = false`) |
| `piece` + `parametres` | pièce du catalogue, paramètres typés (toujours présents : repli des niveaux 2 et 3) |
| `calques` | niveau 2 : pièces posées dans une sous-zone, décalées de `debutMs` ; un calque `zoom-camera` agrandit les autres |
| `texte` | texte à l'écran (étiquette en haut) |
| `position` | haut, centre, bas, plein, gauche, droite ; en face caméra, jamais sur la zone du visage (`zones.ts`) |
| `transition` | fondu, glisse-haut, glisse-gauche, zoom-doux ; 200 à 800 ms |

`schemaPlanBrut` (souple) lit ce que renvoie le LLM ; `schemaPlanStrict` décrit le plan rendable.

## Le validateur (`validateur.ts`)

`validerPlan(brut, contexte)` ne refuse jamais : il renvoie le plan réparé et des **remarques** (`code`, `sceneId`, phrase). Recalage sur les mots, chevauchements, pièce inconnue → pièce la plus proche (alias, sinon chiffre → carte KPI, sinon légende), paramètres réparés champ par champ, couleurs hors charte et polices autres que Manrope retirées, orange sur fond clair → terracotta, face caméra → « bas », niveau 3 → 2, niveau 2 sans calque valide → niveau 1. Entrée illisible → plan de repli (une scène par phrase).

## Le générateur (`generateur.ts`)

`genererPlan(entree, appeler)` : consigne figée (catalogue + charte, cache 1 h), modèle `MODELE_PLAN_SCENES = "claude-opus-5-5"`, JSON demandé et validé. Fournisseur injecté (`AppelClaude`) : un faux dans les tests ; aucun appel réel dans ce lot. Sortie illisible → second essai avec le motif, puis plan de repli ; panne → plan de repli. **À faire avant usage réel** : brancher le fournisseur par `executerRole` / `services/generation-claude.ts` (pré-vol et réservation des crédits ; `envoyerMessage` n'est appelé que par `executerRole`, garde de `tests/v4-argent.test.ts`).

## Le catalogue (`catalogue.ts`, rendus dans `briques/`)

Curseur · Zoom caméra · Frappe au clavier · Carte KPI · Graphique · Tableau de bord · Liste/CRM · Fenêtre d'app · Bulle de chat · Légende.
Chaque brique est un composant **pur** (l'image courante arrive en propriété, aucun hook : même entrée = même image), aux couleurs de `src/briques/jetons-motion.ts` (module provisoire, remplacé par `charte/axion-2026.ts` du lot B), Manrope seule, mouvement doux sans rebond (`adoucir`, `decelerer`).

## Ajouter une brique

1. `catalogue.ts` : son schéma Zod (`z.strictObject`), une entrée dans `CATALOGUE_BRIQUES` (nom, description pour l'IA, famille, alias, exemple valide).
2. `toiles.ts` : sa taille de dessin.
3. `briques/MaBrique.tsx` : composant pur `ProprietesBrique<ParametresPiece<"ma-brique">>`, couleurs via `palette(fond, accent)` ; l'inscrire dans `briques/index.ts`.
4. Les tests du catalogue (`tests/briques/plan-scenes/catalogue.test.ts`) la vérifient d'office (déterminisme, charte, police).

## Démo

`cd studio-rendu && STUDIO_RENDU_NAVIGATEUR=<chrome> npx tsx scripts/demo-plan-scenes.ts --images` → `out/plan-de-scenes-demo.mp4` (15 s, 3 scènes : niveau 1, niveau 2, niveau 1).

## Retouche (préparée, non implémentée)

`src/briques/operations.ts` : `changer-mot`, `ajouter-chiffre`, `changer-brique`, `decaler-scene`, `changer-habillage`.

## Option sur les générateurs existants (lot R2)

Cas concret, Facecam et Facecam animée peuvent utiliser le plan de scènes pour leurs scènes d'**interface, de chiffres et d'accents** (légendes de 5 mots au plus) ; le reste (sous-titres, cartes, légendes longues) reste à l'existant.

- **Réglages, tous ÉTEINTS par défaut** (allumés seulement par la valeur `true`) : `planScenes.casConcret`, `planScenes.facecam`, `planScenes.facecamAnimee` (`briques/plan-scenes-generateurs/reglage.ts`). Éteint : aucune propriété ajoutée, rien ne change à l'écran ni dans les empreintes de rendu.
- **Adaptateur** (`briques/plan-scenes-generateurs/adaptateur.ts`) : script + segments calés → `PlanValide`. Niveau 1 : pièces du stock d'après le texte ; niveau 2 : `genererPlan` avec le fournisseur injecté ; repli d'un niveau **par scène** ; niveau 3 interdit. Jamais de refus : des remarques.
- **Calque Remotion** (`studio-rendu/compositions/plan-scenes/CalquePlanScenes.tsx`) posé par-dessus la composition existante, fond transparent, seulement si la propriété optionnelle `planScenes` est présente.
- **Empreintes par scène** : Cas concret : une tranche du plan par écran (`tranche.ts`), donc seul un écran dont les scènes changent est rendu à nouveau ; plan gardé au journal (l'IA n'est pas rappelée à la reprise). Facecam et Facecam animée : plan gardé dans l'état de la chaîne, `scenesARerendre` pour la retouche.
- **À faire avant usage réel du niveau 2** : brancher le fournisseur par `executerRole` (comme le lot C). Allumé aujourd'hui, le réglage donne les pièces du stock (niveau 1).

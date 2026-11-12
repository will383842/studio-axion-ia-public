# Services reliés en euros (Réglages)

Les champs d'argent de la rubrique « Services reliés » se saisissent et s'affichent en € (format français). Le stockage (centimes de dollar), les actions serveur et toutes les conditions de blocage (0–1 000 $, 0,01–10 000) sont inchangés : la conversion se fait côté écran, euros → dollars arrondi au centime, avant l'appel aux actions.

## Fichiers
- `src/components/reglages/montants-euros.ts` (nouveau, pur) + `montants-euros.test.ts` (aller-retour, arrondi, saisie française).
- `Credits.tsx` : « Montant (€) », suffixe €. `CreditClaude.tsx` : « Crédit du cycle (€) », « Solde relevé dans la Console (€) ». `ChoixChaineEcriture.tsx` : « ≈ 0,25 € par script » (0,28 $ converti).
- `src/app/(studio)/reglages/page.tsx` : lit le réglage `taux.usdEur` et le passe aux trois composants.
- `tests/reglages-chaine-ecriture.test.ts` : attend « 0,25 € ».

## Taux — à confirmer par Williams
Un réglage existe déjà : `taux.usdEur` (€ pour 1 $, modifiable dans Réglages > Budget), défaut `TAUX_USD_EUR_PAR_DEFAUT` = 0,9 (`src/lib/montants.ts`). Je l'utilise, avec `TAUX_EUR_PAR_USD` comme repli documenté si le réglage est absent/invalide. Williams doit confirmer que 0,9 est bien le taux voulu.

## Vérifications
- `npx tsc --noEmit -p .` : aucune erreur dans les fichiers touchés (reglages, montants-euros). Erreurs restantes sans rapport : `remotion` absent (docs/…prototypes) et type `RouteContext` des routes API (types Next générés absents).
- Tests : `src/components/reglages` + `tests/reglages-chaine-ecriture`, `sans-prix-credits`, `chiffres-ecrans`, `source-claude/*` : 14 fichiers, 208 tests verts.

## Points laissés
- `actions-credit-claude.ts` est en réalité dans `src/app/(studio)/reglages/` : non modifié (messages d'erreur « 1 000 $ » / « 10 000 » encore en dollars/sans devise, car conditions de blocage inchangées).
- « Expirations : 20,00 $ » (cartes Credits, `services/credits.ts`, zone interdite) reste en dollars.
- `node_modules` installé sans lockfile pour lancer les tests ; rien committé.

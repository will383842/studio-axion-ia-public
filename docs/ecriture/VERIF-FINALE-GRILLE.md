# Vérification finale · grille « Scripts exceptionnels »

Document de vérification (lecture seule, 18/10/2026). Il ne change aucun code de production. Les tests de contrat
gratuits sont dans `tests/verif-finale/grille.test.ts` (`pnpm vitest run tests/verif-finale`).

Légende : ✅ prouvé par un test existant (cité) · 🟡 présent dans le code sans test dédié · ❌ absent.
Quand la ligne a été couverte par un test ajouté ici, il est noté **[VF]** (`tests/verif-finale/grille.test.ts`).

## 0. Écarts entre la mission et master (à lire d'abord)

Écart : **0**. Master porte le lot A (#499) : les fichiers cités par la mission existent.

| Fichier cité dans la mission | Réalité sur master |
|---|---|
| `src/donnees/generateur/recette-script.ts` | **Existe** : `RECETTE_SCRIPT` (8 éléments, n° 7 « Rupture « on s'en occupe pour vous » »), `MOTIF_RUPTURE`, `ruptureDite`, limites de phrases / questions / mots à l'écran. Lue par `src/generateur/chaine-courte.ts`. |
| `src/domaine/positionnement.ts` | **Existe** (`faitLeVousMeme`, `NOUVEAUTE_OUTIL`, `tutoriel`…). Les règles PO-01 à PO-04 du socle restent dans `src/domaine/qualite-script/regles/positionnement.ts`. |
| `src/domaine/debit-voix.ts` | **Existe** : cible 2,75 mots/s (+ 10 % de tolérance), `plafondMotsParSec`, `motsParSecondeMesures`. Lu par `recette-script.ts`, `src/briques/declinaison/index.ts` et `src/domaine/duree-tableau.ts` : **branché** sur le débit du tableau (lot B2). |
| `src/domaine/controles-script/recette.ts` | **Existe** : C96-C99 (tutoriel, question, fin qui redit l'accroche, rupture) ; C95 (positionnement) est dans `positionnement.ts`. |
| `src/generateur/chaine-courte.ts`, `src/reseaux/ecriture.ts` | Existent. |

**Débit.** 2,75 mots/s est la cible de la chaîne courte et du tableau (`DEBIT_CIBLE_MOTS_PAR_SEC`, `src/domaine/debit-voix.ts`) ; le module
est branché sur le tableau (`duree-tableau.ts`). L'image → vidéo garde sa constante recalibrée : **3,4 mots/s** (`DEBIT_MOTS_PAR_SEC`,
`src/domaine/image-video/complexite.ts:14`). Les autres : face caméra 2,9 (`DEBITS_PAR_DEFAUT.teleprompteur`, `src/formats/familles/index.ts:32`),
avocat 4,5 (`DEBIT_AVATAR_MESURE_AVOCATREF`), cas concret 3,4 en estimation (`formatCasConcret`), mais depuis B3 (#558) le plafond de 5 s d'un écran estimé se juge au débit prudent de 3,0 mots/s, soit 15 mots dits par écran au plus (`DEBIT_ECRAN_PRUDENT`, `MOTS_ECRAN_MAX`, `src/moteurs/montage-cas-concret/regles.ts`), tableau en caractères/s (`CARACTERES_PAR_SECONDE_TABLEAU` = 16,9, une CIBLE à mesurer sur la 1re vraie vidéo, plus 19,7 ;
`src/domaine/duree-tableau.ts`).

**Mémoire anti-copie.** Branchée pour le central (`ecriture.memoireCentrale`), le tableau (`ecriture.memoireTableau`) et le cas concret
(`ecriture.memoireCasConcret`), mais les réglages sont **coupés** par défaut : tant que Will ne les allume pas, rien n'est lu ni écrit.
**Face caméra** (chaîne courte) : elle LIT bien la recette commune. **Face caméra animée** : `tests/generateur/facecam-animee-recette.test.ts` ne prouve que la recette ; sa mémoire n'est pas branchée (exception « aucun importeur à ce jour », `contrat-format.ts`).

**Recette en 8 éléments** : écrite telle quelle dans `RECETTE_SCRIPT` : hook, douleur, question, promesse, une idée, preuve, rupture (n° 7), appel.
La chaîne courte la cite dans la consigne du rôle « script ». Les fonctions minimales du socle (accroche, tension, valeur, preuve, promesse, gain tôt,
relance, demande : `FONCTIONS_MINIMALES`, `rapport.ts`) restent un autre contrôle, côté qualité.

## 1. Partie centrale (commune à tous les générateurs)

| # | Point à vérifier | Code qui le réalise | État |
|---|---|---|---|
| 1 | Recette en 8 éléments (hook, douleur, question, promesse, une idée, preuve, rupture, appel) | `src/donnees/generateur/recette-script.ts` `RECETTE_SCRIPT` ; `chaine-courte.ts` ; contrôles `controles-script/recette.ts` ; fonctions minimales `rapport.ts` | ✅ `tests/donnees/recette-script.test.ts`, `tests/domaine/controles-recette.test.ts` (C95-C99), **[VF]** ; fonctions minimales ✅ `tests/qualite-script/regles.test.ts`, `tests/qualite-script/bancs.test.ts` |
| 2 | Rupture « on s'en occupe pour vous » (élément n° 7) | `RECETTE_SCRIPT` point 7, `MOTIF_RUPTURE`, `ruptureDite` ; contrôle C99 ; consigne `REGLES_WILL` | ✅ `tests/domaine/controles-recette.test.ts` (rupture, C99), **[VF]** (`ruptureDite` vrai / faux) |
| 3 | Positionnement : jamais « faites-le vous-même » en conclusion | `regles/positionnement.ts` PO-01 (`faitLeVousMeme`) ; consigne `REGLES_WILL` | ✅ `tests/qualite-script/regles.test.ts`, `bancs.test.ts`, **[VF]** |
| 4 | Pas d'annonce d'outil | PO-02 `NOUVEAUTE_OUTIL` ; `ANNONCES_OUTIL_WILL` | ✅ `tests/qualite-script/regles-will-ecran.test.ts`, `tests/qualite-script/socle.test.ts` (bibliothèque d'accroches), **[VF]** (chaque gabarit d'accroche passe `NOUVEAUTE_OUTIL` et `faitLeVousMeme`) |
| 5 | Débit déclaré par recette ; cible 2,75 mots/s | `recettes/*.ts`, `domaine/debit-voix.ts`, `RECETTE_SCRIPT` (plafond) | ✅ `tests/debit-voix/debit-voix.test.ts`, `tests/image-video/rythme-voix-longues.test.ts` ; **[VF]** (plage 2,5-4,6 ; image→vidéo 3,4 ; tableau 16,9 car/s cible ; facecam 2,9) |
| 6 | Densité (phrase longue 14/22 mots = règle RT-01 de `regles/retention.ts`, mots écrits) | `seuils.ts` `SEUILS_COMMUNS`, `regles/retention.ts`, `regles/forme.ts` | ✅ `tests/qualite-script/calibrage.test.ts` ; **[VF]** (RT-01 en écart) |
| 7 | Redite (identique / proche / idée / remplissage) | `repetitions.ts` `trouverRepetitions`, RP-01 | ✅ `tests/qualite-script/repetitions.test.ts`, `tests/generateur/chaine-courte-quasi-repetitions.test.ts` |
| 8 | Script collé par Will pris à l'identique (origine « will ») | `relecture-generateur.ts` (`ecritPar: "will"`, `controlerSelonAuteurs`), `controles-script/niveaux.ts` (barème will) ; import collé : mots jamais réécrits | ✅ `tests/c3-decoupage-colle.test.ts` (« jamais un mot réécrit ») ; ✅ barème will **[VF]** (`controlerSelonAuteurs` sur une ligne `ecritPar: "will"` ; Will jamais plus sévère que machine), `tests/relecture-generateur.test.ts` ; ✅ `tests/banc-ecriture/banc.test.ts` (origine will) |
| 9 | Voyant rouge | `rapport.ts` `voyantDe` ; `note.ts` `voyant` | ✅ `tests/qualite-script/socle.test.ts` (« voyant : rouge si… »), `calibrage.test.ts` ; **[VF]** |
| 10 | Mémoire anti-copie | cas concret : `domaine/cas-concret-variete.ts`, `services/cas-concret-scripts.ts` `scriptsDejaEcrits` | ✅ cas concret `tests/cas-concret/variete-scripts/*.test.ts` ; ❌ autres générateurs (branchement C2-C4, it.todo **[VF]**) |
| 11 | Adaptation au réseau | `reseaux/ecriture.ts` `ECRITURE_RESEAUX`, `seuils.ts` `APPELS_PAR_RESEAU`, `chaine-courte.ts` `appelImposeCourt` / `reseauxDe` | ✅ `socle.test.ts` (appels), `tests/g1a-donnees-pures.test.ts`, `tests/g4-chaine.test.ts` ; **[VF]** (YouTube sans « commentez », PR-03) |
| 12 | Absence de « Villeexemple » | `controles-script/style.ts` C42, `regles/interdits.ts`, `scripts-tableau-controles.ts`, `montage-cas-concret/regles.ts`, `montage-image-video/regles.ts` | ✅ `socle.test.ts` (liste des 4 écrivains) ; **[VF]** (4 écrivains + données d'écriture sans l'expression) |
| 13 | Absence de « Aucun gain garanti » | mêmes fichiers | ✅ idem ; **[VF]** |
| 14 | Mode observation (aucun blocage de plus) | `qualite-script/index.ts` `MODE_SOCLE` | ✅ `socle.test.ts` (« même un script plein de défauts ne produit aucune pastille bloquante ») |

Remarque : « Villeexemple » apparaît dans `1-cibles.json` seulement dans des URL de sources (nom de ville retiré du texte) ; la base les interdit (`8-voix-et-interdits.json`).

## 2. Par générateur

Chaque générateur hérite des points 3-14 via sa recette (`recettes/*.ts`) : un test **[VF]** applique PO-01 aux cinq recettes.

| Point | Central (courte / équipe) | Face caméra / animée | Tableau | Cas concret | Image → vidéo |
|---|---|---|---|---|---|
| Recette 8 éléments | ✅ chaîne courte (`chaine-courte.ts` lit `RECETTE_SCRIPT`) ; équipe ❌ | face caméra ✅ lit la recette commune via la chaîne courte ; animée 🟡 recette seulement (`tests/generateur/facecam-animee-recette.test.ts`), pas la mémoire | 🟡 partielle : éléments 3 à 7 (`RECETTE_SANS_DEBIT`, `src/services/tableau-scripts/consignes.ts`), **[VF]** | ❌ recette commune non branchée : garde ses règles R01+ et son propre écrivain | ❌ gelé |
| Positionnement | ✅ `REGLES_WILL` dans les 2 chaînes (`tests/generateur/chaine-courte-regles-will.test.ts`) | ✅ recette `ecrire-facecam` + **[VF]** | ✅ `bancs.test.ts` (témoin) + **[VF]** | ✅ banc v4 + **[VF]** | ✅ **[VF]** |
| Débit | ✅ 2,75 mots/s (plafond lu par `RECETTE_SCRIPT`) | ✅ 2,9 mots/s **[VF]** | ✅ 2,75 mots/s, `debit-voix` branché ; 16,9 car/s (cible à mesurer) **[VF]** | 🟡→**[VF]** 3,4 en estimation ; plafond d'écran au débit prudent 3,0 / 15 mots (B3, #558) | ✅ 3,4 **[VF]** |
| Redite | ✅ | ✅ (socle) | ✅ (socle) | ✅ (socle) | ✅ (socle) |
| Script de Will à l'identique | ✅ banc | 🟡 | 🟡 | ✅ scripts validés | 🟡 |
| Voyant rouge | ✅ | ✅ | ✅ | ✅ | ✅ (tous via `voyantDe`) |
| Mémoire anti-copie | ✅ branchée, réglage COUPÉ (`ecriture.memoireCentrale`) | face caméra ✅ via la chaîne courte, réglage COUPÉ ; animée ❌ aucun importeur | ✅ branchée, réglage COUPÉ (`ecriture.memoireTableau`) | ✅ branchée, réglage COUPÉ (`ecriture.memoireCasConcret`) | ❌ (C2-C4) |
| Adaptation réseau | ✅ `appelImposeCourt` | 🟡 | 🟡 | 🟡 | ✅ question sauf LinkedIn (`socle.test.ts` adaptateurs) |
| Sans Villeexemple / gain garanti | ✅ | ✅ `tests/facecam-animee/mots-interdits-ecran.test.ts` | ✅ | ✅ | ✅ |

## 3. En attente (`it.todo`) et exceptions assumées

Mise à jour de fin de chantier : les lots C2-C4 (#537, #538, #540), D (#508), E (#509), B2 (débit) et B3 (#558) sont dans master. Leurs points
sont de vrais tests gratuits dans `tests/verif-finale/grille.test.ts`, dont la lecture partielle de la recette par le tableau.
Restent en `it.todo` : le cas concret et l'équipe (recette commune non branchée), l'image → vidéo (gelé), et la voix réelle du tableau
(appel payant). Calibrage des contrôles : `CALIBRAGE-COMPREHENSION-2026-10-19.md`.

### Exceptions assumées en fin de chantier

- **Cas concret** : garde ses règles R01+ et son propre écrivain ; la recette commune n'y est pas branchée (exception datée, `contrat-format.ts`).
- **Face caméra animée** : sans mémoire commune (aucun importeur à ce jour) ; seule la recette est prouvée.
- **Grande chaîne et équipe (face caméra)** : sans recette commune. Décision D10 : leur suppression est à demander à Will.
- **Image → vidéo** : gelé.
- **Avocat** : hors recette, hors contrat (décision de Will).
- **Débit mesuré** non relevé (`debitMesure: false`) : les exceptions correspondantes expirent le 31/12/2026 (`contrat-format.ts` ~l.96).
- **Contrôles C96-C99** : encore en alerte (`src/domaine/controles-script/niveaux.ts` ~l.138-141) ; D4 non soldé.
- **LinkedIn** : encore produit en 4:5 (`src/reseaux/index.ts:92`, `src/reseaux/sorties.ts:118-140`, `src/briques/declinaison/index.ts:63`), contre la décision 9:16 en attente.

## 4. Décisions de Will (tranchées par le lot A)

1. Débit : 2,75 mots/s pour la chaîne courte et le tableau (`debit-voix.ts`) ; l'image → vidéo (3,4), la face caméra (2,9) et l'avocat gardent le leur.
2. Le module `recette-script.ts` des 8 éléments existe, avec « on s'en occupe pour vous » en élément n° 7 explicite.

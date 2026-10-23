# Générateur de scripts : relevé du lot G4 (chaîne et écrans), 03/10/2026

Plan : `11-PLAN-FINAL-GENERATEUR-v5.md` (B.3, B.4, B.5.2, B.7.3, B.7.4, B.10 ligne G4) ; l'addendum du 02/10 prime
(§2, §2 bis à §2 sexies, ordres de Will du 03/10). Banc réel : (rapport de banc non publié).

## Livré

| Fichier | Rôle |
|---|---|
| `src/generateur/roles/*.ts` | 9 rôles versionnés (stratège, fond, accroches, juge, plan, prose, préférence, réécriture, déclinaison) : évaluations écrites AVANT la consigne, consigne courte, schéma zod accepté par la sortie structurée, simulation sans clé ; `questions.ts` (juges, dont PROB-01 et REC-01) ; `commun.ts` (rien d'inventé, problème douloureux, récit du VRAI cas client, reconnaissance, ton oral, liste anti-texte IA) |
| `src/generateur/contexte.ts` | Les 4 blocs en cache (ordre figé) et la partie variable ; matières anonymisées, nombres non prouvés signalés (`chiffres-non-prouves`) |
| `src/generateur/etape-zero.ts` | Étape 0 gratuite : domaine d'Axion-IA (arrêt `HORS_DOMAINE`), choix conjoint, diversité |
| `src/generateur/chaine.ts` | Étapes 1 à 12, état rendu après chaque étape (reprise sans double paiement), aucune prose avant un plan validé, réparation du plan sans appel, deux corps et PREF-01, réécriture ciblée (raccourcir seulement), déclinaisons en parallèle, corrections automatiques, rejugement, téléprompteur et trame par le code ; `redeclinerVersion` |
| `src/services/boucle-generation.ts` | `lancerGeneration`, boucle (son drapeau, hors file `Travail`), rangement (étape 13), `completerSujet`, `validerException`, `choisirAngle`, `choisirAccroches`, `ajouterDeclinaison`, `regenererVariante`, `enregistrerRetouche`, `validerVariantes`, `fabriquerVariante` (intérim, opération idempotente), `etatEcriture` |
| `src/domaine/controles-script/probleme.ts`, `diversite.ts` | C77-C83 (problème, coût avant 5 s, issue, série douleur, récit, reconnaissance, faux témoignage) ; C84-C88 (ouvertures, récit, fins, expressions, ruptures) et consignes de diversité |
| `src/donnees/generateur/domaine-axion.ts`, `modeles-avocatref.ts`, `publication-reseaux.ts` | Piliers = activités réelles d'Axion (proposés, migration idempotente), cadre « style, jamais droit » ; extraits réels de l'avocat de référence (données) ; champs de publication par réseau |
| Écrans | Fiche sujet : écran d'attente et pause « je choisis » (`EcritureEnCours`), retouches avec prix, « Je lis » + page « Lire sur un autre appareil », trame, avis des juges, « Fabriquer » avec feuille ; Sujet branché sur la chaîne ; l'ancienne génération de l'assistant renvoie vers le générateur |
| `docs/correctifs/G4-instrumentation-boucle-generation.patch` | Démarrage de la boucle dans `instrumentation.ts` (fichier partagé, NON posé ; la boucle démarre au lancement et à l'ouverture d'une fiche) |
| `outils/generateur/banc-g4.mts`, `exporter-fixtures-g4.mts`, `captures-g4.mjs` | Banc réel à budget borné, fixtures anonymisées (51), captures 390 px (`docs/captures/g4/`) |

## Écarts au plan (et pourquoi)

1. Effort `medium` pour le stratège, le fond et les accroches (coût mesuré : 0,20 $ par appel d'accroches en `high`) ; plan et prose restent en `high` (en `medium`, plans tronqués).
2. Juges : 1 tirage par défaut (variance nulle mesurée en G0).
3. Débit d'écriture du double 4,5 mots/s et corps maximal 30 s (mesures l'avocat de référence, ordre de Will du 03/10).
4. `fournisseurs/index.ts` et `instrumentation.ts` non touchés (correctifs préparés).
5. Course corrigée : les appels parallèles d'une même génération écrasaient le journal des étapes (`generation-claude.ts`).
6. C37 ne prend plus « ne vérifie rien » pour un label ; `libelleManque` écrit la virgule décimale.

## Reste ouvert

Voir « Défauts restants » et « Ce que Will doit fournir » du rapport du banc. Le 3e sujet (cas client fictif, récit) n'a
tourné qu'en simulation ; la note à l'aveugle (53,8 au mieux) reste loin de 85.

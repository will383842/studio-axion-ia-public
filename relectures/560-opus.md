# Relecture PR 560 : cibles d'essai par compte (zone publication Zernio)

**VERDICT : À CORRIGER** (un seul point, gravité faible, échec fermé ; tout le reste est OK)

1. `src/services/parcours-conversation.ts:741-749`, appelée en `:770` (M1) et `:822` (renvoi). Gravité **faible**. `cibleEstEssaiAujourdhui` relit le catalogue **même quand PARCOURS_ESSAI_COMPTES est absente, vide ou mal formée**. La seule exception est GUIDE avec `guide-ia`. En plus, une erreur de lecture renvoie `true` (`catch { return true; }`). Le comportement n'est donc pas strictement identique à master pour tous les comptes :
   - **Lecture en plus.** Une conversation d'un mot autre que GUIDE fait 5 lectures du catalogue au lieu de 4 sur master (mesuré par une sonde).
   - **Erreur de lecture.** Si cette lecture en plus échoue, une cible **normale** reçoit un M1 sans lien. Le code de repli est alors `cible_essai`, qui est faux, et l'alerte cloche est supprimée (`:1023`). Master envoie le lien. Une sonde l'a montré, avec la variable vide et un échec forcé à la 5e lecture : M1 sans `?j=`.
   - **GUIDE lié à un autre code.** En mode « plusieurs mots », un GUIDE lié à un code du catalogue autre que `guide-ia` dont la cible passe en `test` après la création ne reçoit plus de lien, alors que master en envoie un. Ce contrôle passe aussi avant `parcoursLienGuideActif`, donc le journal affiche `cible_essai` au lieu de `lien_eteint`, qui ne journalise rien.
   - **Pourquoi la gravité est faible.** Tout reste du côté sûr (jamais de lien de trop). Pour les mots autres que GUIDE, la garde relit déjà la cible du jour juste avant. GUIDE `guide-ia`, le cas de la production, ne bouge pas.
   - **Correctif proposé.** Dans `cibleEstEssaiAujourdhui`, renvoyer `false` sans rien lire quand `!essaiActif(env)`, et limiter le `catch → true` à ce même cas. On retrouve alors exactement master quand la variable est éteinte, et l'essai garde son échec fermé.

## Points vérifiés

- **(a) Variable absente, vide, mal formée ou « * » : FAILLE faible, voir le point 1.** Sur le chemin nominal, tout est identique à master. J'ai testé 13 variantes de la variable : absente, vide, blancs, « , », « * », « compte,* », « ; », 4 comptes, compte en 4e position, casse différente, espace interne, entrée vide, compte non listé. Pour chacune, un mot normal et GUIDE reçoivent un lien `?j=`, et le mot d'essai est écarté (`ecarte/cible_inconnue`). Le test S9 de la PR montre que GUIDE ne lit jamais la variable. `guidesDuCatalogue` sans compte : la liste est inchangée.
- **(b) 4e compte, compte non listé, casse, espaces, Instagram : OK.** Au-delà de 3 comptes, ou si une entrée est mal formée, toute la liste est refusée (`cibles-essai.ts:21-23`). La comparaison du compte est exacte (`includes`), donc sensible à la casse. Les blancs **autour** d'une entrée sont ignorés, comme le documente le code (`" id "` est accepté), mais un espace interne est refusé. Instagram est refusé partout : `cibleEssaiPermise` exige `facebook`, `preparer` garde `cible_test` et `validationPourEnvoi` répond `instagram_pas_encore`. Les tests de la PR S2, S5 et validation:83/108/142 le couvrent aussi.
- **(c) Fuite de jeton ou de lien : OK.** `preparerM1` sort en `repli("cible_essai")` avant `lireSecretLien` et `creerJetonLien`. `preparerRenvoi` renvoie `impossible` avant le secret. Le seul autre générateur de lien, `a-traiter-copie.ts`, ne sert qu'à LinkedIn et n'est pas touché. Le test S10 confirme qu'il n'y a ni `?j=`, ni secret, ni adresse dans la base et la console. Sonde avec espaces autour du compte listé : M1 sans `?j=`.
- **(d) Diff : OK.** Exactement les 10 fichiers attendus, 626 lignes ajoutées et 17 supprimées.
- **(e) Tests, tsc, eslint : OK.**
  - `scripts/echecs-connus.json` est inchangé et aucun test existant n'est modifié : le diff ne touche que les 3 nouveaux fichiers `tests/zernio/cibles-essai-*`.
  - Tests : sur les 86 fichiers de tests liés aux modules touchés, branche et master donnent le même résultat, 1691 tests dont 1684 passés et 0 échec.
  - tsc : 146 erreurs déjà présentes sur master, identiques par fichier sur la branche, aucune dans les fichiers modifiés.
  - eslint : 0 erreur sur les 8 `.ts` modifiés.
  - CI de la tête 6239a1b : 9 contrôles sur 9 verts.
- **(f) Aucun nom de personne : OK.** Rien dans les lignes ajoutées ni dans les messages de commit.

Les sondes ont été jetées et ne sont pas poussées.

# Relecture PR 501 (ATR-01), seconde passe : OK

Branche `usine/ATR-01`, tête `50a20de2` (avant : `01565bbf`), relue le 14/11/2026 en lecture seule. Verdict précédent : `relecture/501-opus:relectures/501-opus.md` (À CORRIGER).

**Verdict : OK, fusion possible.** Les 4 points bloquants de la première relecture sont corrigés et vérifiés par des sondes et des mutations rejouées. Il reste 3 points non bloquants (plus bas). La fonction n'est appelée nulle part : la fusion est sans effet tant que L7-26 et RC-40 ne sont pas branchés.

## Les 4 points bloquants : corrigés
1. **Opposition douteuse : aucune carte** (`src/services/a-traiter-entree.ts:92-94`). `classerOpposition` est appliquée au mot **et** au texte. « opposition » donne la raison `opposition`, tout autre résultat que « non » donne la raison `opposition_douteuse`. Le contrôle a lieu avant le registre et avant la file. Sondes (registre qui répond `false`) :

   | Entrée | Dans `texte` | Dans `mot` | Registre lu / écritures |
   |---|---|---|---|
   | « GUIDE stop » | `opposition_douteuse` | `opposition_douteuse` | 0 / 0 |
   | « stop GUIDE merci » | `opposition_douteuse` | `opposition_douteuse` | 0 / 0 |
   | « ne m'écrivez plus GUIDE » | `opposition_douteuse` | `opposition_douteuse` | 0 / 0 |

   Tests : `tests/a-traiter/atr-01-entree.test.ts:107-115` (les 3 textes, avec la raison exacte).
2. **`idContact` manquant : aucune carte, registre non lu** (`a-traiter-entree.ts:99`). Sondes `null`, `undefined` et `""` avec un registre qui répond `true` : `contact_inconnu`, registre lu 0 fois, 0 écriture. Test : `atr-01-entree.test.ts:124-133` (il compte les lectures du registre).
3. **Tests séparés pour « stop »** : texte « stop » avec le mot GUIDE (`:93-98`), puis mot STOP avec un texte neutre (`:100-105`). M1 (on retire le contrôle du texte) est **tuée** (4 échecs). M2 (on retire le contrôle du mot) est **tuée** (1 échec).
4. **Journal** (`pilotage/journal/ATR-01.md:7-9`) : la liste des mutations correspond à ce que j'ai rejoué, et l'ancienne affirmation fausse est corrigée explicitement. Il reste une phrase imprécise aux lignes 5-6 (voir les points non bloquants).

## Mutations rejouées (19 ; fichier restauré à l'identique ensuite)
Tuées : texte retiré (M1), mot retiré (M2), doute limité au mot, doute retiré, doute reclassé en `opposition`, contrôle `idContact` retiré, registre lu sans `idContact`, `idContact` contrôlé après le registre, registre ignoré, dédoublonnage retiré, `RE_MOT` retiré, `RE_ID` retiré, troncature retirée, filtre des hôtes retiré, sous-domaine sans le point (`faux-tiktok.com`), https non exigé, e-mail conservé, pseudo conservé. Les 4 survivantes de la première passe (M11 à M14) sont maintenant tuées.
**Survivante** : on limite le doute au **texte** seulement (le doute sur le **mot** disparaît). Voir le point non bloquant 1.

## Contrôles
- `vitest run tests/a-traiter` : **21/21 verts**. `eslint` sur les 2 fichiers : propre. `tsc --noEmit` : aucune erreur sur ces fichiers.
- Garde `outils/gardes/zone-interdite.mjs --base origin/master --branche usine/ATR-01` : **verte** (3 fichiers contrôlés). Elle émet un avertissement : `pilotage/autorises/ATR-01.json` est absent de master. Contrôle manuel fait : le diff `origin/master...origin/usine/ATR-01` touche seulement `src/services/a-traiter-entree.ts`, `tests/a-traiter/atr-01-entree.test.ts` et `pilotage/journal/ATR-01.md`. Le commit de fusion `33d2a3ca` n'ajoute rien d'autre.
- Aucune écriture vers un réseau : le module a un seul import, `@/domaine/guide-reseau/opposition` (fonction pure). `PortsEntree` n'expose que `file.existe/ajouter` et `oppositions.estOpposee`.
- Aucune suppression de données de personne : aucun port pour effacer ou supprimer. La carte ne garde ni l'identifiant, ni l'e-mail, ni le pseudo.
- Aucun nom de personne : seulement des adresses `@exemple.fr` et des identifiants fictifs.
- Les corrections secondaires demandées sont faites : `file.ajouter` est documenté comme idempotent sur `idEvenement` (`:42`). L'extrait est stocké en texte brut, à échapper à l'affichage. Le lien est limité à `linkedin.com`, `tiktok.com` et à leurs sous-domaines, en https (`:76-82`).

## Points non bloquants
1. `tests/a-traiter/atr-01-entree.test.ts:117-121` : le test « mot douteux » utilise `GUIDE STOP`, que `RE_MOT` rejette déjà (`donnee_invalide`), et il ne vérifie que `issue === "ignore"`. Si on retire le doute sur le mot, ce test passe encore. Avec cette mutation, un mot d'un seul tenant comme `STOPPER` créerait une carte. Le comportement actuel est correct (sondes ci-dessus). Il faudrait ajouter un test avec `mot: "STOPPER"`, texte « GUIDE », qui attend la raison `opposition_douteuse`.
2. `pilotage/journal/ATR-01.md:5-6` disent encore que le test « faux client vérifie zéro appel » prouve la lecture seule. La ligne 10 reconnaît le contraire. Il faut aligner les lignes 5-6 sur la ligne 10.
3. Effet voulu mais à connaître : un commentaire réel comme « GUIDE svp, j'aimerais arrêter de fumer » est classé `opposition_douteuse`, donc il ne donne aucune carte. Ce choix est prudent et conforme au domaine. Au branchement, l'appelant **doit** alerter l'opérateur sur `opposition_douteuse` et sur `contact_inconnu`, sinon ces demandes se perdent sans bruit.

## Ce qui bloque la fusion
- **Rien dans la PR.** Les points 1 à 3 ci-dessus peuvent être corrigés dans un commit de suivi.
- **L7-26 (file durable)** : toujours absente de master (aucun module, aucune fiche). **RC-40** : aucun registre d'opposition exportable hors zone interdite. Ces deux dépendances ne bloquent **pas** la fusion, parce que la fonction n'a pas de port par défaut et n'est appelée nulle part. Elles bloquent le **branchement** (session parcours viral), qui exigera : (a) un `file.ajouter` idempotent (contrainte unique sur `idEvenement`) ; (b) un adaptateur RC-40 qui fournit toujours `idContact` ; (c) une alerte à l'opérateur sur `opposition_douteuse` et `contact_inconnu`.
- Il faut publier `pilotage/autorises/ATR-01.json` sur master pour que la garde contrôle la liste elle-même, au lieu de seulement avertir.

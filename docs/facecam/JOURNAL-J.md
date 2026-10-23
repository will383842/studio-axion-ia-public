# Journal du lot J — Options payantes : prévenir avant de dépenser (09/10/2026)

Branche `feat/facecam-j`, partie de `origin/feat/facecam` et réintégrée deux fois en cours de route : lots G, H et I,
puis les dernières corrections F1 et F3. Une seule fusion a eu un conflit, sur la multicaméra, et il est résolu.
Référence : la décision de Will du 09/10, qui fait une exception à « aucun prix ».
**Rien n'a été fusionné dans master. Aucune PR n'a été ouverte, rien n'a été déployé et aucun serveur n'a été touché.
Aucun appel réel n'a été fait : Higgsfield et HeyGen sont des doubles, et le réseau est interdit dans les tests.**

## La règle appliquée
Chaque fois qu'une option **payante** est demandée, le studio montre d'abord une carte :
« Option payante — environ X € pris sur vos crédits <outil>. [Confirmer] [Annuler] ».
- **Sans confirmation**, l'option n'est pas faite et la version gratuite sort.
- **Le plafond du mois passe avant tout.** S'il ne couvre pas l'estimation, aucune carte n'est montrée et la version gratuite sort. Il est aussi revérifié au moment de dépenser, même après « Confirmer ».
- **Rien d'autre n'affiche de prix.** Seuls le total du mois et le plafond restent dans Réglages › Mon monteur.

## Ce qui est fait

| Fichier | Rôle |
|---|---|
| `src/briques/options-payantes/` (nouveau, PUR) | `registre.ts` : les 4 options (Décor IA, effets main ultra réalistes, 3 caméras avocat, 3 caméras face caméra), avec leur outil, leur libellé et leur devis en €. Higgsfield = crédits du devis × prix du crédit, qui est réglable. HeyGen = devis du double (7 c$/s par angle) × taux du studio. `confirmation.ts` : `demanderConfirmation` (plafond d'abord), `confirmer` / `annuler` (une seule réponse), `verifier` / `consommer` (usage unique : même option, même vidéo, même jeton ; la version qui dépense est notée), expiration à 24 h, `ranger`. `garde.ts` : `garderHiggsfield` et `garderMulticamera` ; voir la garde côté serveur plus bas. `carte.ts` : la phrase (« environ 6 € », arrondi à l'euro supérieur ; « moins de 1 € »). `monteur.ts` : repère dans un message « décor », « 3 caméras » et « ultra réaliste » ; une négation ne déclenche rien. `entrees.ts` : le jeton voyage dans les entrées de la version (`entrees.optionsPayantes`). |
| `src/services/options-payantes.ts` (nouveau) | Les demandes sont rangées dans le paramètre `optionsPayantes.demandes`. Les lectures-écritures passent en file, une à la fois. Fonctions : `demanderOptionPayante`, `confirmerOptionPayante` (session exigée ; lance une **nouvelle version** qui porte le jeton), `annulerOptionPayante`, `gardePourTravail` (consomme le jeton porté par la version du travail et revérifie le plafond), `preparerOptionPayante` (point d'appel commun des passes payantes), `reponseMonteurOptionPayante`, `cartesEnAttente` et `carteReglages`. Le prix du crédit Higgsfield est réglable dans `optionsPayantes.prixCreditHiggsfieldCentimes`, sans écran. |
| `src/services/options-payantes-multicamera.ts`, `options-payantes-higgsfield.ts` (nouveaux) | Garde de la multicaméra (avocat et face caméra). `higgsfieldPourOption` / `higgsfieldUltraRealisteMain` : **point d'entrée de l'option ultra réaliste du lot I2**. |
| `src/app/(studio)/videos/actions-options-payantes.ts` (nouveau) | Actions Confirmer, Annuler et estimation pour Réglages. |
| `src/components/options-payantes/CarteOptionPayante.tsx` (nouveau) | La carte : 358 px de large au plus, couleur ambre de la charte, deux boutons (Annuler en contour, Confirmer en principal). Elle existe en trois versions : carte simple (Réglages), carte branchée sur le serveur (fil) et liste « Votre vidéo ». |

### La garde côté serveur
Elle est posée **au point d'appel unique** de chaque fournisseur réel :
- `fournisseurHiggsfield` enveloppe toujours le client réel, et `lancer` exige la garde ;
- `choisirFournisseurMulticamera` enveloppe toujours le réel, et `preparerLook` / `rendreAngle` exigent la garde.

**Sans garde, tout appel payant est refusé.** La confirmation est consommée au premier appel d'une passe et vaut pour les appels suivants de cette même passe. Une autre passe, ou une autre version, doit avoir sa propre confirmation.

## Ajouts minimaux dans les fichiers existants
- `fournisseurs/higgsfield/index.ts` et `fournisseurs/multicamera/index.ts` : un paramètre `garde` en plus, et l'enveloppe autour du réel.
- `services/decor-ia.ts` : en réel, rien ne part sans accord. Il n'y a ni envoi ni dépense : l'étape rend `non-lance` avec « Option payante en attente de votre accord… » et la carte est créée. L'option peut aussi être demandée pour une seule version, après « Confirmer » dans le fil. Un client injecté est gardé lui aussi.
- `services/multicamera.ts` (fabrication commune de la mission H) : la garde est posée pour les deux formats. `multicamera-avocat.ts` et `multicamera-facecam.ts` : l'option confirmée vaut pour **cette** version.
- `services/monteur-facecam.ts` : quand une opération payante est repérée dans « Discuter avec mon monteur », le monteur répond dans le fil avec la carte (champ `confirmation`). Il n'y a pas d'appel Claude et pas de nouvelle version. « Confirmer » lance la version avec l'option ; « Annuler » fait répondre au monteur « la vidéo reste dans sa version gratuite ».
- `FilMonteur.tsx` : la carte dans la bulle du monteur.
- `videos/[id]/page.tsx` : la liste « Options payantes à confirmer », pour tous les formats.
- Réglages › Décor IA (`DecorIa.tsx`, `actions-decor.ts`) : allumer montre la carte (« … environ 6 € par vidéo d'une minute… »). Le serveur refuse `actif: true` sans `confirme`.

## Tests
- `src/briques/options-payantes/options-payantes.test.ts` (20) : devis, phrase de la carte, plafond prioritaire, une seule réponse, expiration à 24 h, usage unique lié à la version, autre option ou autre vidéo refusée, annulée jamais utilisable, entrées trafiquées ignorées, gardes Higgsfield et HeyGen (refus sans garde, une seule consommation par passe, une panne vaut refus), détection monteur (8 phrases dont 4 négations).
- `tests/j-options-payantes.test.ts` (14, dépôts en mémoire, `fetch` interdit) :
  - fournisseurs réels sans garde : aucun appel ;
  - Décor IA réel sans accord : aucun lancement, la carte attend ;
  - Décor IA confirmé : appliqué une fois, puis plus rien sur la même version ;
  - usage unique : une seconde garde refusée, une version qui recopie le jeton refusée, une autre option refusée ;
  - deux réponses à la même demande, jeton inconnu, 24 h écoulées, pas de session ;
  - Annuler : aucune nouvelle version ;
  - fil du monteur : carte, Confirmer, Annuler ;
  - plafond : pas de carte, et refus après confirmation si le plafond tombe ;
  - « rien d'autre n'affiche de prix » : vérification des écrans face caméra et Décor IA, et des messages du décor et du monteur.
- Non-régression : `decor-ia` (23), F4, H, `facecam-monteur` : verts.
- `tsc` : aucune erreur dans les fichiers du lot (les 13 erreurs déjà présentes restent : `RouteContext` / `LayoutProps` / `studio-rendu`). `eslint .` : propre.
- **Vitest complet** : 3 239 tests réussis, 1 en échec, 3 sautés (268 fichiers, environ 10 min).
  - Le test en échec est `tests/garde-ecran.test.ts` (« aucun texte affiché… ne contient de jargon technique »). Il échoue seulement parce qu'il dépasse **5 s** : relancé avec `--testTimeout 60000`, il passe, **sans aucun constat**.
  - Sur `origin/feat/facecam`, sans le lot J, ce test est **déjà à la limite** : 5,4 s et échec au premier essai, réussite au second. Il lit tout le dépôt, donc chaque fichier ajouté l'allonge un peu.
  - Délai non modifié ici : c'est un test commun. À relever (par exemple à 30 s) par la session d'intégration.

## Points à valider avec Will et intégrations restantes
1. **Une confirmation par vidéo.** Allumer le Décor IA dans Réglages demande une confirmation, **puis** chaque vidéo redemande la sienne sur « Votre vidéo » : le jeton est lié à la version. C'est la lecture stricte de « chaque fois ». Si Will préfère qu'un seul accord donné dans Réglages vaille pour toutes les vidéos, il suffit de créer le jeton au moment de la fabrication.
2. **Ultra réaliste (I2).** La branche n'est pas encore fusionnée. La passe I2 doit demander son fournisseur avec `higgsfieldUltraRealisteMain({ travailId, reel, passagesSec })` :
   - `pret` : utiliser le client rendu ;
   - sinon : sortir l'effet normal.
   Même si I2 appelle `fournisseurHiggsfield` directement, aucune dépense n'est possible : le client réel n'a pas de garde.
3. **Message mixte au monteur** (« plus chaud et en 3 caméras ») : la partie gratuite attend la réponse à la carte. Après « Confirmer », la nouvelle version reprend le message comme consigne, mais l'agent ne le relit pas. À affiner si besoin.
4. **Décor IA demandé au monteur** : il utilise la description de Réglages. Le texte du message n'est pas encore pris comme description.
5. **Plusieurs serveurs.** La consommation du jeton est protégée par une file dans le processus. Avec plusieurs serveurs, il faudra une écriture conditionnelle en base, avec comparaison de l'état.
6. **Écran à 390 px** : vérifié par les classes (carte de 358 px, deux boutons de 44 px). La planche n'a pas été capturée avec une vraie session.
7. Le devis Higgsfield ne compte pas la marge de 1,2 de la passe décor : la carte annonce une estimation. Le contrôle de la marge reste dans la passe, au moment de dépenser.

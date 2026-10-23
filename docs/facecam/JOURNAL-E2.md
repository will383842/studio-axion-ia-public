# Journal du lot E2 — Import depuis Google Drive (09/10/2026)

Branche `feat/facecam-e2`, partie de `origin/feat/facecam`, qui a été réintégrée en cours de route. Référence : `PLAN-FACECAM-v4.md` et `PLAN-IMPLEMENTATION-FACECAM.md` (L1 « Import Google Drive », décision D8).
**Rien n'a été fusionné dans master. Aucune PR n'a été ouverte, rien n'a été déployé et aucun serveur n'a été touché.**

## Ce que Will peut faire maintenant
1. **Réglages › Connexions › Mon Google Drive** : bouton « Connecter mon Drive », à faire une seule fois. La page Google s'ouvre (le compte compte@exemple.fr peut y être proposé d'office), puis on revient au studio, où le Drive apparaît « Relié ».
2. **Séance de tournage**, sur une version facecam : un bouton **« Drive »** apparaît à côté de « Déposer la prise ». Il ouvre la liste des vidéos les plus récentes du Drive (vignette, date, durée, taille), avec une recherche par nom.
3. Un appui sur une vidéo lance la copie **sur le serveur**. Rien ne passe par le téléphone, qui peut être verrouillé. La copie va jusqu'à 15 Go et une barre montre l'avancement. À l'arrivée, la prise est rangée **exactement comme une vidéo envoyée depuis l'iPhone**.
4. Si Google refuse, un message clair s'affiche :
   - « Connexion au Drive expirée — Reconnecter » ;
   - « Google refuse l'accès à cette vidéo. Envoyez-la depuis l'iPhone. » ;
   - en cas de coupure, la copie se met en pause et le bouton « Reprendre la copie » repart là où elle s'était arrêtée.

## Comment c'est construit
| Fichier (nouveau sauf mention) | Rôle |
|---|---|
| `src/fournisseurs/google-drive/` (`types`, `http`, `simulation`, `index`) | Vrai client OAuth et Drive v3, portée `drive.readonly` seule, lecture par plages. Le **double de simulation est pris par défaut** : aucun appel à Google. |
| `src/lib/chiffrement-jeton.ts` | AES-256-GCM. Les jetons Google sont gardés chiffrés en base et ne vont jamais au navigateur. |
| `src/services/google-drive.ts` | Connexion (jeton anti-falsification à usage unique, 10 min), rafraîchissement automatique, liste et recherche, copie par morceaux avec reprise, messages de repli. |
| `src/app/(studio)/reglages/google-drive/` (page et actions) | Écran « Mon Google Drive » et actions serveur. |
| `src/app/api/google-drive/retour` et `/vignette` | Retour de la page Google. Vignettes lues par le serveur : aucune adresse Google n'est donnée au navigateur. |
| `src/components/google-drive/` | `ConnexionDrive` et `SelecteurDrive` (feuille du bas réutilisable : le lot D peut la poser sur son écran d'envoi facecam). |
| `src/components/tournage/Seance.tsx` (modifié, +30 lignes) | Bouton « Drive » sur les versions facecam. |
| `src/app/(studio)/reglages/page.tsx` (modifié, +7 lignes) | Lien « Mon Google Drive » dans Connexions. |
| `src/services/mes-images.ts` (modifié, commentaire et message) | L'ébauche `preparerImportDrive` renvoie à la connexion. L'import d'un *dossier d'images* reste à faire et pourra réutiliser le même accès. |
| `deploiement/env.exemple`, `deploiement/docker-compose.yml` (modifiés) | Variables documentées et transmises. Vides, elles laissent la simulation. |

**Même chemin que l'iPhone.** La copie ouvre l'envoi avec `commencerEnvoi`, ce qui applique le plafond du format : 15 Go en facecam, 4 Go ailleurs. Ensuite, morceau par morceau, elle demande une plage au Drive puis fait un PUT signé du morceau multipart vers R2. Elle termine par `terminerEnvoi`, qui contrôle la taille réelle reçue par R2. L'écran appelle enfin `enregistrerPriseAction`, comme pour un dépôt depuis l'iPhone.
**Reprise.** Chaque morceau reçu est noté. À la reprise, c'est R2 qui fait foi : la liste des morceaux qu'il a reçus est relue, et seuls les morceaux manquants sont recopiés. Une copie interrompue par un redémarrage du serveur repart d'elle-même dès que l'écran la consulte.
**Sobriété.** Une seule copie à la fois sur le serveur, et un seul morceau en mémoire (50 Mo au plus).

## Tests (Vitest, simulation seulement)
- `tests/google-drive-import.test.ts` : 14 tests.
  - Chiffrement et choix du fournisseur.
  - Erreurs Google traduites.
  - Connexion : jeton anti-falsification et jetons non lisibles en base.
  - Rafraîchissement.
  - Liste et recherche.
  - **Succès** : fichier prêt avec sa taille et sa durée.
  - Plafond : 14 Go acceptés en facecam, refusés en avocat ; plus de 15 Go refusé ; un fichier qui n'est pas une vidéo est refusé.
  - **Refus** : connexion expirée, puis « Reconnecter » ; accès retiré pendant la copie, puis « iPhone ».
  - **Reprise** : en pause puis « Reprendre », seuls les morceaux manquants sont relus ; avec un stockage multipart, octets identiques après assemblage.
- Vérifications passées : `tsc` sans erreur nouvelle (seules restent les erreurs déjà présentes, types Next générés et `studio-rendu`) ; `eslint` sans remarque sur les fichiers touchés ; voisins verts (`a2-mes-images`, `c5-depots-reels`, `g4c-tournage`, `r1-envoi-reel`, `facecam-fondations`), soit 86 tests.
- Parcours vérifié à la main à **390 px** avec le serveur de développement et le double : connexion, puis retour « Relié », puis liste, recherche « opco », copie et fichier prêt. Aucun défilement horizontal.

## Ce que Will doit faire une fois : créer l'accès Google (≈ 10 minutes)
1. Ouvrir **console.cloud.google.com** avec le compte compte@exemple.fr.
2. En haut, **« Sélectionner un projet » › « Nouveau projet »**, le nommer « Studio Axion-IA », puis Créer.
3. Menu **« API et services » › « Bibliothèque »**, chercher **« Google Drive API »** et cliquer **Activer**.
4. **« API et services » › « Écran de consentement OAuth »** (ou « Google Auth Platform ») :
   - type **Externe** ;
   - nom de l'application : « Studio Axion-IA » ;
   - adresse de contact : la vôtre ;
   - dans « Utilisateurs de test », **ajouter compte@exemple.fr** ;
   - **laisser l'application en mode « Test »** (pas de validation Google à demander, puisque vous êtes le seul utilisateur).
5. **« Identifiants » › « Créer des identifiants » › « ID client OAuth »** :
   - type **Application Web** ;
   - dans « URI de redirection autorisés », coller exactement **`https://studio.axion-ia.com/api/google-drive/retour`** ;
   - cliquer Créer.
6. Google affiche un **ID client** et un **Code secret**. Les transmettre au moment de la mise en ligne, par le canal habituel des clés et **jamais dans un message ou un fichier du dépôt**. Ils seront posés dans le `.env` du serveur :
   ```
   FOURNISSEUR_GOOGLE_DRIVE=google
   GOOGLE_CLIENT_ID=…            (l'ID client)
   GOOGLE_CLIENT_SECRET=…        (le code secret)
   GOOGLE_DRIVE_COMPTE=compte@exemple.fr
   # facultatifs : GOOGLE_REDIRECTION (si l'adresse du studio change), GOOGLE_DRIVE_CLE (32 caractères ; sinon dérivée de SESSION_SECRET)
   ```
7. Après la mise en ligne : Réglages › Mon Google Drive, puis « Connecter mon Drive ». Google prévient que « l'application n'est pas validée » : c'est normal en mode Test. Cliquer « Continuer », puis cocher l'accès **en lecture** au Drive.

⚠️ **En mode « Test », Google coupe l'accès au bout de 7 jours.** Le studio affiche alors « Connexion au Drive expirée — Reconnecter », et deux clics suffisent. Pour ne plus avoir à le faire, il faut passer l'application en « Production » dans l'écran de consentement. Comme `drive.readonly` est une portée « restreinte », Google peut alors demander une vérification. On reste donc en Test tant que la reconnexion hebdomadaire ne gêne pas.

## Points ouverts et suites
- **Lot D** (écran d'envoi facecam) : poser `<SelecteurDrive cible={{ typeEntite: "rush", entiteId }} onPret=… onIphone=… />` à côté de l'envoi depuis l'iPhone. Aujourd'hui, il est branché sur la séance existante.
- **Import d'un dossier d'images** (Mes images, `preparerImportDrive`) : non fait. Il réutilisera la même connexion.
- **Essai réel** à faire une fois les clés posées : une vidéo de 2 Go puis une de plus de 4 Go (facecam). On mesurera le temps de copie et on vérifiera que la prise est bien rangée.
- **Essai manuel du double** : `GOOGLE_DRIVE_ESSAI=expire|refuse|coupure` (développement seulement) montre les écrans de repli.

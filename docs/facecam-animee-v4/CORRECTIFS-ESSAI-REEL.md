# Face caméra animée — correctifs de l'essai réel de Will (17/10/2026)

Branche `facecam-animee/essai-reel-correctifs` (depuis `origin/master` d21428a). **Rien n'est fusionné, rien n'est mis en ligne**, aucun réglage, aucun `.env`, aucun serveur touché.

Will a essayé le générateur dans l'interface le 17/10. Quatre problèmes, quatre correctifs.

## 1. Introuvable → visible dans « Nouvelle vidéo » et dans le menu, avec une pastille « Essai »

**Choix documenté.** Le studio n'a **qu'une session** : un seul mot de passe, celui de Will (`src/services/auth.ts`, aucune notion d'utilisateur). « Visible pour Will » veut donc dire **visible dans l'interface connectée**. La page de connexion, les idées, les prix, les personnages et les autres listes publiques ne le montrent toujours pas.

- `listerFormats({ inclureReservesAWill: true })` (`src/formats/index.ts`) : nouvelle option. Par défaut, rien ne change (`listerFormats()` et `listerFormatsActifs()` excluent toujours les formats `reserveAWill`).
- `listerFormatsAvecCompteurs` (`src/services/formats.ts`), utilisée **seulement** par la grille `/nouvelle` et la coquille connectée (`layout.tsx`), passe cette option et marque le format `essai: true`.
- **Menu latéral**, sous « Mes vidéos » : lien `/formats/facecam-animee`, avec le **compteur de ses vidéos** et la pastille ambre « Essai ». Pas grisé : le grisage de la PR #338 (`statut !== "actif"`) reste intact pour les autres formats, et le test de #338 passe toujours.
- **Grille « Nouvelle vidéo »** : carte cliquable avec la pastille « Essai ». `/nouvelle/facecam-animee` redirige vers l'écran de dépôt `/face-camera-animee`, comme le tableau animé et le cas concret.
- **Le reste de `reserveAWill` est gardé** : le moteur refuse toujours tout lancement sans l'accord d'essai (case à cocher la 1ʳᵉ fois).
- **« Mes vidéos »** : ses vidéos y apparaissent comme les autres. L'onglet du format apparaît dès la 1ʳᵉ vidéo (comportement existant) et le compteur est celui du menu.

![Nouvelle vidéo et menu](essai-reel/1-nouvelle-video-et-menu-1440.png)

## 2. Envoi coupé par une mise à jour du studio → envoi qui reprend tout seul

**Cause exacte.** Chaque morceau demande d'abord sa signature à `/api/depots`. Ce petit appel n'était **jamais réessayé** : seul le PUT vers R2 l'était (3 essais en 13 s). Pendant le redémarrage, `/api/depots` a répondu par une page 502 en HTML. Le JSON était illisible, d'où le message par défaut « L'envoi n'a pas pu commencer. », faux puisque l'envoi en était à 8 %. Après un arrêt, une reprise qui n'arrivait pas à relire les morceaux reçus (`recus`) **repartait de zéro**.

**Correctif** (`src/lib/envoi-multipart.ts`, partagé par tous les formats) :
- **Chaque appel** est réessayé tout seul : ouverture, signature, morceau, fin, relecture des morceaux reçus. L'attente grandit (1 s, 2 s, 4 s, 8 s, 15 s, puis 30 s), pendant **5 minutes** (au moins 3 minutes exigées).
- Sont réessayés : coupure réseau, 502 / 503 / 504, 408, 429, 500, Cloudflare 520 à 524, et une page HTML servie à la place du JSON (mise en ligne). Un 403 de R2 (adresse signée périmée pendant l'attente) est réessayé avec une **nouvelle signature**.
- Jamais réessayé : un refus net (fichier trop gros…), une session expirée (401).
- **Reprise au dernier morceau reçu** : les morceaux réussis sont gardés. Pendant l'attente, les autres morceaux continuent et le morceau en panne repart seul.
- « Reprendre l'envoi » (même fichier) relit ce que R2 a reçu et n'envoie que le reste. L'état est gardé dans le navigateur, et aussi **en mémoire** si le stockage local est fermé (navigation privée).
- **Phrase pendant l'attente** (`onAttente` → `phraseAttente`) : « Le studio redémarre, l'envoi reprend tout seul… » (ou « La connexion est coupée… »).
- **Phrases exactes** à l'arrêt (`ErreurEnvoi`, avec `cas`, `pourcentage`, `reprenable`) :
  - pas commencé : « L'envoi n'a pas pu commencer : le studio ne répond pas depuis plusieurs minutes… » ;
  - interrompu : « L'envoi s'est interrompu à X % … « Reprendre l'envoi » repart de X %, pas du début. » ;
  - fin non enregistrée : « Le fichier est arrivé, mais le studio ne répond pas pour l'enregistrer… » ;
  - refusé : « L'envoi a été refusé : <raison du studio> » ;
  - session expirée : « reconnectez-vous, puis « Reprendre l'envoi » ».
- Un **bouton « Reprendre l'envoi »** apparaît dans `ZoneDepot` (partagé) et sur chaque prise de la face caméra animée.
- **Fin redemandée après un redémarrage** (`src/services/envois.ts`) : si l'assemblage R2 a déjà eu lieu mais que la réponse s'est perdue, le fichier présent est enregistré au lieu d'être refusé.
- **Comportement nominal inchangé** : mêmes morceaux, même parallélisme (3), même stockage de reprise, même valeur rendue. Seuls changent les cas d'erreur, et le type envoyé quand le navigateur n'en donne aucun (déduit de l'extension, voir 4).

**Formats et écrans concernés** (tous passent par `envoyerFichier`) :

| Écran | Fichier | Formats |
|---|---|---|
| Face caméra animée (dépôt des prises) | `components/formats/facecam-animee/DepotPrise.tsx` | Face caméra animée |
| Face caméra : envoi depuis l'iPhone | `components/facecam/EnvoiIphone.tsx` | Face caméra |
| Image → vidéo (dépôt de l'image) | `components/formats/image-video/Depot.tsx` | Image → vidéo |
| Tournage (prises filmées dans le studio, `/ecrire/tournage`) | `components/tournage/Enregistreur.tsx`, `Seance.tsx` | Formats filmés par séance de tournage |
| Vidéo HeyGen déposée (`ZoneDepot` avec envoi) | `components/generateur/VideoHeygen.tsx` | Formats à avatar (Type avocat…) |
| Matières, preuves (`ZoneDepot` avec envoi) | `components/matieres/FeuilleMatiere.tsx`, `FeuillePreuve.tsx` | Tous (onglet Matières) |
| Bibliothèque, Mes images, LUT, licences | `components/bibliotheque/*` | Tous (éléments communs) |
| Personnages (visages, voix, accord) | `components/personnages/*` | Tous les formats à personnage |
| Assistant (médias, distribution) | `assistant/etapes/Medias.tsx`, `Distribution.tsx` | Formats de l'assistant |

![Le studio redémarre : l'envoi attend et reprend](essai-reel/3-studio-redemarre-envoi-en-attente-1440.png)

## 3. Plusieurs vidéos d'un coup

- **Dépôt** : sélection multiple ou glisser-déposer de plusieurs fichiers (20 au plus). Les fichiers qui ne sont pas des vidéos sont refusés par leur nom, les autres sont gardés.
- **Chaque prise** a son aperçu entier, sa durée, son envoi avec sa progression, sa phrase d'attente, son erreur exacte avec « Reprendre l'envoi », un bouton « Retirer » et **son texte dit facultatif**, repliable.
- **Les envois** passent **une prise à la fois**, chacune en 3 morceaux parallèles, pour ne pas saturer la connexion de l'iPhone.
- **Un seul bouton** « Animer mes N vidéos » (« Animer ma vidéo » s'il n'y en a qu'une). Il attend que toutes les prises soient envoyées et que l'accord soit coché.
- **Côté serveur**, `deposerFacecamAnimeeLot` (`src/services/facecam-animee.ts`) et l'action `deposerFacecamAnimeeLotAction` créent **une vidéo distincte par prise**, avec son texte, une à une, par le **lancement commun** (`lancerFabrication`). Chaque vidéo devient un travail **en file**, et c'est la boucle qui les fabrique en respectant sa concurrence (`calculerFile(actifs, await concurrence())`).
- **Aucune vidéo perdue** : une prise refusée (pas une vidéo, trop courte, lancement en panne) n'empêche pas les autres. Elle reste à l'écran avec sa phrase. Une même prise n'est lancée qu'une fois, et l'accord d'essai, donné une fois, vaut pour tout le lot.
- **Après le lancement** : une seule vidéo mène à sa page (comme avant), plusieurs mènent à l'onglet « Face caméra animée » de « Mes vidéos » (`/formats/facecam-animee`), où elles apparaissent « En fabrication » avec leur avancement. Will peut quitter la page : la phrase sous les prises le lui dit.

| | |
|---|---|
| ![Trois prises, texte, erreur](essai-reel/4-trois-prises-horizontale-texte-erreur-1440.png) | ![Téléphone : deux prises](essai-reel/6-telephone-deux-prises-390.png) |
| ![Prêt : Animer mes 2 vidéos](essai-reel/5-pret-animer-mes-2-videos-1440.png) | ![Après « Animer » : 2 en fabrication](essai-reel/7-telephone-apres-animer-390.png) |

*Captures* : vrai studio lancé en local **sans base** (mémoire), stockage simulé, mot de passe jetable (`essai-reel/captures.mjs`). Le redémarrage (3 × 503) et la session expirée sont simulés en interceptant `/api/depots`. Le Chromium de test ne lit pas le H.264 : les vidéos d'essai sont en VP9, ce sont des mires et non de vraies prises. Sur la capture du téléphone en pleine page, la barre du bas (fixe) se pose au milieu de l'image.

## 4. Petits points

- **Glisser-déposer** : la zone accepte maintenant aussi l'entrée du glisser (`onDragEnter` empêché, nécessaire pour certains navigateurs). Avant, seul le survol l'était. Sur la page de la face caméra animée, la zone reste affichée après la 1ʳᵉ prise (« Ajouter d'autres vidéos ») : avant, elle disparaissait.
- **Aperçu entier** : la vidéo garde ses proportions (`object-contain`, `aspect-ratio` lu sur la vidéo, `max-h-[60vh]`), jamais rognée, horizontale comme verticale.
- **Casse de l'extension** : un navigateur peut n'envoyer **aucun type**, ou « octets », pour un `.MOV`. Le service refusait alors la prise (« Déposez une vidéo »). Désormais :
  - `typeDuFichier` (`envoi-multipart.ts`, tous les formats) déduit le type de l'extension, casse ignorée ;
  - `estPriseVideoFA` (service) accepte `.mp4` / `.mov` / `.m4v` quelle que soit la casse ;
  - le sélecteur liste les deux casses (`ACCEPTE_PRISES`).
- **Prise horizontale (IMG_7747, 3840 × 2160)** : **elle n'était pas recadrée sur le visage**. La répétition avait utilisé une prise déjà mise en 1080 × 1920. Une prise brute horizontale aurait été montée en 4K, puis affichée en `objectFit: cover`, donc **coupée au centre de l'image**, pas sur le visage. Corrigé :
  - la transcription (`studio-aligneur`, inchangé) renvoie déjà la taille de la prise après rotation : la chaîne la garde ;
  - prise horizontale : à l'étape des coupes, le visage est repéré par la **route `visages` du conteneur** (déjà utilisée par le face caméra), reprise au passage suivant tant qu'elle tourne, jamais lancée deux fois ;
  - `recadrageVerticalV4` en déduit **une colonne 9:16 de toute la hauteur**, centrée sur le visage (médiane des yeux), bornée aux bords, coordonnées paires. Pour 3840 × 2160, la colonne fait 1216 × 2160 ;
  - le service de rendu (`filtreMontageV4`) ajoute `crop` puis `scale=1080:1920` au montage. Le cadre est **fixe** : aucun zoom en plus (l'image est seulement réduite, même rapport), aucun mouvement de cadrage, fond intact ;
  - la position du visage dans la colonne est donnée au réalisateur, pour que plaquettes et sous-titres l'évitent ;
  - si le visage est introuvable, la colonne est centrée et la vidéo est quand même fabriquée ;
  - **une prise verticale n'est pas touchée** : filtre identique au caractère près, aucun repérage ;
  - à l'écran, sous la prise : « Votre vidéo horizontale sera mise en vertical (1080 × 1920), cadrée sur votre visage, sans zoom. »

## Fichiers partagés touchés HORS face caméra animée (liste exacte)

- `src/lib/envoi-multipart.ts` : envoi résistant (voir 2), `typeDuFichier`, `ErreurEnvoi`, `phraseAttente`, `avecReprises`.
- `src/components/ui/ZoneDepot.tsx` : `onDragEnter`, phrase d'attente, bouton « Reprendre l'envoi ».
- `src/services/envois.ts` : fin redemandée après un redémarrage (fichier déjà assemblé → enregistré).
- `src/formats/index.ts` (option `inclureReservesAWill`), `src/formats/types.ts` (commentaire de `reserveAWill`).
- `src/services/formats.ts` (`listerFormatsAvecCompteurs` : formats en essai, champ `essai`), `src/app/(studio)/layout.tsx` (transmet `essai`).
- `src/components/coquille/navigation.ts` (champ `essai` de `FormatNavigation`), `src/components/coquille/BarreLaterale.tsx` (pastille « Essai »).
- `src/components/ui/CarteFormat.tsx` (pastille « Essai »).
- `src/app/(studio)/nouvelle/[format]/page.tsx` (redirection vers `/face-camera-animee`).
- `studio-rendu/src/operations/facecam-v4.ts` : propre au format, mais dans le service de rendu partagé (paramètre `recadrage`).

Propres au format : `DepotPrise.tsx`, `prises.ts` (nouveau), `src/services/facecam-animee.ts`, `face-camera-animee/actions.ts` et `page.tsx`, `chaine-v4.ts`. Aucun fichier d'un autre générateur n'est supprimé. Aucune musique, aucun zoom, aucune modification du fond. Aucun `.tsx` ajouté dans `studio-rendu`.

## Tests

`tests/facecam-animee/essai-reel.test.ts` (23 tests, aucun réseau) :
- **visibilité** : grille et menu, pastille, jamais grisé, « bientôt » toujours grisés, listes publiques inchangées ;
- **envoi** :
  - faux serveur qui renvoie **503 puis 200** à l'ouverture, à une signature, à un morceau et à la fin : chaque morceau envoyé une seule fois ;
  - **coupure au milieu** : 2 min 30 de 503 sur le morceau 5, reprise au morceau 5 ;
  - **plus de 5 minutes** sans réponse : « interrompu à X % », puis **reprise au bon morceau** (les morceaux reçus ne repartent pas) ;
  - au moins 3 minutes de nouveaux essais, attentes croissantes, refus jamais réessayé ;
  - phrases exactes ; vrai `fetch` simulé (réseau coupé, 502 HTML, page de mise à jour, 401) ; type déduit de l'extension ;
- **lot** : 3 vidéos lancées et mises en file dans l'ordre avec leur texte, une refusée sans bloquer les autres, doublon ignoré, accord enregistré une fois, panne de lancement sans perte ;
- **prise horizontale** :
  - colonne 9:16 sur le visage (bords, visage introuvable) ;
  - chaîne complète (repérage repris tant qu'il tourne, recadrage transmis au rendu ; une prise verticale ne change rien) ;
  - contrôle des paramètres du rendu ;
  - **vrai FFmpeg** : une prise 16:9 devient du 1080 × 1920 avec le « visage » au centre ;
- **écran** : phrase « horizontale → vertical », aperçu entier.

**Suite complète** (`npx vitest run`, premier plan) et **`npx tsc --noEmit`** : voir la section « Résultats » ci-dessous.

## Résultats

| | `master` d21428a (référence, même machine) | Branche |
|---|---|---|
| `npx vitest run` (672 / 673 fichiers) | 9 978 réussis, **16 échecs dans 8 fichiers** | 10 005 réussis, **12 échecs dans 6 fichiers** |
| Fichiers en échec | `cas-concret/variete/l3c`, `garde-ecran`, `image-video/controles`, `rendu-garde/garde`, `tableau/formats/rendu-reel`, `v5-serveur-scripts`, `e2e-verif1-bc-serie`, `image-video/coupes-voix-bruitees` | les 6 premiers, mêmes tests (aucun nouveau) |
| `npx tsc --noEmit` (racine) | 21 erreurs | aucune nouvelle (les 6 en moins viennent des types `.next` créés par le serveur local des captures, pas du code) |
| `npx tsc --noEmit` (`studio-rendu`) | 5 erreurs | les 5 mêmes |

- **Aucun nouvel échec.** `garde-ecran` échoue sur la même ligne que sur `master` (`realisateur/index.ts:229`, déjà là, hors de ce lot). `e2e-verif1-bc-serie` et `coupes-voix-bruitees` ont échoué sur `master` mais passent sur la branche : ce sont des tests sensibles au temps (machine chargée), sans lien avec ce lot.
- `tableau/formats/rendu-reel` a besoin de télécharger le navigateur de Remotion (réseau fermé ici).

## À savoir / reste à faire

- **Couleurs d'une prise iPhone HDR** (HEVC 10 bits, HLG ou Dolby Vision : réglage par défaut de l'iPhone en 4K) : le montage passe en `yuv420p` sans conversion des tons, et l'image peut sortir délavée. C'était déjà le cas avant ce lot ; la répétition avait utilisé une prise déjà convertie. À vérifier sur la première vraie prise brute ; sinon, filmer en « Le plus compatible » (H.264) en attendant une conversion des tons.
- **Repérage du visage** sur une prise horizontale : il ajoute un passage par la route `visages` du conteneur (temps de calcul sur toute la prise, comme pour le face caméra). Le conteneur et ses modèles doivent être présents, ce qui est déjà le cas pour le face caméra. Sinon, la colonne est centrée.
- **Le service de rendu doit être redéployé** pour le paramètre `recadrage` (par la session des mises en ligne, pas ici). Tant qu'il ne l'est pas, une vidéo horizontale serait rendue par l'ancien service sans recadrage, coupée au centre : il ignore le paramètre.

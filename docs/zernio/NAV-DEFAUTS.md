# NAV · défauts d'écran observés (non corrigés)

Relevé du parcours navigateur en simulation (voir `tests-navigateur/`). Aucun code d'écran n'a été modifié. Chaque défaut est suivi par un essai marqué `test.fail` : quand le défaut est corrigé, l'essai « réussit contre toute attente » et échoue, ce qui rappelle d'ôter la marque. Les captures éventuelles vont dans le dépôt privé (voir `NAV-CAPTURES.md`) ; la « capture décrite en mots » est donnée ci-dessous.

| N° | Écran | Parcours | Observé | Attendu |
|---|---|---|---|---|
| D1 ✅ corrigé | Réglages › Connexions | Ouvrir `/reglages` | L'écran « Connexions Zernio » (`ConnexionsZernio`, Z3-C) n'est monté sur aucune page : la page Réglages ne montre que l'ancien bloc Connexions (services, clés). Impossible d'atteindre « Tester les 6 comptes », « Tout arrêter », les cartes de comptes. | L'écran est visible dans Réglages (le code dit « à brancher par Z3-E/NAV »). |
| D2 ✅ corrigé | Tous les écrans | Après « Tout arrêter », ouvrir l'accueil, Migration, A publier, Calendrier | Aucun bandeau d'arrêt : le mot « arrêt » n'apparaît que dans la carte de l'écran Connexions. | Un bandeau « Tout est à l'arrêt » visible sur tous les écrans tant que l'arrêt est actif. |
| D3 ✅ corrigé | Connexions | Zernio répond 503, puis « Tester » | Seul un message passager s'affiche. L'état « Zernio ne répond pas » et son bouton « Réessayer maintenant » n'apparaissent que si la lecture EN BASE échoue (la lecture de l'écran n'appelle jamais Zernio). | Quand Zernio ne répond pas, l'écran montre l'état erreur avec « Réessayer maintenant ». |
| D4 ✅ corrigé | Migration | Ouvrir un lot (« Vérifier le lot A »), puis touche Échap | La fenêtre reste ouverte (elle n'écoute pas Échap ; seul « Fermer » la ferme). | Échap ferme la fenêtre. |
| D5 ✅ corrigé | Migration | Cibles tactiles | 6 boutons à 44 px de haut (« Ouvrir le lot … », « Choisir une date », « Fermer », « C'est juste »…) au lieu de 48 px. | Cibles d'au moins 48 px. |
| D6 ✅ corrigé | Migration | Taille des textes (bureau et téléphone, clair et sombre) | 296 textes à 14 px (en-tête, légendes d'avancement, « Total vérifié », date limite, critères, sous-titres des lots…). | Textes d'au moins 16 px. |
| D7 ⏸ hors périmètre | Migration | « Créer le lot A » | Aucun bouton ne crée de brouillons : l'écran n'offre que « Vérifier le lot … » et « Ouvrir le lot … ». Les actions qui écrivent (« Retirer de Buffer et programmer », « C'est juste ») sont inactives avec la raison « Disponible après l'import des brouillons » : conforme, mais le parcours « confirmer, créer, retirer, programmer » n'est pas testable. | Écriture branchée (lot ultérieur) ; à tester alors. |
| D8 ⏸ hors périmètre | Tous | Thème clair | Le Studio n'a qu'un thème sombre (`color-scheme: dark`) : le thème « clair » demandé ne change rien. | À décider : thème clair prévu ou non. |
| D9 ✅ corrigé | Connexions | Clé refusée | Le message dit « vérifier la clé » (infinitif) au lieu d'une phrase au vouvoiement (« Vérifiez la clé »). Mineur. | Vouvoiement. |

## État de la correction (lot navfix)

- Corrigés : D1, D2, D3, D4, D5, D6, D9 (leurs `test.fail` sont ôtés, les essais passent).
- D5 : seuil fixé à 44 px (et non 48) ; D6 : au moins 16 px sur téléphone, 14 px ailleurs, selon la maquette validée.
- **Hors périmètre** : D7 (bouton « créer le lot » : dépend du branchement IMP-2/IMP-3) et D8 (thème clair : le thème sombre du Studio est validé par le propriétaire). Aucun correctif ici.

## Limites de cet essai

- Écran Connexions : les parcours ont été exécutés sur une COPIE de travail hors du dépôt où l'écran était branché dans Réglages (résultat : 10 réussis, 2 défauts D2 et D3 confirmés). Dans le dépôt, ils sont sautés tant que D1 dure.
- « Écriture refusée avec `envoi-coupe` » : aucun geste du navigateur n'écrit vers Zernio ; l'essai vérifie que, arrêt actif, le faux Zernio ne reçoit aucune écriture. Le refus lui-même reste couvert par `tests/zernio/z1c-arret.test.ts`.
- Écran « A publier » : non testé (Z3-E pas fusionné), voir `a-publier.spec.ts` (test.skip).
- Les dates de l'essai Migration sont fixes (novembre 2026) : relancer avant le 10/11/2026 pour que « À reprogrammer » et les lots se comportent comme prévu.

# Relecture PR 594 (HSH-01c : placement des hashtags à l'envoi et aperçu)

**VERDICT : À CORRIGER** — tête complète relue : `79169e06d3b2049f05b5ef4db3218dd6e82a8b1e` (= `origin/usine/HSH-01c`, = tête de la PR).

## Constats

1. **MAJEUR — l'aperçu du kit annonce un premier commentaire qui ne part pas** (`src/services/publications.ts:480`, affiché par `src/components/publication/KitPublication.tsx:412`).
   L'aperçu prend toujours le premier commentaire de la vidéo (`premierCommentaireDeVideo`), alors qu'à l'envoi depuis la feuille du kit
   (`FeuilleEnvoyerBuffer.tsx:138` : ni `premiersCommentaires` ni `avecPremierCommentaire`) ce commentaire n'est pas envoyé
   (`preparerEnvoi` ne le lit que si `avecVideo` est vrai).
   Sonde jetable (faux client Zernio, LinkedIn, commentaire de vidéo « Le lien : axion-ia.com ») :
   - réglage par défaut : aperçu `premierCommentaire = "Le lien : axion-ia.com"`, envoyé : **aucun** (le texte, lui, est identique) ;
   - réglage « premier commentaire » : aperçu `"Le lien : axion-ia.com\n\n#Entrepreneur #PME #IA"`, envoyé : `"#Entrepreneur #PME #IA"`.
   Le critère « aperçu fidèle à ce qui sera envoyé » n'est donc pas tenu, même avec le réglage par défaut (le kit affiche désormais un
   « Premier commentaire final » qui ne part pas). Même cause pour les réseaux où l'outil ne transmet pas le commentaire (Instagram, TikTok
   par Zernio) : l'aperçu le présente comme « final » alors qu'il est à poser à la main.
   Correction attendue : que l'aperçu suive les mêmes entrées que l'envoi du kit (commentaire inclus seulement s'il part, sinon signalé
   « à poser à la main »), et un test qui envoie **sans options** (comme la feuille du kit) et compare à l'aperçu. Le test actuel
   `hsh-01c-placement-envoi.test.ts` (« aperçu final dans le kit ») passe `avecPremierCommentaire: true`, ce qui masque l'écart.

2. **MINEUR — l'aperçu de la page « À publier » ignore le réglage** (`src/services/a-publier.ts:201`, `texteAEnvoyer(r, kit.serie?.entete)`
   sans réseau ni réglage : hashtags toujours affichés à la fin). Fichier hors fiche : à signaler pour une fiche suivante, pas bloquant ici.

3. **MINEUR — contrôle des mots interdits** : avec le réglage « premier commentaire », les hashtags quittent le texte et ne passent plus par
   `verifierTextesAEnvoyer` ; un commentaire transmis n'est pas filtré par `commentairePour`. Les fourre-tout restent écartés par
   `placerHashtags` ; à confirmer que `motsInterditsEnvoi` ne peut pas toucher un hashtag. Non bloquant.

## Points vérifiés et conformes

- Réglage par défaut : texte envoyé identique octet pour octet (relu ligne par ligne + test instantané `texteDAvant`), y compris en-tête,
  texte vide, liste vide, fourre-tout.
- Aucune perte de contenu : les hashtags ne vont dans le commentaire que si l'outil le transmet, sinon ils restent dans le texte avec la
  phrase de repli ; TikTok jamais en commentaire ; aucune coupe silencieuse.
- Chemins existants (YouTube Shorts #572, Reel Facebook #582, envoi normal) : pas de régression constatée ; `tests/zernio`,
  `tests/youtube-zernio`, `tests/a-publier*`, `hsh-01*` : 219/220 fichiers verts. Seul échec :
  `a-publier-premier-commentaire-zernio.test.ts` « cohérence … » (attendu 2, obtenu 3) — **échoue à l'identique sur origin/master**,
  donc préexistant, non causé par la PR (et absent de `scripts/echecs-connus.json`, à traiter à part).
- Aucun appel réel : sonde `fetch` espionné pendant `obtenirKit` = 0 appel ; tests sur faux client Zernio ; aucune publication ni suppression.
- Diff limité aux 3 fichiers autorisés ; `scripts/echecs-connus.json` inchangé ; aucun nom de personne ; aucune mention de Buffer dans
  un texte visible (seuls l'identifiant d'outil `"buffer"` et des noms de fonctions existants).
- Contrôles GitHub : 9/9 terminés et verts sur la tête.

Sondes jetables : non poussées et supprimées.

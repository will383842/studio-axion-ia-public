# REPRENDRE — chantier « menu + vidéos » du studio (état 09/11/2026)

> Bloc du haut = à lire en premier. Le plan complet est dans `PLAN.md` (même dossier), la consigne des auteurs dans `CONSIGNE-AUTEURS.md`.

**Objectif (Williams, 08/11)** : menu latéral parfaitement compréhensible ; vidéos classées par réseau et par type, pastille du réseau ; fiche vidéo rapide et claire ; page « Vidéos validées » avec export ; Réglages rangés ; « fais tout de bout en bout ».

**Fusionné dans master** : #249 menu en sections · #247 recherche des pages · #250 « Cas concret » · #248 socle vidéos (réseaux, pastilles, BoutonValider, route `/api/telechargements/video`) · #251 Mes vidéos (filtres réseau/étape) · #252 fiche plus rapide · #253 nouvelle fiche vidéo.

**Fusionné aussi le 09/11** : #255 test perf-fiche-video · #257 Réglages rangés (G) · #258 Vidéos validées (V) · #260 Image → vidéo (I) · #262 menu « À publier » → « Vidéos validées » (N). Tous relus par un relecteur Opus ; CI verte.

**Fusionné aussi (09/11)** : #265 menu : chaque section se plie et se déplie + barre latérale plus compacte (14 px, lignes de 36 px, comme le CRM Pro).

**EN LIGNE le 09/11** : le studio tourne sur d3a2a439 (mise en ligne par mettre-a-jour.sh, santé 200). Vérifié dans Chrome : menu « Vidéos validées », sections pliables, page Réglages rangée.

**Tests** : comparaison avant/après des 5 premières PR (#255 #257 #258 #260 #262) : 0 nouvel échec, 102 échecs identiques des deux côtés (déjà présents : image-video/react-module, variete/*, interface, navigation-formats…). La suite complète dépasse la limite de temps du cloud (4 cœurs) : lancer par dossiers. Rapports : branches supprimées après ce commit, voir l'historique de cette PR.

**Reste (petits points)** : (1) bouton replié d'une section : le lecteur d'écran annonce « Replier » même quand il est désactivé (BarreLaterale.tsx) ; (2) l'entrée active du menu n'est plus en gras (reste repérable : fond + barre orange) ; (3) « Réponses automatiques » : on ne peut pas écrire les réponses ni créer un mot depuis l'écran (textes fixes côté serveur) : nouveauté à décider par Williams.

**Décisions de Williams (ne pas redemander)** : formats « Bientôt » sans moteur = retirés partout ; « Vidéos validées » visible par défaut ; vidéo sans réseau connu → réseaux par défaut, pastilles atténuées ; zip « Tout télécharger » = validées seulement ; « Cas concret MD » → « Cas concret » ; jamais « Zernio », « Buffer », « kit », « variante » dans un libellé ; rien ne bloque une vidéo ; aucun prix affiché ; privilégier le CLOUD pour les auteurs (ne pas saturer le PC).

**Organisation** : les sessions cloud écrivent, testent, poussent, ouvrent la PR et NE FUSIONNENT JAMAIS (`docs/REGLES-ROUTINES.md`). La session locale (orchestratrice, légère) relit, fait relire les zones sensibles, fusionne (`gh pr merge --squash`) et met en ligne. La CI GitHub ne lance vitest que sur certains dossiers : les tests du lot sont la preuve, rejoués par l'auteur.

**Pièges** : clone principal du PC partagé avec d'autres sessions → jamais de checkout dedans (worktree ou cloud) ; machine lente (vitest 80-120 s, délais de 5 s dépassés sous charge → `--testTimeout=60000`) ; le dépôt n'applique pas prettier (ne pas reformater) ; LF.

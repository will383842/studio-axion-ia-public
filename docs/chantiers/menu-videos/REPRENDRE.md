# REPRENDRE — chantier « menu + vidéos » du studio (état 09/11/2026)

> Bloc du haut = à lire en premier. Le plan complet est dans `PLAN.md` (même dossier), la consigne des auteurs dans `CONSIGNE-AUTEURS.md`.

**Objectif (Williams, 08/11)** : menu latéral parfaitement compréhensible ; vidéos classées par réseau et par type, pastille du réseau ; fiche vidéo rapide et claire ; page « Vidéos validées » avec export ; Réglages rangés ; « fais tout de bout en bout ».

**Fusionné dans master** : #249 menu en sections · #247 recherche des pages · #250 « Cas concret » · #248 socle vidéos (réseaux, pastilles, BoutonValider, route `/api/telechargements/video`) · #251 Mes vidéos (filtres réseau/étape) · #252 fiche plus rapide · #253 nouvelle fiche vidéo.

**Fusionné aussi le 09/11** : #255 test perf-fiche-video · #257 Réglages rangés (G) · #258 Vidéos validées (V) · #260 Image → vidéo (I) · #262 menu « À publier » → « Vidéos validées » (N). Tous relus par un relecteur Opus ; CI verte.

**Reste** :
1. Comparaison des tests base/tête (branche `verif/comparaison`, RAPPORT-COMPARAISON.md) : isole les échecs causés par les 5 PR. La suite complète en cloud donne 122 fichiers en échec dont beaucoup d'environnement (studio-rendu/node_modules absent) ; rapport brut sur `verif/vitest-complet`. Suspects : tests/image-video/interface.test.ts, navigation-formats (icônes uniques), tests/image-video/lot/lien-prive.test.ts (TS2769).
2. Mise en ligne par la session studio locale (procédure : `deploiement/README.md`, `mettre-a-jour.sh`), après avoir dit à Williams ce qui sera fait.
3. Nettoyage : branches fusionnées, routines cloud temporaires STUDIO-*, worktrees.

**Décisions de Williams (ne pas redemander)** : formats « Bientôt » sans moteur = retirés partout ; « Vidéos validées » visible par défaut ; vidéo sans réseau connu → réseaux par défaut, pastilles atténuées ; zip « Tout télécharger » = validées seulement ; « Cas concret MD » → « Cas concret » ; jamais « Zernio », « Buffer », « kit », « variante » dans un libellé ; rien ne bloque une vidéo ; aucun prix affiché ; privilégier le CLOUD pour les auteurs (ne pas saturer le PC).

**Organisation** : les sessions cloud écrivent, testent, poussent, ouvrent la PR et NE FUSIONNENT JAMAIS (`docs/REGLES-ROUTINES.md`). La session locale (orchestratrice, légère) relit, fait relire les zones sensibles, fusionne (`gh pr merge --squash`) et met en ligne. La CI GitHub ne lance vitest que sur certains dossiers : les tests du lot sont la preuve, rejoués par l'auteur.

**Pièges** : clone principal du PC partagé avec d'autres sessions → jamais de checkout dedans (worktree ou cloud) ; machine lente (vitest 80-120 s, délais de 5 s dépassés sous charge → `--testTimeout=60000`) ; le dépôt n'applique pas prettier (ne pas reformater) ; LF.

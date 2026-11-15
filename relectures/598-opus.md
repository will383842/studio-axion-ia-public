# Relecture PR 598 (L0-13d) — Opus

**VERDICT : OK — FUSION POSSIBLE sur la tête complète 2536c9aa3f0b93c3535807995eba15e3376207a8**

## Vérifications
- Fichiers modifiés (11) : tous dans `fichiers_autorises`. `tests/zernio/z2s-corbeille.test.ts` et `scripts/echecs-connus.json` inchangés.
- Critère 1 : `messageCorbeille` → « N brouillon(s) reste(nt) chez l'outil d'envoi : à supprimer dans l'outil. » ; `grep "dans Buffer ou Zernio" src/` = 0.
- Critère 2 : `src/domaine/corbeille.ts` sans « Buffer » ; `src/services/corbeille.ts` ne le porte qu'à la clé alias (l.32 type, l.86 commentaire « alias L0-13, retiré par L0-13h », l.87 retour).
- Critère 3 : `mettreALaCorbeille`, `annulerVideo` (`{...r}` + branche refus), `nettoyerVideos` et les 3 actions renvoient `brouillonsExternes` et `brouillonsBuffer`, même valeur.
- Critère 4 : les 4 composants lisent `brouillonsExternes` seulement (aucun `brouillonsBuffer` dans src/components).
- Critère 5 : comptage inchangé (`estChezUnOutil` : historique buffer ET zernio) ; nouveau test prouve 2 brouillons comptés et publications toujours en base.
- Données : aucune suppression ni réécriture ajoutée ; seule la clé de retour est renommée (alias de lecture gardé). Liste des jamais-supprimables non touchée. `envoyerVersBufferAction` non touchée.
- Critère 6 (sonde jetable) : « // Buffer » ajouté dans domaine/corbeille.ts et « // envoi Buffer » dans services/corbeille.ts → règles 1 et 2 échouent. Sondes retirées.
- Test rouge d'abord : tests de la PR sur le src de master → 6 échecs.
- Critère 7 + tests ciblés : corbeille, corbeille-ui, st-05, zernio/z2s-corbeille → 4 fichiers, 51 tests verts.
- Aucun appel réel, aucun nom de personne dans le diff.
- Contrôles GitHub : 8/8 verts (build réel, garde de zone, eslint/tsc différentiels, garde interne, règles de fer, next build, tests nouveaux, tests touchés).

## Remarque (non bloquante)
- `tests/st-05-corbeille-sans-buffer.test.ts` règle 3 bis ne vérifie l'absence de « dans Buffer ou Zernio » que dans 4 fichiers, pas tout `src/` (vrai aujourd'hui par grep).

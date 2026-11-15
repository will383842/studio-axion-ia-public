# Relecture PR 569 — REPERE-PUBLICATION (Opus)

VERDICT : À CORRIGER (une seule correction, mineure) — tête complète relue 2b84579812e25a1e73e110b50941a93f85913f91

1. tests/usine/repere-publication.test.ts (aucun cas) / garde src/services/repere-publication.ts:15 — gravité MINEURE (manque de test, le code est juste).
   La garde `if (!pub.videoId) return null;` n'est couverte par aucun test : la mutation qui la supprime laisse les 6 tests verts.
   Or elle protège le critère « hors usine : null, aucun repère inventé » : POST /api/usine/commandes avec `visuelId` crée un créneau `cmd-<clé>` SANS videoId ;
   sans la garde, `c.videoId === undefined` rattache alors toute publication de visuel à cette commande (repère inventé). Vérifié par sonde jetable.
   Correction attendue : ajouter dans le test un cas « commande avec visuelId (créneau cmd- sans vidéo) + publication de visuel sans videoId → null ».
   Aucun autre fichier à toucher.

Remarques non bloquantes :
- Le test de bout en bout enregistre la publication directement « publiee » ; le passage brouillon → programmee → publiee est couvert par le premier test (même commande, même vidéo). Acceptable.
- Le contrat (CONTRATS-ECHANGE, appel 6) prévoit aussi `definitions` ; la fiche (qui l'emporte) ne le liste pas, la ligne ne le porte pas : conforme à la fiche, à reprendre par la fiche de la route GET /api/usine/releves.
- Les sources « buffer » et « api » du studio rendent null (pas de source inventée) : conforme.
- Branche en retard d'un commit sur master (f98e77a, sans rapport) ; fusion sans conflit.

Tête relue : 2b84579812e25a1e73e110b50941a93f85913f91

## Avancement
- [x] Fichiers modifiés = exactement les 3 nouveaux fichiers de la fiche ; src/services/publications.ts et scripts/echecs-connus.json non touchés.
- [x] Fusion avec master f98e77a propre (branche 1 commit en retard, sans conflit).
- [x] Test de la PR : 6/6 verts.
- [x] tsc : 146 erreurs sur master f98e77a, 146 identiques sur la branche (diff vide, aucune dans les nouveaux fichiers) ; eslint propre sur les 3 fichiers.
- [x] Sondes jetables (non poussées) : repère rendu aux 4 statuts (brouillon, programmee, publiee, echec), dépôts par défaut compris ; signature vide du créneau → script maître ; script sans origineUsine → null ; repère absent → null ; publication de visuel sans vidéo → null (même avec un créneau cmd- sans vidéo) ; publications de démonstration → toutes null ; aucune écriture ; ligne : 14 clés exactes, jours 7/30, source saisie, portee/durée absentes → null, source « api » → null, ni texte ni signature.
- [x] Mutations à la main (14) : 13 tuées (préfixe cmd-, même vidéo, réseau, signature créneau, signature script, repère inventé, hors usine non null, jour, source, portee, commande_id, texte ajouté, code_version) ; 1 survivante : suppression de la garde videoId (voir point 1).
- [x] Aucun nom ni prénom de personne dans le diff ni dans le message de commit ; données fictives seulement.
- [x] Tête de la PR inchangée en fin de relecture (git ls-remote : 2b84579812e25a1e73e110b50941a93f85913f91).

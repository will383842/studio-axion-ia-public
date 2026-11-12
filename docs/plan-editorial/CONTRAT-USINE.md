# Contrat entre le plan éditorial et l'usine à contenu

Le plan éditorial (`src/services/plan-editorial.ts`) tient le calendrier des créneaux. L'usine propose, le Studio décide.

## Isolation
- Le plan n'importe jamais `src/fournisseurs` (réseau, modèle d'IA, diffuseur) et n'effectue aucun appel. Le test `tests/plan-editorial/contrat-isolation.test.ts` échoue au premier import de ce type, y compris dans un module local importé (suivi récursif).
- Les dépôts sont passés en paramètre : le service ne connaît pas la base.

## Ce que l'usine peut écrire
- Seulement les statuts `propose`, `a_valider` et `archive`. Jamais `programme`, `publie` ni `echec` : c'est le Studio, sur geste du fondateur.
- L'usine peut poser un repère et une signature : le créneau est alors « confié ».

## Décalage
- Un décalage = une ligne ajoutée au journal (`journalDecalages`), jamais modifiée ni effacée.
- Même clé d'idempotence = une seule ligne, un seul décalage.
- Un créneau publié (ou archivé) ne se décale pas : erreur.
- Un créneau confié à l'usine reçoit `aRenvoyer = true`, sans aucun appel : c'est l'usine qui viendra le relire.
- L'heure de Paris est conservée ; les instants restent en UTC.

## Porte unique `peutProgrammer`
Seul un créneau `valide`, valide au sens du plan, avec un média, au moins une heure et sans `aRenvoyer` passe. `identifiantsProgrammation` donne la correspondance avec les envois planifiés : une clé d'envoi par réseau géré, la version étant le nombre de décalages.
- Rejeu d'une clé déjà consommée : le créneau n'est réappliqué que si la ligne de cette clé est la dernière du créneau et que le créneau est encore à son ancien jour ; sinon il est rendu tel quel (jamais de retour en arrière, jamais de nouvelle ligne). Le test ne dépend pas de l'ordre de lecture du journal : il compte les lignes du créneau (exactement une non appliquée). En réapplication, le jour et la raison sont ceux de la ligne du journal, jamais ceux de la nouvelle demande.
- Une nouvelle clé est refusée tant qu'une ligne du créneau n'a pas été appliquée (panne entre le journal et le créneau) : rejouer d'abord la clé en attente.
- Un rejeu qui doit réappliquer un créneau passé entre-temps à « programme » ou « echec » est refusé (« Décalage refusé »), par prudence.

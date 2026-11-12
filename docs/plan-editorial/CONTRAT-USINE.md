# Contrat entre le plan éditorial et l'usine à contenu

Le plan éditorial (`src/services/plan-editorial.ts`) tient le calendrier des créneaux. L'usine propose, le Studio décide.

## Isolation
- Le plan n'importe jamais `src/fournisseurs` (réseau, modèle d'IA, diffuseur) et n'effectue aucun appel. Le test `tests/plan-editorial/contrat-isolation.test.ts` échoue au premier import de ce type.
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

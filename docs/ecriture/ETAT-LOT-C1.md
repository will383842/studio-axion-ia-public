# État du lot C1 (18/10/2026)

Terminé, NON BRANCHÉ (aucun générateur ne l'appelle ; branchement C2-C4) : C1.1 ressemblance, C1.2 mémoire, C1.3 banque de formes,
C1.4 service `src/services/memoire-ecriture.ts` (source image → vidéo : reste à faire en C4), C1.5 calibrage
(`CALIBRAGE-RESSEMBLANCE-2026-10-18.md`), C1.6 règle d'entrée de format (`AJOUTER-UN-FORMAT.md` § 2 bis).
Les exceptions datées existent déjà (`src/domaine/ecriture-commune/contrat-format.ts`) : facecam, tableau-anime, cas-concret, facecam-animee, et
image-video (format masqué mais ouvert dans la navigation, donc traité comme actif ; exception ajoutée après la relecture, **à valider par Will**).
L'avocat reste hors contrat et hors mémoire commune. Reste (C2-C4) : brancher les générateurs sur la recette, la mémoire, les contrôles et le débit
mesuré, puis lever chaque exception.

## Mise à jour lot G4 (19/10/2026) : contrat réel des formats

Fait : contrats déclarés pour `facecam` (recette, mémoire, contrôles : **chaîne courte seulement**), `tableau-anime` (idem ; n'utilise qu'une partie de la recette, éléments 3 à 7) et `cas-concret` (mémoire, contrôles ; sa recette commune n'est PAS branchée : il écrit avec sa propre recette R01…), avec preuves vérifiées par test (module et constante existent).
Les cinq exceptions ont une fin de validité (31/12/2026) et une condition de levage ; la date « aujourd'hui » est injectée dans le test : passé le 31/12/2026, **rien ne bloque** tant que personne ne change cette date, la CI ne rougira pas seule. **Un rappel daté est nécessaire le 31/12/2026** pour lever ou prolonger les exceptions.
Face caméra : recette, mémoire et ressemblance n'existent que sur la chaîne courte ; la grande chaîne (mode « Je choisis », réglage `generateur.chaine`) et `equipe` sont couvertes par une exception à périmètre (jusqu'au 31/12/2026 ; levée : brancher recette, mémoire et ressemblance sur la grande chaîne et sur `equipe`, ou retirer ces deux chaînes).
Mémoire et contrôle de ressemblance sont **branchés mais réglage coupé par défaut** (`ecriture.memoireCentrale`, `ecriture.memoireTableau`, `ecriture.memoireCasConcret`) : en production aucune mémoire anti-copie n'est active tant que Will n'a pas allumé les interrupteurs (Réglages › Écriture des scripts).
Chaque preuve nomme son module écrivain (`utilisePar`) et le test lit ce fichier pour vérifier qu'il importe nommément ce symbole depuis le module de la preuve (un autre symbole du même module ne suffit pas).
Reste : **le débit mesuré n'existe pour aucun format** (aucun relevé de scripts par heure) : aucun contrat n'est complet, les exceptions restent, réduites à ce qui manque. `facecam-animee` et `image-video` n'ont toujours ni recette, ni mémoire, ni contrôles communs (aucun importeur).

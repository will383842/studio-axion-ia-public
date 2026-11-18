# Bureau exemple : écrans d'outils neutres et vivants (T-EXT-49)

Une seule page, 5 vues vivantes, sans aucune marque réelle, à la charte Axion. Elle sert à filmer une automatisation qui n'a pas de tableau de bord (tri d'e-mails, relances, saisie de factures). Pilotage : `window.demoMaquette.aller(etapeId)` (contrat de T-EXT-01) ; `reinitialiser()` revient à la boîte de réception, état `avant`, sans animation.

## Fichiers
`index.html`, `styles.css`, `etats.js` (états permis, logique pure), `app.js` (dessin et porte), `demo-data.js` (données par défaut), `noms.json` (noms neutres), ce fichier.

## Vues et états
| Vue | Nom affiché | États |
|---|---|---|
| `boite` | Espace démo · Boîte de réception | `avant`, `liste`, `nouveau`, `ouvert`, `etiquete`, `brouillon` |
| `agenda` | Espace démo · Agenda | `semaine`, `creneau-propose`, `confirme` |
| `tableur` | Espace démo · Tableur | `lignes`, `ligne-ajoutee`, `colonne-a-jour` |
| `crm` | Espace démo · Clients | `fiche-vide`, `fiche-remplie`, `etape-suivante` |
| `messagerie` | Espace démo · Messages | `fil`, `notification`, `tache-creee` |

Organisation affichée partout : « Entreprise exemple ». Le bandeau `.mention-demo` (« Démonstration · données d'exemple ») est toujours visible.

## Format des données (`demo-data.js`)
`window.DONNEES_ECRANS = { version: 1, etapes: [{ id, vue, etat }], contenus: { boite, agenda, tableur, crm, messagerie } }`.
- 9 étapes au plus ; ids en minuscules sans accent (lettres, chiffres, tirets), uniques ; chaque étape nomme une vue et un état de la table ci-dessus.
- Chaque élément de contenu porte `exemple: true` ; adresses en `@exemple.invalid` ; aucun montant (« selon votre grille »).
- Les étiquettes de tri (dossiers) sont des données, pas du code.
- Ce fichier est REMPLACÉ pour chaque vidéo (T-EXT-50 en écrit une copie depuis le scénario validé). Les textes par défaut ne servent qu'à la preuve de capture : une vidéo n'affiche que le contenu du flux validé et les libellés ci-dessous.

## Libellés d'interface de `app.js` (registre des textes, T-EXT-40)
- Entreprise exemple
- Boîte de réception
- non lus
- Nouveau
- ← Retour
- Dossiers
- À valider
- Envoyer (simulation, aucun envoi)
- Agenda
- Créneau proposé
- Confirmé
- Tableur
- À vérifier
- Clients
- Messages
- Tâche créée

## Règles
- Déterministe : durées d'animation fixes (200 à 600 ms ; glissement de vue 300 ms), ni `Date.now`, ni hasard, ni réseau, aucune image fixe : tout est en HTML vivant.
- `aller(id)` rend une promesse résolue à la fin de l'animation (`true`) ; id inconnu : erreur en console, rien ne bouge, promesse résolue à `false`.
- Texte jamais sous 28 px (lisible en 4:5, 1080 × 1350, et en 9:16).
- **Jamais sur le PC de Williams** : tout navigateur (Playwright) et tout rendu d'essai se font en session cloud ou en CI seulement.

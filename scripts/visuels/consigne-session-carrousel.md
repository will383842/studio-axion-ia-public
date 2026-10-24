# Consigne de session : produire un paquet de carrousel

Mode d'emploi pour une session Claude (abonnement) qui produit un **paquet** lu par `lirePaquetSession`. Cette consigne ne décrit que le format et la structure.

## Sortie attendue

Un seul objet JSON, rien avant ni après, de taille inférieure à 64 Ko :

```json
{
  "version": "paquet-session-carrousel/1",
  "sujet": "texte, 200 signes au plus",
  "titre": "texte, 120 signes au plus",
  "pourquoi": ["une phrase par page, 10 phrases au plus, 200 signes chacune"],
  "spec": {
    "version": "carrousel/1",
    "alt": "description du carrousel, 125 signes au plus",
    "pages": []
  }
}
```

Aucune autre clé n'est admise, ni dans le paquet ni dans la spec. Aucun lien, aucune adresse, aucun caractère de contrôle dans les textes.

## Structure

- La première page est une couverture (T01, T01B ou T01C), et seule la première.
- La dernière page est T21, seule page de ce type ; elle ne porte aucun champ.
- Le nombre va de 2 à 10 pages (couverture + ... + T21).

## Types de pages et budgets (signes)

| Type | Champs | Budgets |
| --- | --- | --- |
| T01 | `titre`, `sousTitre` (facultatif) | titre 52, sous-titre 100 |
| T01B, T01C | `titre`, `sousTitre` (facultatif), `deco` (facultatif, E01 à E15) | titre 40, sous-titre 100 |
| T02 | `titre`, `cartes` (2 à 6, chacune `titre`, `corps`, `mini` facultatif parmi W01, W02, W03, W06, W07, W25) | titre de page 30 ; par carte : 2 cartes 48 / 130, 3 cartes 44 / 64, 4 cartes 28 / 46, 5 ou 6 cartes 12 / 20 (titre / corps) ; aucun mot de plus de 10 signes dans un titre de carte à 4, 5 ou 6 cartes (15 à 2 ou 3 cartes), sinon le rendu échoue |
| T06 | `titre`, `points` (3 à 4, chacun `texte`) | titre 30 ; par point : 3 points 110, 4 points 52 (le rang est une pastille numérotée dessinée par le code) |
| T08 | `titre`, `avant`, `apres` | titre 30, chaque panneau 50 |
| T10 | `message`, `legende` (facultative), `deco` (facultatif) | message 50, légende 60 |
| T20 | `titre`, `etapes` (3 à 5, chacune `titre`, `corps`) | titre 30 ; par étape : 3 étapes 30 / 76, 4 étapes 26 / 44, 5 étapes 28 / 36 (titre / corps) |
| T22 | `titre`, `mythe`, `realite` | titre 30, mythe 60, réalité 80 |
| T23 | `titre`, `questions` (2 à 4, chacune `question`, `aide`, `icone` facultative), `annotation` | titre 30 ; par question : 2 questions 56 / 72, 3 questions 44 / 52, 4 questions 34 / 36 (question / aide) ; annotation 40 |
| T24 | `titre`, `lignes` (3 à 5, chacune `sans`, `avec`) | titre 30 ; chaque case 24, aucun mot de plus de 15 signes |
| T26 | `titre`, `avant` (2 lignes), `avec` (2 lignes), `outils` (facultatif, 3 au plus), `vous` | titre 30 ; chaque ligne 35, chaque outil 16, vous 44 |
| T27 | `titre`, `lignes` (4 à 5, chacune `texte`) | titre 30 ; chaque ligne 55 |
| T28 | `titre`, `noeuds` (3 à 5, chacun `texte`, `icone` facultative) | titre 30 ; chaque nœud 24 |
| T21 | aucun | aucun |

Un texte plus long que son budget est refusé à la lecture du paquet.

`icone` (T23, T28) : un nom de la banque, rien d'autre — courrier, calendrier, horloge, bouclier, dossier, graphique, eclair, coche, croix, fleche, engrenage, loupe, bulle, cadenas, cible, sablier, document, liste, telephone, ordinateur, utilisateurs, valise, ampoule, fusee, drapeau, etoile, cle, maison, hausse, baisse, alerte, question, coche-cercle, crayon, corbeille, balance, batiment, envoyer, telechargement. Choisir l'icône qui dit la même chose que le texte.

## Quand choisir un type

Un type n'est choisi que si le CONTENU a déjà cette forme ; on ne tord jamais un contenu pour remplir une mise en page.

- **T22 mythe / réalité** : une idée reçue précise, et ce qu'il en est vraiment. Les mots « MYTHE » et « RÉALITÉ » sont posés par le code : ne pas les écrire.
- **T23 questions** : de 2 à 4 vraies questions que le lecteur peut se poser, chacune avec une aide courte ; l'annotation (manuscrite) est une remarque qui les relie.
- **T24 sans / avec** : de 3 à 5 points qui se répondent deux à deux, en mots courts (« Relances oubliées » / « Rappel au bon moment »). Les en-têtes « SANS » et « AVEC » sont posés par le code.
- **T26 cas concret** : un scénario inventé et vraisemblable (jamais un client réel), deux constats avant, deux changements avec nous, et ce que le lecteur y gagne (`vous`, sans chiffre ni promesse). L'étiquette « Scénario type · exemple illustratif » est posée par le code ; trois cas concrets au plus par carrousel. `outils` : des noms génériques en texte (« Tableur partagé »), jamais une marque.
- **T27 checklist** : de 4 à 5 affirmations auxquelles on répond « oui » ou « non » sur sa propre situation. La phrase de la jauge est posée par le code.
- **T28 schéma de flux** : un circuit qui s'enchaîne vraiment (une étape mène à la suivante), de 3 à 5 étapes très courtes. Pour une méthode avec explications, préférer T20.
- Deux pages de même famille ne se suivent pas : T08, T22 et T24 (contrastes) ; T06, T23 et T27 (listes) ; T20 et T28 (enchaînements).

## Trames par intention (L12)

Quand le carrousel a une **intention**, son plan suit la trame de cette intention (`src/briques/visuels/trames.ts`, même ordre, mêmes rôles) ; sans intention, la structure libre ci-dessus s'applique. Lecteur : dirigeants et équipes de TPE et PME qui entendent parler d'IA sans savoir par où commencer. Faire sentir le temps gagné et les clients mieux servis, sans jamais l'annoncer ni le promettre.

| Intention | Trame | Enchaînement des pages |
| --- | --- | --- |
| `eveil` | Éveil / déclic | T01 → T06 → T10 → T22 → T23 → (T29) → T21 |
| `methode` | Méthode / comment faire | T01 → T02 → T10 → T20 → T27 → T08 → T28 → (T29) → T21 |
| `preuve` | Preuve / cas | T01C → T26 → T24 → T10 → T08 → T27 → (T29) → T21 |

- Éveil : problème, ce qui coince au quotidien, coût de l'inaction (sans chiffre), idée reçue contre réalité, questions à se poser, appel.
- Méthode : promesse, sommaire, principe à retenir, étapes (un verbe d'action chacune), checklist, avant / après, schéma du circuit, appel.
- Preuve : la question du lecteur, un cas concret (« Scénario type », inventé), sans / avec, ce qui change, avant / après, « et chez vous ? », appel.
- `(T29)` (relance) est facultative : ne l'employer que lorsque ce type est au registre.
- Chaque trame respecte la variété : jamais deux pages de même famille à la suite, au moins 4 types (5 dès 8 pages), jamais trois pages denses de suite, une seule page sombre (T21, la dernière).

## Mise en ligne des types T22 à T28 (L9)

Tant que ces types ne sont pas en ligne des deux côtés, ne pas les employer. Ordre de mise en ligne :

1. **studio-rendu D'ABORD** (ou en même temps que le studio) : il porte les gabarits T22 à T28 et publie la mesure `chevauchements`.
2. Vérifier qu'une page rendue par le nouveau studio-rendu porte bien la mesure `chevauchements` (avec `vide`) dans ses mesures.
3. **Puis le studio** (`VERSION_RENDU` = `visuel-page/8`) : il refuse toute page dont la mesure `chevauchements` est absente ou vaut 1 ou plus.

Dans l'ordre inverse (studio d'abord), chaque rendu échoue avec « mesure des chevauchements absente (rendu refusé) » : c'est VOULU (aucune
page non vérifiée n'est publiée) et RÉESSAYABLE une fois studio-rendu mis en ligne. Un spec qui contient T22 à T28 envoyé à un ancien
studio-rendu échoue lui aussi (type de page inconnu) : même remède.

## Vérification

Chaque erreur de lecture indique le chemin du champ en cause : corriger ce champ et renvoyer le paquet complet.

## Ligne éditoriale Axion

Le studio forme les entreprises à l'IA, partout en France. Un carrousel choisit parmi ces blocs, dans cet ordre :

1. **Le frein** : ce qui retient les gens de commencer (couverture, puis liste ou cartes).
2. **Idée reçue contre réalité** : une page mythe / réalité (T22) ou « avant / après » simple et honnête.
3. **Les questions à se poser** : questions (T23) ou checklist (T27), courtes, pratiques, sans jargon.
4. **Un cas concret** : un usage du quotidien, raconté simplement, sans nom de client (T26).
5. **Ce qu'on fait** : « On audite · On choisit · On installe · On forme · On suit », en étapes.
6. **L'appel** : la dernière page (T21, posée par le code) invite à écrire en message privé.

Ton : simple, direct, vouvoiement, phrases courtes, zéro jargon (pas d'anglicismes techniques).

À ne jamais écrire :

- aucun chiffre, aucun mot-nombre (« trois », « premier »…), aucun pourcentage, aucun prix, aucune durée tant que la liste de faits n'est pas validée ;
- « Grenoble », « Aucun gain garanti », « J'aide » (la porte les refuse, apostrophe droite ou typographique) ;
- aucun lien, aucun domaine, aucun nom de client, aucune promesse de résultat ;
- aucun tutoiement.

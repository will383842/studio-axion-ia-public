import { CAPACITE_ANNOTATION, CAPACITE_CAS, CAPACITE_CHECKLIST, CAPACITE_CITATION, CAPACITE_COMPARAISON, CAPACITE_MYTHE, CAPACITE_NOEUD, CAPACITE_PANNEAU, capaciteCarte, capaciteMotCarte, capaciteEtape, capaciteListe, capaciteQuestion, PAGES, type TypePage } from "../../src/briques/visuels/registre-pages.js";
import { LIMITES } from "../../src/briques/visuels/limites.js";

/**
 * Contenu FIGÉ et INVENTÉ de l'essai VisuelPage (M1-04) : thème neutre, aucun chiffre, aucune marque, aucun fait réel.
 * Page 0 : couverture T01 (variante A) ; page 1 : page dense T02 (quatre cartes).
 */
export const CONTENU_ESSAI = {
  version: "carrousel/1",
  alt: "Carrousel d'essai : quatre tâches du quotidien d'un bureau, une couverture puis une page de quatre cartes",
  pages: [
    { type: "T01", titre: "Quatre tâches qui rythment un bureau", sousTitre: "Le quotidien, sans fard" },
    {
      type: "T02",
      titre: "Le quotidien d'un bureau",
      cartes: [
        { titre: "Trier le courrier", corps: "Chaque pli trouve sa pile.", mini: "W01" },
        { titre: "Tenir l'agenda", corps: "Un rendez-vous en déplace trois.", mini: "W02" },
        { titre: "Rédiger un bilan", corps: "Écrit tant que c'est frais.", mini: "W03" },
        { titre: "Ranger dossiers", corps: "Plus rien ne se perd.", mini: "W06" },
      ],
    },
  ],
} as const;

/**
 * Contenu FIGÉ et INVENTÉ du PDF d'essai (M2-02/M2-04) : 9 pages (une couverture T01, huit pages denses T02 de quatre cartes (la page de six cartes ne porte que 12 / 20 signes : elle n'est plus le cas d'essai)).
 * Même thème neutre que ci-dessus : aucun chiffre, aucune marque, aucune adresse, aucun visage.
 */
const THEMES_PDF = [
  ["Le matin au bureau", [["Ouvrir les volets", "La lumière entre la première.", "W01"], ["Chauffer l'eau", "Le café attend son tour.", "W02"], ["Relire la liste", "Rien ne doit manquer.", "W03"], ["Allumer l'écran", "Le jour commence ici.", "W06"], ["Saluer l'équipe", "Un mot suffit souvent.", "W07"], ["Choisir la tâche", "La plus lourde d'abord.", "W25"]]],
  ["Les rendez-vous", [["Préparer la salle", "Chaises alignées, table propre.", "W02"], ["Accueillir", "Un sourire avant le dossier.", "W01"], ["Écouter", "Noter sans interrompre.", "W03"], ["Reformuler", "Dire ce qu'on a compris.", "W07"], ["Conclure", "Un prochain pas clair.", "W06"], ["Remercier", "Le message part le soir même.", "W25"]]],
  ["Les dossiers qui dorment", [["Les trier", "Trois piles, pas une de plus.", "W06"], ["Les relire", "Un regard neuf aide.", "W03"], ["Les classer", "Un nom, une place.", "W01"], ["Les archiver", "Ce qui est clos s'éloigne.", "W02"], ["Les jeter", "Sans regret ni hésitation.", "W07"], ["Les retrouver", "Le plus dur est fait.", "W25"]]],
  ["Les échanges écrits", [["Un objet net", "Le sujet tient en peu de mots.", "W03"], ["Une phrase courte", "Une idée par ligne.", "W01"], ["Un ton posé", "La colère attend demain.", "W07"], ["Une relecture", "Les fautes se cachent.", "W02"], ["Un envoi calme", "Pas de hâte inutile.", "W06"], ["Un suivi", "Le silence se relance.", "W25"]]],
  ["Le rangement du bureau", [["Vider un tiroir", "Un seul à la fois.", "W06"], ["Garder l'utile", "Le reste s'en va.", "W01"], ["Étiqueter", "Une étiquette lisible.", "W03"], ["Essuyer", "Un chiffon suffit.", "W02"], ["Poser les stylos", "Dans un pot, debout.", "W25"], ["Admirer", "Cinq minutes de calme.", "W07"]]],
  ["Les petits imprévus", [["Un appel arrive", "On décroche calmement.", "W07"], ["Une panne d'encre", "Le crayon dépanne.", "W25"], ["Un dossier perdu", "Il est sous la pile.", "W06"], ["Une porte claque", "Le courant d'air passe.", "W01"], ["Un oubli", "On le note aussitôt.", "W03"], ["Un bon retour", "On la partage.", "W02"]]],
  ["La pause de midi", [["Quitter l'écran", "Les yeux se reposent.", "W02"], ["Marcher un peu", "Le dehors fait du bien.", "W01"], ["Manger sans lire", "Un repas, rien d'autre.", "W25"], ["Changer de sujet", "Le bureau patiente.", "W07"], ["Respirer", "Trois grandes inspirations.", "W03"], ["Revenir", "Le pas plus léger.", "W06"]]],
  ["Le soir venu", [["Faire le point", "Ce qui est fait compte.", "W03"], ["Noter demain", "Trois lignes au plus.", "W06"], ["Ranger le bureau", "Il attendra propre.", "W25"], ["Éteindre", "L'écran puis la lampe.", "W02"], ["Fermer la porte", "Un tour de clé.", "W01"], ["Rentrer", "Le bureau reste ici.", "W07"]]],
] as const;

export const CONTENU_ESSAI_PDF = {
  version: "carrousel/1",
  alt: "Carrousel d'essai : une journée de bureau racontée en huit pages de quatre cartes, après une couverture",
  pages: [
    { type: "T01", titre: "Une journée de bureau, sans fard", sousTitre: "Huit moments, quatre gestes chacun" },
    ...THEMES_PDF.map(([titre, cartes]) => ({
      type: "T02" as const,
      titre,
      cartes: cartes.slice(0, 4).map(([t, corps, mini]) => ({ titre: t, corps, mini })),
    })),
  ],
};

/** Fichiers produits, dans l'ordre des pages. */
export const FICHIERS_ESSAI = ["t01-couverture-a.jpg", "t02-page-dense.jpg"] as const;

/** Mini-visuels utilisés pour les essais de capacité (les six existants). */
export const MINIS_ESSAI = ["W01", "W02", "W03", "W06", "W07", "W25"] as const;

/** Texte inventé (lettres et espaces seulement, aucun chiffre ni adresse) de EXACTEMENT `longueur` caractères. */
export function texteInvente(longueur: number, graine = 0): string {
  const mots = ["ranger", "classer", "noter", "relire", "trier", "poser", "choisir", "garder", "ouvrir", "fermer", "lire"];
  let texte = "";
  for (let i = graine; texte.length < longueur; i++) texte += `${mots[i % mots.length]} `;
  return texte.slice(0, longueur).trimEnd().padEnd(longueur, "x");
}

/** Mots français de 12 à 15 lettres : la forme de corps la plus rude (une ligne ne se coupe pas au milieu d'un mot, les fins de ligne restent vides). */
export const MOTS_LONGS = ["accompagnement", "administratives", "communication", "organisation", "responsabilité", "correspondance", "indispensables", "vérifications", "établissement", "documentation", "automatiquement", "planification", "hiérarchiques", "coordination"] as const;

const MOTS_COURTS = ["de", "et", "les"] as const;

/**
 * Complète `texte` avec des mots courts (« de », « et », « les ») jusqu'à EXACTEMENT `longueur` signes (sans espace finale). Quand aucun
 * mot court ne tient, le reste est un MOT de lettres de renfort, séparé par une espace (jamais collé au dernier mot, qui peut être long) ;
 * s'il ne reste qu'un signe, on allonge le dernier mot seulement sous `plafond`, sinon un « de » ou « et » devient « les » (+1 signe).
 */
function completer(texte: string, longueur: number, plafond = Infinity): string {
  let t = texte;
  for (let i = 0; t.length < longueur; i++) {
    const reste = longueur - t.length;
    const mot = MOTS_COURTS.find((m, k) => k >= i % MOTS_COURTS.length && m.length + 1 <= reste) ?? MOTS_COURTS.find((m) => m.length + 1 <= reste);
    if (mot) {
      t = t === "" ? mot : `${t} ${mot}`;
    } else if (t === "") {
      t = "x".repeat(Math.min(reste, plafond));
    } else if (reste >= 2) {
      t = `${t} ${"x".repeat(Math.min(reste - 1, plafond))}`;
    } else {
      const mots = t.split(" ");
      const k = mots.findIndex((m) => m === "de" || m === "et");
      const court = mots.findIndex((m) => m.length < plafond);
      if (mots[mots.length - 1].length < plafond) t += "x";
      else if (k >= 0) t = [...mots.slice(0, k), "les", ...mots.slice(k + 1)].join(" ");
      else if (court >= 0) t = [...mots.slice(0, court), `${mots[court]}x`, ...mots.slice(court + 1)].join(" ");
      else t = `${t.slice(0, -1)} x`; // tous les mots au plafond : le dernier perd une lettre et laisse place à un mot d'une lettre (+1 signe)
    }
  }
  return t.slice(0, longueur);
}

/** Les mots longs d'au plus `plafond` lettres ; si aucun ne convient, le plus court coupé au plafond. */
function motsPlafonnes(plafond: number): string[] {
  const mots = MOTS_LONGS.filter((m) => m.length <= plafond);
  return mots.length > 0 ? mots : [MOTS_LONGS[0].slice(0, plafond)];
}

/**
 * Texte à MOTS LONGS de EXACTEMENT `longueur` caractères : des mots entiers de 12 à 15 lettres, séparés par une espace, dans un ordre
 * qui dépend de `graine`, SANS plafond (la liste tourne) ; le dernier mot qui ne tient plus est remplacé par des mots courts pour
 * atteindre la longueur demandée. `plafond` limite la longueur d'un mot (titre de carte : `capaciteMotCarte`).
 */
export function texteMotsLongs(longueur: number, graine = 0, plafond = Infinity): string {
  const mots = motsPlafonnes(plafond);
  let texte = "";
  for (let i = graine; ; i++) {
    const mot = mots[i % mots.length];
    const suite = texte === "" ? mot : `${texte} ${mot}`;
    if (suite.length > longueur) break;
    texte = suite;
  }
  return completer(texte, longueur, plafond);
}

/**
 * Forme ADVERSAIRE de EXACTEMENT `longueur` caractères : un mot court puis un mot de 15 lettres, en alternance (« de automatiquement de
 * administratives … »). Le pire cas d'une ligne est un mot long juste après une fin de ligne : il saute à la ligne suivante et laisse la
 * précédente presque vide.
 */
export function texteAdversaire(longueur: number, graine = 0, plafond = Infinity): string {
  const plus = Math.max(...motsPlafonnes(plafond).map((m) => m.length));
  const quinze = motsPlafonnes(plafond).filter((m) => m.length === plus);
  let texte = "";
  for (let i = graine; ; i++) {
    const suite = `${texte === "" ? "" : `${texte} `}${MOTS_COURTS[i % MOTS_COURTS.length]} ${quinze[i % quinze.length]}`;
    if (suite.length > longueur) break;
    texte = suite;
  }
  return completer(texte, longueur, plafond);
}

/** Fabrique de texte d'un cas extrême : mots courants coupés à la longueur exacte (`texteInvente`), mots longs entiers (`texteMotsLongs`), ou alternance mot court / mot de 15 lettres (`texteAdversaire`). */
export type FabriqueTexte = (longueur: number, graine?: number, plafond?: number) => string;

/** Fichiers produits par l'essai M3a (types de pages T01B, T01C, T06, T08, T10, T20, T21), dans l'ordre des pages de `CONTENU_ESSAI_M3A`. */
export const FICHIERS_ESSAI_M3A = ["t01b-couverture-b.jpg", "t06-liste-numerotee.jpg", "t08-avant-apres.jpg", "t10-citation.jpg", "t20-etapes.jpg", "t21-derniere-page-sombre.jpg"] as const;
/** Fichier de la couverture C : une couverture n'est admise qu'en première page, elle a donc son propre carrousel d'essai. */
export const FICHIER_COUVERTURE_C_M3A = "t01c-couverture-c.jpg";
/** Fichier de l'essai de T08 au contenu MAXIMAL du schéma. */
export const FICHIER_T08_MAX_M3A = "t08-avant-apres-max.jpg";
/** Planche des 15 éléments décoratifs E01–E15. */
export const FICHIER_DECORS_M3A = "e01-e15-decors.jpg";

/** Couverture C, suivie de la page sombre (la dernière page ne vient jamais seule). */
export const CONTENU_ESSAI_M3A_C = {
  version: "carrousel/1",
  alt: "Carrousel d'essai : la couverture C sur le thème du rangement d'un bureau",
  pages: [{ type: "T01C", titre: "Ranger sans y penser", sousTitre: "Trois habitudes qui durent", deco: "E13" }, { type: "T21" }],
};

/** Contenu FIGÉ et INVENTÉ de l'essai M3a : thème neutre, aucun chiffre, aucune marque, aucun fait réel. La dernière page est la page sombre. */
export const CONTENU_ESSAI_M3A = {
  version: "carrousel/1",
  alt: "Carrousel d'essai : sept types de pages sur le thème du rangement d'un bureau",
  pages: [
    { type: "T01B", titre: "Un bureau enfin rangé", sousTitre: "Des gestes simples, sans jargon", deco: "E14" },
    {
      type: "T06",
      titre: "Avant de partir le soir",
      points: [{ texte: "Fermer les tiroirs et les fenêtres" }, { texte: "Éteindre les écrans et les lampes" }, { texte: "Noter une chose à faire demain" }, { texte: "Vider la corbeille à papier" }],
    },
    {
      type: "T08",
      titre: "Le bureau, avant et après",
      avant: "Des piles de papiers, des stylos partout.",
      apres: "Une seule pile, un seul carnet, tout à portée.",
    },
    { type: "T10", message: "Un bureau rangé libère l'esprit.", legende: "Un principe simple", deco: "E06" },
    {
      type: "T20",
      titre: "Ranger en quatre étapes",
      etapes: [
        { titre: "Tout sortir", corps: "Poser chaque objet sur la table." },
        { titre: "Trier", corps: "Garder, donner ou jeter." },
        { titre: "Classer", corps: "Une place pour chaque chose." },
        { titre: "Entretenir", corps: "Cinq minutes chaque soir." },
      ],
    },
    { type: "T21" },
  ],
} as const;

/** Une page de contenu extrême : `nom` décrit le cas (nombre d'éléments), `page` est un objet de page du schéma. */
export interface CasPage {
  nom: string;
  page: Record<string, unknown>;
}

/** Longueur des textes du contenu MINIMAL : un titre et un texte courts mais réalistes (le schéma accepte 1 signe, aucune page ne tient seule dessus). */
export const MIN_TITRE = 12;
export const MIN_TEXTE = 24;

const SOUS_TITRE_MAX = LIMITES.sousTitreMax;

/** Contenus MAXIMAUX du schéma pour ce type : un cas par nombre d'éléments, tous les textes à leur budget (le plus long que le schéma accepte). */
export function casMax(type: TypePage, texte: FabriqueTexte = texteInvente): CasPage[] {
  const titre = texteInvente(PAGES[type].titreMax);
  const { min, max } = PAGES[type].elements;
  const nombres = (bas: number, haut: number) => Array.from({ length: haut - bas + 1 }, (_, i) => bas + i);
  switch (type) {
    case "T01":
      return [{ nom: "titre et sous-titre au maximum", page: { type, titre, sousTitre: texte(SOUS_TITRE_MAX, 2) } }];
    case "T01B":
    case "T01C":
      return [{ nom: "titre et sous-titre au maximum", page: { type, titre, sousTitre: texte(SOUS_TITRE_MAX, 2), deco: "E01" } }];
    case "T02":
      return nombres(2, PAGES.T02.cartesMax).map((n) => {
        const c = capaciteCarte(n);
        return { nom: `${n} cartes au maximum`, page: { type, titre, cartes: Array.from({ length: n }, (_, i) => ({ titre: texte(c.titre, i, capaciteMotCarte(n)), corps: texte(c.corps, i + 3), mini: MINIS_ESSAI[i % MINIS_ESSAI.length] })) } };
      });
    case "T06":
      return nombres(min, max).map((n) => ({ nom: `${n} points au maximum`, page: { type, titre, points: Array.from({ length: n }, (_, i) => ({ texte: texte(capaciteListe(n).texte, i) })) } }));
    case "T08":
      return [{ nom: "deux panneaux au maximum", page: { type, titre, avant: texte(CAPACITE_PANNEAU.texte), apres: texte(CAPACITE_PANNEAU.texte, 4) } }];
    case "T10":
      return [
        { nom: "message et légende au maximum", page: { type, message: texte(CAPACITE_CITATION.message), legende: texte(CAPACITE_CITATION.legende, 2), deco: "E13" } },
        { nom: "message seul au maximum (sans légende)", page: { type, message: texte(CAPACITE_CITATION.message), deco: "E13" } },
      ];
    case "T20":
      return nombres(min, max).map((n) => {
        const c = capaciteEtape(n);
        return { nom: `${n} étapes au maximum`, page: { type, titre, etapes: Array.from({ length: n }, (_, i) => ({ titre: texte(c.titre, i), corps: texte(c.corps, i + 3) })) } };
      });
    case "T21":
      return [{ nom: "page sans champ", page: { type } }];
    case "T22":
      return [{ nom: "mythe et réalité au maximum", page: { type, titre, mythe: texte(CAPACITE_MYTHE.mythe), realite: texte(CAPACITE_MYTHE.realite, 4) } }];
    case "T23":
      return nombres(min, max).map((n) => {
        const c = capaciteQuestion(n);
        return { nom: `${n} questions au maximum`, page: { type, titre, questions: Array.from({ length: n }, (_, i) => ({ question: texte(c.question, i), aide: texte(c.aide, i + 3), icone: ICONES_ESSAI[i] })), annotation: texte(CAPACITE_ANNOTATION, 2) } };
      });
    case "T24":
      return nombres(min, max).map((n) => ({ nom: `${n} lignes au maximum`, page: { type, titre, lignes: Array.from({ length: n }, (_, i) => ({ sans: texte(CAPACITE_COMPARAISON.case, i), avec: texte(CAPACITE_COMPARAISON.case, i + 4) })) } }));
    case "T26":
      return [
        { nom: "cas au maximum, avec outils", page: { type, titre, avant: [texte(CAPACITE_CAS.ligne), texte(CAPACITE_CAS.ligne, 2)], avec: [texte(CAPACITE_CAS.ligne, 4), texte(CAPACITE_CAS.ligne, 6)], outils: Array.from({ length: CAPACITE_CAS.outilsMax }, (_, i) => texte(CAPACITE_CAS.outil, i, 12)), vous: texte(CAPACITE_CAS.vous, 1) } },
        { nom: "cas au maximum, sans outil", page: { type, titre, avant: [texte(CAPACITE_CAS.ligne), texte(CAPACITE_CAS.ligne, 2)], avec: [texte(CAPACITE_CAS.ligne, 4), texte(CAPACITE_CAS.ligne, 6)], vous: texte(CAPACITE_CAS.vous, 1) } },
      ];
    case "T27":
      return nombres(min, max).map((n) => ({ nom: `${n} lignes au maximum`, page: { type, titre, lignes: Array.from({ length: n }, (_, i) => ({ texte: texte(CAPACITE_CHECKLIST.ligne, i) })) } }));
    case "T28":
      return nombres(min, max).map((n) => ({ nom: `${n} nœuds au maximum`, page: { type, titre, noeuds: Array.from({ length: n }, (_, i) => ({ texte: texte(CAPACITE_NOEUD.texte, i), icone: ICONES_ESSAI[i] })) } }));
  }
}

/** Icônes de la banque employées par les essais (T23, T28). */
export const ICONES_ESSAI = ["horloge", "dossier", "bulle", "cible", "engrenage"] as const;

/** Contenus MINIMAUX du schéma pour ce type : le plus petit nombre d'éléments, textes de `MIN_TITRE` / `MIN_TEXTE` signes, éléments facultatifs absents. */
export function casMin(type: TypePage): CasPage[] {
  const titre = texteInvente(MIN_TITRE);
  const n = PAGES[type].elements.min;
  switch (type) {
    case "T01":
    case "T01B":
    case "T01C":
      return [{ nom: "titre seul", page: { type, titre } }];
    case "T02":
      return [{ nom: "deux cartes courtes", page: { type, titre, cartes: Array.from({ length: 2 }, (_, i) => ({ titre: texteInvente(MIN_TITRE, i), corps: texteInvente(MIN_TEXTE, i + 3), mini: MINIS_ESSAI[i] })) } }];
    case "T06":
      return [{ nom: `${n} points courts`, page: { type, titre, points: Array.from({ length: n }, (_, i) => ({ texte: texteInvente(MIN_TEXTE, i) })) } }];
    case "T08":
      return [{ nom: "deux panneaux courts", page: { type, titre, avant: texteInvente(MIN_TEXTE), apres: texteInvente(MIN_TEXTE, 4) } }];
    case "T10":
      return [{ nom: "message seul", page: { type, message: texteInvente(MIN_TITRE) } }];
    case "T20":
      return [{ nom: `${n} étapes courtes`, page: { type, titre, etapes: Array.from({ length: n }, (_, i) => ({ titre: texteInvente(MIN_TITRE, i), corps: texteInvente(MIN_TEXTE, i + 3) })) } }];
    case "T21":
      return [{ nom: "page sans champ", page: { type } }];
    case "T22":
      return [{ nom: "mythe et réalité courts", page: { type, titre, mythe: texteInvente(MIN_TEXTE), realite: texteInvente(MIN_TEXTE, 4) } }];
    case "T23":
      return [{ nom: `${n} questions courtes`, page: { type, titre, questions: Array.from({ length: n }, (_, i) => ({ question: texteInvente(MIN_TEXTE, i), aide: texteInvente(MIN_TEXTE, i + 3) })), annotation: texteInvente(MIN_TITRE) } }];
    case "T24":
      return [{ nom: `${n} lignes courtes`, page: { type, titre, lignes: Array.from({ length: n }, (_, i) => ({ sans: texteInvente(MIN_TITRE, i), avec: texteInvente(MIN_TITRE, i + 4) })) } }];
    case "T26":
      return [{ nom: "cas court, sans outil", page: { type, titre, avant: [texteInvente(MIN_TITRE), texteInvente(MIN_TITRE, 2)], avec: [texteInvente(MIN_TITRE, 4), texteInvente(MIN_TITRE, 6)], vous: texteInvente(MIN_TITRE, 1) } }];
    case "T27":
      return [{ nom: `${n} lignes courtes`, page: { type, titre, lignes: Array.from({ length: n }, (_, i) => ({ texte: texteInvente(MIN_TEXTE, i) })) } }];
    case "T28":
      return [{ nom: `${n} nœuds courts`, page: { type, titre, noeuds: Array.from({ length: n }, (_, i) => ({ texte: texteInvente(MIN_TITRE - 4, i) })) } }];
  }
}

/**
 * Habille une page de contenu dans un carrousel valide pour la rendre COMME EN VRAI : une page de contenu entre une couverture et la
 * page sombre (le repère de défilement y montre sa flèche), une couverture suivie de la page sombre, la page sombre après une couverture.
 * Renvoie le spec et l'index de la page à rendre.
 */
export function specAutour(page: Record<string, unknown>, titreCouverture = "Une couverture"): { spec: object; index: number } {
  const couverture = { type: "T01", titre: titreCouverture };
  const sombre = { type: "T21" };
  const type = page.type as string;
  const pages = type === "T21" ? [couverture, page] : type.startsWith("T01") ? [page, sombre] : [couverture, page, sombre];
  return { spec: { version: "carrousel/1", alt: "Essai d'une page", pages }, index: pages.indexOf(page) };
}

/** Habille une page dans un carrousel minimal (schéma et budgets seulement) : toute page qui n'est pas une couverture est précédée de la couverture exigée en première page. */
export function specUnePage(page: Record<string, unknown>) {
  const pages = (page.type as string).startsWith("T01") ? [page] : [{ type: "T01", titre: "Une couverture" }, page];
  return { version: "carrousel/1", alt: "Essai de capacité d'une page", pages };
}

/**
 * IMAGE → VIDÉO · Recettes par type d'image, sur UNE seule ossature (plan § 3 et § 4). PUR.
 *
 * Ossature commune : accroche → douleur → début de réponse → explication de bout en bout → résultat → phrase-choc,
 * puis (hors corps) la question de commentaire et la fin du réseau. Chaque type d'image ne change que le parcours de
 * l'explication, les scènes permises et l'annonce du nombre (« deux chemins », « cinq choses »).
 * - Image d'automatisation : « Voici une situation type. » dit au début de l'explication et « Situation type » écrit à
 *   l'écran (I7) : jamais présentée comme un vrai client.
 * - Image très complexe : une seule vidéo en chapitres (« 1/3 »…) ; un chapitre non essentiel est DÉTACHABLE (retiré
 *   des versions courtes sans qu'aucune phrase après lui n'y renvoie). Le mode « deux vidéos » n'existe pas ici.
 */
import type { CodesParAxe } from "@/briques/schema-motion/variete";
import type { CarteImage, TypeImage } from "@/domaine/image-video/carte";
import type { ClasseImage } from "@/domaine/image-video/complexite";
import { PARTIES, type ChapitreFiche, type FicheImage, type Fond, type Partie, type Scene } from "@/domaine/image-video/fiche";
import { RESEAUX_SANS_APPEL_A_COMMENTER, phrasesDeLaBanque } from "./emprunts";

export interface RecetteImage {
  /** Parcours de l'explication, dit à Claude (repris des storyboards A-F). */
  parcours: string;
  /** Scènes propres au type, en plus des scènes communes. */
  scenes: readonly Scene[];
  /** Le début de réponse annonce le nombre d'éléments qui suivent (« deux chemins », « cinq choses »). */
  annonceNombre: boolean;
}

export const RECETTES: Readonly<Record<TypeImage, RecetteImage>> = Object.freeze({
  benefices: {
    parcours:
      "accroche (question en « vous » ou « N choses ») → douleur → « voici ce qui change » avec le nombre (compteur 1/N) → un bénéfice = une phrase titre + une phrase concrète + un micro-objet qui JOUE le bénéfice → récapitulatif (les N cartes en ligne) → phrase-choc",
    scenes: ["carte-benefice"],
    annonceNombre: true,
  },
  chaine: {
    parcours: "accroche (chiffre ou situation) → douleur → « N étapes » → fil orange d'étape en étape, caméra qui suit, repère « 3/5 » → résultat chiffré → phrase-choc",
    scenes: [],
    annonceNombre: true,
  },
  embranchement: {
    parcours:
      "accroche (heure ou situation) → douleur → entrée + décision, « deux chemins » annoncés avant la première branche → branche MAJORITAIRE d'abord jusqu'au bout → RETOUR visible au nœud de décision → branche minoritaire → scène « Ensemble » → bandeau de chiffres → phrase-choc",
    scenes: ["embranchement"],
    annonceNombre: true,
  },
  entonnoir: {
    parcours: "accroche (volume) → douleur → « et si l'IA faisait le tri ? » → les N objets tombent au rythme de la voix → chaque sortie avec son compte ET son pourcentage → bandeau → phrase-choc",
    scenes: ["entonnoir", "nuee"],
    annonceNombre: false,
  },
  "avant-apres": {
    parcours: "accroche (chiffre AVANT le plus douloureux) → avant entier (chiffres qui s'additionnent) → bascule « Maintenant… » → après entier → duel de chiffres → phrase-choc",
    scenes: ["ecran-partage", "additionneur", "sources"],
    annonceNombre: false,
  },
  convergence: {
    parcours: "sources en rafale (une par mot) → moteur → sortie → résultat → phrase-choc",
    scenes: ["sources"],
    annonceNombre: false,
  },
  "tableau-de-bord": {
    parcours: "deux ou trois indicateurs dits, les autres seulement affichés (choix de Will), plus le point d'attention → phrase-choc",
    scenes: [],
    annonceNombre: false,
  },
  chronologie: {
    parcours: "heures dites dans l'ordre, frise qui avance → résultat → phrase-choc",
    scenes: [],
    annonceNombre: false,
  },
});

/** Scènes permises pour toute image : écrans « émotion » v4, toile, objets, bandeau, phrase-choc, vue d'ensemble. */
export const SCENES_COMMUNES: readonly Scene[] = ["accroche", "chiffre", "titre", "toile", "micro-objet", "bandeau-chiffres", "recherche", "alerte", "email", "dossiers", "phrase-choc", "ensemble"];

/** Scènes permises pour une carte (type principal et secondaire). */
export function scenesPermises(types: readonly TypeImage[]): Set<Scene> {
  return new Set([...SCENES_COMMUNES, ...types.flatMap((t) => RECETTES[t].scenes)]);
}

/** Fond par défaut d'une partie : sombre pour l'émotion, ivoire pour l'explication (storyboards de `40`). */
export const FOND_PAR_PARTIE: Readonly<Record<Partie, Fond>> = Object.freeze({
  accroche: "sombre",
  douleur: "ivoire",
  "debut-reponse": "sombre",
  explication: "ivoire",
  resultat: "sombre",
  "phrase-choc": "sombre",
});

// ─── Annonce du nombre ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Nombre que le début de réponse annonce, et nœuds énumérés ensuite (l'annonce doit venir avant le premier d'entre
 * eux). `null` : pas d'annonce pour ce type, ni en mode très complexe (une version courte retire des chapitres, et un
 * nombre annoncé renverrait à un chapitre retiré).
 */
export function annonceAttendue(carte: Pick<CarteImage, "types" | "noeuds" | "groupes">, classe: ClasseImage): { nombre: number; noeuds: string[] } | null {
  const type = carte.types[0];
  if (classe === "tres-complexe" || !RECETTES[type].annonceNombre) return null;
  const ids = (role: string) => carte.noeuds.filter((n) => n.role === role).map((n) => n.id);
  if (type === "benefices") {
    const b = ids("benefice");
    return b.length >= 2 ? { nombre: b.length, noeuds: b } : null;
  }
  if (type === "chaine") {
    const e = ids("etape");
    return e.length >= 2 ? { nombre: e.length, noeuds: e } : null;
  }
  const branches = carte.groupes.filter((g) => g.sorte === "branche");
  return branches.length >= 2 ? { nombre: branches.length, noeuds: branches.flatMap((g) => g.noeuds) } : null;
}

// ─── Situation type (I7) ─────────────────────────────────────────────────────────────────────────────────────────────

/** Phrase dite au début de l'explication d'une image d'automatisation. */
export const ANNONCE_SITUATION_TYPE = "Voici une situation type.";
/** Étiquette écrite à l'écran sur le premier plan de l'explication. */
export const ETIQUETTE_SITUATION_TYPE = "Situation type";

export function situationTypeExigee(carte: Pick<CarteImage, "automatisation">): boolean {
  return carte.automatisation;
}

// ─── Réglage du découpage ────────────────────────────────────────────────────────────────────────────────────────────

/** Seule valeur de cette version : une vidéo en chapitres (décision B1 de `52`). */
export const DECOUPAGES = ["chapitres"] as const;
export type Decoupage = (typeof DECOUPAGES)[number];

export const MODE_DEUX_VIDEOS_ABSENT = "Le mode « deux vidéos » n'existe pas dans cette version : une image très complexe donne une seule vidéo en chapitres.";

/** Lit le réglage `decoupage` ; tout autre valeur (dont « deux-videos ») est refusée explicitement. */
export function lireDecoupage(valeur: unknown): { ok: true; decoupage: Decoupage } | { ok: false; message: string } {
  if (valeur === undefined || valeur === "chapitres") return { ok: true, decoupage: "chapitres" };
  if (valeur === "deux-videos") return { ok: false, message: MODE_DEUX_VIDEOS_ABSENT };
  return { ok: false, message: `Découpage inconnu (${JSON.stringify(valeur)}) : seule la valeur « chapitres » existe.` };
}

// ─── Question de commentaire ─────────────────────────────────────────────────────────────────────────────────────────

/** La question de commentaire est-elle dite dans la vidéo de ce réseau ? Jamais sur LinkedIn (décisions B2, B3). */
export function questionDitePour(reseau: string): boolean {
  return !(RESEAUX_SANS_APPEL_A_COMMENTER as readonly string[]).includes(reseau);
}

/** Ligne de la banque reprise quand la question écrite par Claude échoue aux contrôles (lue, jamais recopiée). */
export const QUESTION_DE_REPLI: Readonly<Record<string, string>> = Object.freeze({
  instagram: "fin-if-question",
  facebook: "fin-if-question",
  tiktok: "fin-ty-question-tache",
  "youtube-shorts": "fin-ty-question-tache",
});

/** Question de repli d'un réseau (phrase dite et écrite de la banque) ; `null` sur LinkedIn. */
export function questionDeRepli(reseau: string): { dit: string; ecran: string } | null {
  const code = QUESTION_DE_REPLI[reseau];
  return code && questionDitePour(reseau) ? phrasesDeLaBanque(code) : null;
}

// ─── Chapitres détachables ───────────────────────────────────────────────────────────────────────────────────────────

/** Chapitres non essentiels, dans l'ordre où une version courte les retire : du dernier au premier. */
export function chapitresDetachables(fiche: Pick<FicheImage, "chapitres">): ChapitreFiche[] {
  return fiche.chapitres.filter((c) => !c.essentiel).reverse();
}

/**
 * Fiche d'une version courte : les `n` derniers chapitres non essentiels retirés, repères renumérotés (« 1/2 »,
 * « 2/2 »). Lève une erreur s'il n'y a pas assez de chapitres détachables (le réseau n'est alors pas livré, § 3).
 */
export function ficheSansChapitres(fiche: FicheImage, n: number): FicheImage {
  const retires = chapitresDetachables(fiche).slice(0, n);
  if (retires.length < n) throw new Error(`Seulement ${retires.length} chapitre(s) détachable(s) : impossible d'en retirer ${n}.`);
  const ecransRetires = new Set(retires.flatMap((c) => c.ecrans));
  const gardes = fiche.chapitres.filter((c) => !retires.includes(c));
  return {
    ...fiche,
    ecrans: fiche.ecrans.filter((e) => !ecransRetires.has(e.id)),
    chapitres: gardes.map((c, i) => ({ ...c, repere: `${i + 1}/${gardes.length}` })),
  };
}

// ─── Déroulé du récit (variété, axe 2 : REC-A à REC-D) ───────────────────────────────────────────────────────────────

/**
 * Déroulé du récit tiré pour la vidéo (doc 72, axe 2). Il vit dans le SCRIPT (donc dans la voix payée) : tiré AVANT
 * l'écriture, le même pour tous les réseaux. Ce qui ne change jamais : accroche, douleur, explication COMPLÈTE et dans
 * l'ordre réel du processus, phrase-choc mot pour mot, question de commentaire. REC-A = le déroulé d'aujourd'hui.
 */
export type CodeRecit = CodesParAxe["recit"];

/** « Voici comment. » : dit au début de la réponse en REC-B, juste après le résultat montré d'abord. */
export const ANNONCE_VOICI_COMMENT = "Voici comment.";
/** « Trois étapes. » : dit au début de la réponse en REC-D ; un repère « 1/3 → 3/3 » reste sur le schéma. */
export const ANNONCE_TROIS_ETAPES = "Trois étapes.";
export const ETAPES_RECIT_D = 3;

/** Parcours de chaque déroulé, dit à Claude en plus de la recette du type (`<recit>` ; rien pour REC-A). */
export const PARCOURS_RECIT: Readonly<Record<CodeRecit, string>> = Object.freeze({
  "REC-A": "",
  "REC-B": `RÉSULTAT PUIS « COMMENT » : juste après l'accroche, la partie « resultat » (les chiffres du bandeau, dits tels qu'écrits) ; puis la douleur ; puis le début de réponse dit « ${ANNONCE_VOICI_COMMENT} » ; puis l'explication COMPLÈTE dans l'ordre réel du processus ; puis la phrase-choc. Le résultat n'est dit qu'une fois, au début : seul le résultat change de place.`,
  "REC-C": "LE PARCOURS D'UN CAS : on suit UN message (ou un e-mail, une commande) du début à la fin, comme un personnage : « ce message », « il arrive », « il repart ». La situation type est annoncée ; l'explication reste COMPLÈTE et dans l'ordre réel du processus ; jamais un vrai client.",
  "REC-D": `EN TROIS ÉTAPES ANNONCÉES : le début de réponse dit « ${ANNONCE_TROIS_ETAPES} » ; l'explication se lit en trois temps, dans l'ordre réel du processus : 1) ce qui arrive, 2) ce que l'automatisation décide ou fait, 3) ce qui en sort. Chaque temps commence par une phrase courte qui le nomme. Un repère « 1/3 », « 2/3 », « 3/3 » est posé à l'écran par le montage : ne l'écris pas.`,
});

/** Ordre des parties selon le déroulé : REC-B met le résultat avant la douleur ; les autres gardent l'ossature. */
export function ordreDesParties(recit: CodeRecit | undefined): readonly Partie[] {
  if (recit !== "REC-B") return PARTIES;
  return ["accroche", "resultat", "douleur", "debut-reponse", "explication", "phrase-choc"];
}

/** Rôles des nœuds de chacune des trois étapes de REC-D : ce qui arrive, ce qui décide ou agit, ce qui en sort. */
export const ROLES_ETAPES_RECIT_D: readonly (readonly string[])[] = Object.freeze([["declencheur", "source"], ["decision", "moteur"], ["etape", "sortie", "resultat"]]);

/** Déroulés possibles sur une image (REC-A toujours) : ce que la carte permet de raconter. */
export function recitsPossibles(carte: Pick<CarteImage, "types" | "automatisation" | "noeuds" | "chiffres">): CodeRecit[] {
  const roles = new Set(carte.noeuds.map((n) => n.role));
  const type = carte.types[0];
  const res: CodeRecit[] = ["REC-A"];
  // REC-B : un résultat chiffré à montrer d'abord (chiffres du bandeau).
  if (carte.chiffres.some((c) => c.dansBandeau)) res.push("REC-B");
  // REC-C : un cas à suivre (image d'automatisation qui part d'un message, d'un e-mail, d'une commande).
  if (carte.automatisation && roles.has("declencheur")) res.push("REC-C");
  // REC-D : trois temps lisibles sur le schéma ; pas pour une chaîne ni des bénéfices, qui ont déjà leur repère.
  if (type !== "chaine" && type !== "benefices" && ROLES_ETAPES_RECIT_D.every((rs) => rs.some((r) => roles.has(r as never)))) res.push("REC-D");
  return res;
}

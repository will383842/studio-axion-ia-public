/** Recette de chaque offre : les blocs dans l'ordre, leur durée cible et leur étiquette d'écran (plan § 8). PUR. */
import type { CasConcret, Offre, Posture } from "./cas";

/**
 * Les structures d'une vidéo du cas concret. Même liste, même ordre que `STRUCTURES` du moteur de variété
 * (`montage-cas-concret/variete.ts`) : ce module-ci ne l'importe pas (un test vérifie qu'elles sont égales).
 */
export const STRUCTURES_RECETTE = ["v4-avant-etapes-resultat", "resultat-d-abord", "probleme-solution", "une-journee"] as const;
export type StructureRecette = (typeof STRUCTURES_RECETTE)[number];

export type IdBloc = "accroche" | "resultat-tete" | "chiffre" | "avant" | "bascule" | "etapes" | "reste-humain" | "conformite" | "resultat" | "question";

export interface BlocCas {
  id: IdBloc;
  nom: string;
  dureeCibleSec: [number, number];
  /** Étiquette affichée en tête d'écran. */
  etiquette: string;
  facultatif?: boolean;
  /** Tournure à suivre pour ce bloc, quand l'offre en a une. */
  consigne?: string;
}

/** Étiquette d'écran selon la posture du cas. */
export const ETIQUETTE_POSTURE: Record<Posture, string> = { "chez-nous": "cas réel", offre: "notre méthode" };

/**
 * Sur-titre tiré du CAS (« Recrutement · cas réel », « Blog · cas réel ») : l'étiquette des écrans qui n'en ont pas de
 * propre (le lien de la fin, l'appel au mot, la preuve). Sans thème : la posture seule. Jamais celui d'un autre cas.
 */
export function surTitreDuCas(cas: Pick<CasConcret, "posture" | "theme">): string {
  const theme = cas.theme?.trim();
  return theme ? `${theme} · ${ETIQUETTE_POSTURE[cas.posture]}` : ETIQUETTE_POSTURE[cas.posture];
}

type Gabarit = Omit<BlocCas, "etiquette">[];

const gabarit = (etapesSec: [number, number], avantSec: [number, number]): Gabarit => [
  { id: "accroche", nom: "Accroche", dureeCibleSec: [2, 3] },
  { id: "chiffre", nom: "Le chiffre", dureeCibleSec: [4, 6] },
  { id: "avant", nom: "Avant", dureeCibleSec: avantSec },
  { id: "bascule", nom: "La bascule", dureeCibleSec: [2, 4] },
  { id: "etapes", nom: "Les étapes", dureeCibleSec: etapesSec },
  { id: "reste-humain", nom: "Ce qui reste humain", dureeCibleSec: [4, 6] },
  { id: "conformite", nom: "Conformité", dureeCibleSec: [3, 5], facultatif: true },
  { id: "resultat", nom: "Résultat", dureeCibleSec: [4, 6] },
  { id: "question", nom: "Question", dureeCibleSec: [3, 5] },
];

/** Coaching : recette minimale, sans chiffre ni conformité (aucun cas au catalogue). */
const COACHING: Gabarit = [
  { id: "accroche", nom: "Accroche", dureeCibleSec: [2, 3] },
  { id: "avant", nom: "La douleur du dirigeant", dureeCibleSec: [8, 12], consigne: "Ce que le dirigeant vit aujourd'hui, en tâches concrètes." },
  { id: "bascule", nom: "La bascule", dureeCibleSec: [2, 4] },
  { id: "etapes", nom: "Le déroulé de l'accompagnement", dureeCibleSec: [16, 24], consigne: "Les séances, une à la fois : ce que l'on fait ensemble, ce que le dirigeant essaie entre deux." },
  { id: "reste-humain", nom: "Ce qui reste humain", dureeCibleSec: [4, 6] },
  { id: "resultat", nom: "Le résultat", dureeCibleSec: [4, 6] },
  { id: "question", nom: "Question", dureeCibleSec: [3, 5] },
];

const GABARITS: Record<Offre, Gabarit> = {
  integration: gabarit([20, 28], [8, 12]),
  formation: gabarit([16, 24], [8, 12]),
  audit: gabarit([16, 24], [9, 13]),
  coaching: COACHING,
};

/**
 * Les deux tournures de l'intégration (automatisation et intégration sont une seule offre) : des étapes qui tournent
 * seules, ou des outils reliés dont la donnée passe seule. « Automatisation » est le mot à dire, jamais un synonyme.
 */
export const TOURNURES_INTEGRATION = {
  automatisation: "Une automatisation : dites les étapes qui tournent seules, sans que personne ait à les lancer.",
  "outils-relies": "Des outils reliés : dites la donnée qui passe seule d'un outil à l'autre, sans ressaisie.",
} as const;

/** Des outils reliés si une étape montre des outils reliés, sinon des étapes qui tournent seules. */
function tournureIntegration(etapes: CasConcret["etapes"]): string {
  const relies = etapes.some((e) => (e.visuel.sorte === "objet" ? e.visuel.objet : e.visuel.repli) === "outils-relies");
  return TOURNURES_INTEGRATION[relies ? "outils-relies" : "automatisation"];
}

const joindre = (...morceaux: (string | undefined)[]): string | undefined => morceaux.filter(Boolean).join(" ") || undefined;

/**
 * Les autres structures : ce qui change par rapport à la v4, bloc par bloc. Elles retirent « le chiffre » (le gain n'est
 * plus une accroche en deux temps) et restent DANS R04 : accroche en premier, liste « avant » avant 6 s, résultat après
 * la dernière étape, question en dernier. Seules les consignes disent la forme ; aucune phrase à recopier. La tournure de
 * l'intégration (déjà dans la consigne des étapes) est toujours gardée.
 */
function autreStructure(blocs: BlocCas[], structure: Exclude<StructureRecette, "v4-avant-etapes-resultat">): BlocCas[] {
  const sansChiffre = blocs.filter((b) => b.id !== "chiffre");
  const avec = (liste: BlocCas[], id: IdBloc, f: (b: BlocCas) => BlocCas) => liste.map((b) => (b.id === id ? f(b) : b));
  if (structure === "resultat-d-abord") {
    const [accroche, ...suite] = sansChiffre;
    const tete: BlocCas = { id: "resultat-tete", nom: "Le résultat, d'abord", dureeCibleSec: [1, 3], etiquette: accroche!.etiquette, consigne: "un écran « resultat » court, 3 à 6 mots dits" };
    return [accroche!, tete, ...avec(suite, "resultat", (b) => ({ ...b, consigne: "le gain redit autrement, sans nouveau chiffre" }))];
  }
  if (structure === "probleme-solution") {
    const avant = avec(sansChiffre, "avant", (b) => {
      const consigne = joindre(b.consigne, "le problème : ce que la tâche coûte, tâche par tâche, le total en dernier s'il existe");
      return { ...b, dureeCibleSec: [b.dureeCibleSec[0] + 2, b.dureeCibleSec[1] + 2], ...(consigne ? { consigne } : {}) };
    });
    return avec(avant, "bascule", (b) => ({ ...b, consigne: "la solution, en une phrase" }));
  }
  const avant = avec(sansChiffre, "avant", (b) => ({ ...b, consigne: joindre(b.consigne, "une journée type au présent, chaque tâche à son moment")! }));
  const bascule = avec(avant, "bascule", (b) => ({ ...b, consigne: "la même journée, depuis que c'est en place" }));
  const etapes = avec(bascule, "etapes", (b) => ({ ...b, consigne: joindre(b.consigne, "chaque étape à un moment de cette journée, sans heure chiffrée sauf si un fait la donne")! }));
  return avec(etapes, "resultat", (b) => ({ ...b, consigne: "comment finit cette journée" }));
}

/**
 * La structure réellement appliquée : « une-journee » n'a pas de sens pour le coaching (une suite de séances, pas les
 * tâches d'une journée) ; pour cette offre elle se comporte comme la v4, recette, patrons et description compris.
 */
export function structureEffective(offre: Offre, structure: StructureRecette = STRUCTURES_RECETTE[0]): StructureRecette {
  return offre === "coaching" && structure === "une-journee" ? STRUCTURES_RECETTE[0] : structure;
}

/**
 * Les blocs d'une vidéo, dans l'ordre, pour l'offre et la posture du cas (la tournure de l'intégration suit ses étapes).
 * `demandee` : sans elle, ou en v4, la recette est exactement celle de toujours (« une-journee » aussi pour le coaching).
 */
export function recettePour(cas: Pick<CasConcret, "offre" | "posture" | "etapes">, demandee: StructureRecette = STRUCTURES_RECETTE[0]): BlocCas[] {
  const structure = structureEffective(cas.offre, demandee);
  const blocs = GABARITS[cas.offre].map((b) => {
    const consigne = cas.offre === "integration" && b.id === "etapes" ? tournureIntegration(cas.etapes) : b.consigne;
    return { ...b, dureeCibleSec: [...b.dureeCibleSec] as [number, number], etiquette: ETIQUETTE_POSTURE[cas.posture], ...(consigne ? { consigne } : {}) };
  });
  return structure === STRUCTURES_RECETTE[0] ? blocs : autreStructure(blocs, structure);
}

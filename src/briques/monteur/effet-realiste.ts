/**
 * BRIQUE MONTEUR — opération COMMUNE « effet réaliste par IA » (lot K, décision de Will du 09/10). PUR.
 *
 * `effetRealisteIA { consigne, ancre, dureeSec 3-8, imageReference?, sonSuggere? }` : une action LIBRE et réaliste
 * demandée APRÈS la génération (« rajoute au bon endroit un téléphone dans ma main et jette-le sur l'écran »).
 * Claude, dans son appel unique, choisit le BON ENDROIT (`debutMot`, `raisonMoment`), rédige la consigne vidéo en
 * anglais (`consigneVideo`) et la durée ; le code vérifie le moment (brique `effet-realiste`) et ajoute toujours les
 * règles de préservation. PAYANTE : jamais exécutée directement — le studio montre d'abord la carte de confirmation
 * (brique `options-payantes`) avec l'aperçu du moment ; sans « Confirmer », rien n'est dépensé.
 */
import { z } from "zod";
import type { EntreeCatalogueMonteur } from "./catalogue";

export const OBJETS_EFFET_REALISTE = ["telephone", "logo-axion", "tasse", "livre", "stylo", "carte-bancaire", "cle", "autre"] as const;

export const schemaEffetRealisteIA = z.object({
  type: z.literal("effetRealisteIA"),
  /** La demande de Will, telle quelle. */
  consigne: z.string(),
  /** Ancre donnée par Will : un mot cité, un instant cité, ou « au bon endroit » (le monteur choisit). */
  ancre: z.enum(["mot", "instant", "bon-endroit"]),
  /** Mot où commence le passage : le mot cité, ou le BON ENDROIT choisi (Will parle de l'objet, geste naturel). */
  debutMot: z.number().int(),
  /** Instant cité par Will (secondes de la vidéo livrée) ; null sinon. */
  instantSec: z.number().nullable(),
  /** 3 à 8 s (le geste complet). */
  dureeSec: z.number(),
  /** Consigne pour le modèle vidéo, EN ANGLAIS : l'action physique précise (apparition, paume vers le haut, lancer, impact). */
  consigneVideo: z.string(),
  objet: z.enum(OBJETS_EFFET_REALISTE),
  /** « logo-axion » ou identifiant d'une image de « Mes images » ; null : aucune. */
  imageReference: z.string().nullable(),
  /** L'action finit sur l'écran (objet lancé vers la caméra) : la vitre brisée s'enchaîne à l'impact. */
  finitSurEcran: z.boolean(),
  /** Bruitage suggéré (« whoosh », « verre ») ; null : aucun. */
  sonSuggere: z.string().nullable(),
  /** Pourquoi ce moment, en une phrase simple (montrée à Will). */
  raisonMoment: z.string(),
});
export type OperationEffetRealisteIA = z.infer<typeof schemaEffetRealisteIA>;

export const ENTREE_CATALOGUE_EFFET_REALISTE: EntreeCatalogueMonteur<"effetRealisteIA"> = {
  type: "effetRealisteIA",
  libelle: "Effet réaliste par IA (réaliste, payant)",
  regle: [
    "À LA DEMANDE SEULEMENT, quand Will veut une action réelle (objet qui apparaît dans sa main, posé sur le bureau, lancé vers l'écran) et pas « en 3D » (en 3D : objetMain, gratuit).",
    "OPTION PAYANTE : le studio demande toujours la confirmation de Will avant de dépenser ; ne promets rien, dis seulement ce que l'effet fera.",
    "BON ENDROIT (ancre bon-endroit) : debutMot = le moment où Will parle de l'objet ou fait un geste naturel, au début d'une phrase ou après une pause, JAMAIS au milieu d'une phrase clé (accroche, conclusion, chiffre), sur un plan assez large pour voir la main, hors d'un autre effet ; raisonMoment en une phrase.",
    "Mot ou instant cité par Will : ancre mot (debutMot = ce mot) ou instant (instantSec).",
    "dureeSec 3 à 8 (le geste complet, 5 par défaut).",
    "consigneVideo EN ANGLAIS : décris l'action physique précisément (l'objet apparaît dans la main ouverte, paume vers le haut ; il est lancé vers la caméra, grossit, impact contre l'objectif à la fin…) ; le visage, les lèvres, la voix et le décor restent identiques (le studio ajoute ces règles).",
    "objet : telephone, logo-axion, tasse, livre, stylo, carte-bancaire, cle, autre ; imageReference : logo-axion pour le logo, sinon l'identifiant d'une image de Mes images si Will en cite une, sinon null.",
    "finitSurEcran : true si l'objet est jeté sur l'écran (la vitre brisée et le bruitage s'enchaînent seuls à l'impact).",
  ].join(" "),
  exemples: ["Mets un téléphone dans ma main et jette-le sur l'écran", "Fais apparaître le logo Axion dans ma main, en réaliste", "Une tasse de café sur le bureau, en réaliste"],
};

/** Exemples de « Que puis-je demander ? » avec leur mention (réaliste payant, ou 3D gratuit). */
export interface ExempleMentionne {
  texte: string;
  mention: string;
}

export const MENTION_REALISTE = "réaliste, payant";
export const MENTION_3D = "en 3D, gratuit";

export function exemplesEffetsMentionnes(exemples3D: readonly string[]): ExempleMentionne[] {
  return [...ENTREE_CATALOGUE_EFFET_REALISTE.exemples.map((texte) => ({ texte, mention: MENTION_REALISTE })), ...exemples3D.map((texte) => ({ texte, mention: MENTION_3D }))];
}

/**
 * Relecture tolérante (champ facultatif oublié, durée en texte) : les valeurs par défaut sont posées plutôt que de
 * perdre la demande. Null si ce n'est pas un effet réaliste ou s'il manque le mot.
 */
export function reparerEffetRealiste(brut: unknown): OperationEffetRealisteIA | null {
  if (!brut || typeof brut !== "object") return null;
  const x = brut as Record<string, unknown>;
  if (x.type !== "effetRealisteIA") return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && !Number.isNaN(Number(v.replace(",", "."))) ? Number(v.replace(",", ".")) : null);
  const debut = n(x.debutMot) ?? n(x.auMot);
  if (debut === null) return null;
  const consigne = typeof x.consigne === "string" ? x.consigne : typeof x.description === "string" ? x.description : "";
  return {
    type: "effetRealisteIA",
    consigne: consigne.slice(0, 500),
    ancre: x.ancre === "mot" || x.ancre === "instant" ? x.ancre : "bon-endroit",
    debutMot: Math.round(debut),
    instantSec: n(x.instantSec),
    dureeSec: n(x.dureeSec) ?? 5,
    consigneVideo: typeof x.consigneVideo === "string" ? x.consigneVideo : "",
    objet: (OBJETS_EFFET_REALISTE as readonly string[]).includes(x.objet as string) ? (x.objet as OperationEffetRealisteIA["objet"]) : "autre",
    imageReference: typeof x.imageReference === "string" && x.imageReference.trim() ? x.imageReference.trim() : null,
    finitSurEcran: x.finitSurEcran === true,
    sonSuggere: typeof x.sonSuggere === "string" && x.sonSuggere.trim() ? x.sonSuggere.trim() : null,
    raisonMoment: typeof x.raisonMoment === "string" ? x.raisonMoment.slice(0, 200) : "",
  };
}

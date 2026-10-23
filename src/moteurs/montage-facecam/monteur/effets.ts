/**
 * EFFETS SPÉCIAUX DU MONTEUR (lot F3, L11b reporté après la v1) — opérations AJOUTÉES au vocabulaire du monteur.
 * PUR, importable partout.
 *
 * Trois opérations, JAMAIS automatiques : seulement sur une demande de Will (« Monteur, … » dit au tournage, case
 * « Vos demandes », fil « Discuter avec mon monteur »). Une proposition « auto » est écartée avec une phrase.
 *   - `objetMain` : un objet 3D (logo Axion extrudé par défaut, ou objet simple) posé sur la paume, qui suit la main ;
 *     main introuvable assez longtemps → variante sans effet, « Effet non réussi — Réessayer » ;
 *   - `vitreBrisee` : l'image se fissure depuis un point hors du visage, les éclats tombent (flou de mouvement) et
 *     révèlent le plan suivant ou une carte ; calée sur un mot ; bruitage de verre facultatif ;
 *   - `transitionEcran` : variantes sur la même base, « l'écran se plie » et « zoom à travers l'écran ».
 *
 * Garde-fous (en plus de la grammaire du lot B) : durée d'une transition 0,6 à 1,5 s ; un seul effet fort à la fois
 * (zoom flou, cache-moi, texte derrière, arrêt sur image, autre effet spécial) ; 3 transitions au plus par vidéo,
 * 4 s d'écart au moins (le montage reste à plus de 90 % de coupes franches) ; le visage n'est jamais caché (point
 * d'impact hors du visage, objet écarté du visage : brique `effets-speciaux`).
 */
import { z } from "zod";
import { OBJETS_MAIN, bornerDureeTransition, type IdEffetSpecial, type ObjetMain, type StyleTransition } from "@/briques/effets-speciaux";
import { CATALOGUE_EFFETS_COMMUN } from "@/briques/monteur/effets";
import type { PassageFacecam } from "@/domaine/facecam";
import type { OperationFacecam } from "./operations";
import type { EntreeCatalogue } from "./catalogue";
import type { OrigineOperation, PassageMonteur } from "./appliquer";

const mot = z.number().int();

export const schemaObjetMain = z.object({
  type: z.literal("objetMain"),
  /** Passage où Will montre sa main (l'objet apparaît quand la main s'ouvre, disparaît quand elle se ferme). */
  debutMot: mot,
  finMot: mot,
  /** Logo Axion extrudé par défaut ; sinon un objet simple généré. */
  objet: z.enum(OBJETS_MAIN),
  /** Ce que Will a demandé, en une phrase. */
  description: z.string(),
});

export const schemaVitreBrisee = z.object({
  type: z.literal("vitreBrisee"),
  /** Mot sur lequel l'image se brise. */
  auMot: mot,
  /** 0,6 à 1,5 s ; null : 1,2 s. */
  dureeSec: z.number().nullable(),
  /** Ce que révèle la vitre : le plan suivant (par défaut) ou une carte titre. */
  revele: z.enum(["plan-suivant", "carte"]),
  /** Texte de la carte révélée ; null pour le plan suivant. */
  texteCarte: z.string().nullable(),
  /** Bruitage de verre (par défaut oui ; non si Will le dit). */
  bruitage: z.boolean(),
});

export const schemaTransitionEcran = z.object({
  type: z.literal("transitionEcran"),
  auMot: mot,
  /** « L'écran se plie » ou « zoom à travers l'écran ». */
  style: z.enum(["ecran-plie", "zoom-traversant"]),
  /** 0,6 à 1,5 s ; null : durée type du style. */
  dureeSec: z.number().nullable(),
});

/** Schémas ajoutés à `SCHEMAS_OPERATION` (fin de liste : l'ordre des opérations existantes ne change pas). */
export const SCHEMAS_EFFETS_SPECIAUX = [schemaObjetMain, schemaVitreBrisee, schemaTransitionEcran] as const;

export type OperationObjetMain = z.infer<typeof schemaObjetMain>;
export type OperationVitreBrisee = z.infer<typeof schemaVitreBrisee>;
export type OperationTransitionEcran = z.infer<typeof schemaTransitionEcran>;
export type OperationEffetSpecial = OperationObjetMain | OperationVitreBrisee | OperationTransitionEcran;
export const TYPES_EFFETS_SPECIAUX = ["objetMain", "vitreBrisee", "transitionEcran"] as const;

export function estEffetSpecial(op: { type: string }): op is OperationEffetSpecial {
  return (TYPES_EFFETS_SPECIAUX as readonly string[]).includes(op.type);
}

/** Effet de la brique commune qui rend l'opération. */
export function idEffet(op: OperationEffetSpecial): IdEffetSpecial {
  return op.type === "objetMain" ? "objet-main" : op.type === "vitreBrisee" ? "vitre-brisee" : op.style;
}

/* ------------------------------------------------------------------ */
/* Garde-fous                                                          */
/* ------------------------------------------------------------------ */

export const GARDE_FOUS_EFFETS = {
  /** Transitions par vidéo, et écart minimal entre deux (s). */
  transitionsMaxParVideo: 3,
  ecartTransitionsSec: 4,
  /** Fenêtre de recherche de la main si le passage demandé est très court (s). */
  fenetreMainMinSec: 4,
  fenetreMainMaxSec: 8,
  /** Décalage maximal d'une transition pour ne pas tomber sur un autre effet fort (s). */
  decalageMaxSec: 1.5,
} as const;

/** Opérations « fortes » : jamais deux en même temps. */
const FORTES = new Set<string>(["objetMain", "vitreBrisee", "transitionEcran", "masquerPersonne", "texteDerriere", "arretImage"]);

function estForte(p: PassageFacecam): boolean {
  const op = (p as PassageMonteur).operation as { type?: string; style?: string } | undefined;
  if (!op?.type) return false;
  if (op.type === "zoom") return op.style === "flou";
  return FORTES.has(op.type);
}

const chevauche = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - 1e-6 && b0 < a1 - 1e-6;

export interface ContexteEffet {
  origine: OrigineOperation;
  consigneId?: string;
  /** Passages déjà posés (y compris ceux de cet appel). */
  passages: PassageFacecam[];
  /** Index de mot → temps de la prise. */
  debutDe: (i: number) => number;
  finDe: (i: number) => number;
  /** Temps de la prise → temps monté (coupes vues par Claude). */
  versMontee: (sec: number) => number;
  dureePriseSec: number;
  nouvelId: (prefixe: string) => string;
}

export type ResultatEffet = { ok: true; passage: PassageMonteur; operation: OperationEffetSpecial; alertes: string[] } | { ok: false; alertes: string[] };

/**
 * Applique UNE opération d'effet spécial (garde-fous compris). Appelé par `appliquerOperations` ; rend le passage à
 * poser, ou le refus et sa raison en une phrase simple.
 */
export function appliquerEffetSpecial(brute: OperationEffetSpecial, ctx: ContexteEffet): ResultatEffet {
  if (ctx.origine !== "demande") return { ok: false, alertes: ["Effet spécial écarté : il ne s'applique que si vous le demandez."] };
  const alertes: string[] = [];
  let op: OperationEffetSpecial = brute;
  let debutPrise: number;
  let finPrise: number;

  if (op.type === "objetMain") {
    debutPrise = ctx.debutDe(Math.min(op.debutMot, op.finMot));
    finPrise = ctx.finDe(Math.max(op.debutMot, op.finMot));
    // La main s'ouvre souvent après le mot : on cherche sur 4 s au moins, 8 s au plus.
    finPrise = Math.min(ctx.dureePriseSec, Math.max(finPrise, debutPrise + GARDE_FOUS_EFFETS.fenetreMainMinSec), debutPrise + GARDE_FOUS_EFFETS.fenetreMainMaxSec);
  } else {
    const style: StyleTransition = op.type === "vitreBrisee" ? "vitre-brisee" : op.style;
    const duree = bornerDureeTransition(op.dureeSec, style);
    if (typeof op.dureeSec === "number" && Math.abs(duree - op.dureeSec) > 1e-6) alertes.push(`Effet ramené à ${duree.toLocaleString("fr-FR")} s (entre 0,6 et 1,5 s).`);
    op = { ...op, dureeSec: duree };
    if (op.type === "vitreBrisee" && op.revele === "plan-suivant" && op.texteCarte) op = { ...op, texteCarte: null };
    if (op.type === "vitreBrisee" && op.revele === "carte" && !op.texteCarte?.trim()) {
      op = { ...op, revele: "plan-suivant", texteCarte: null };
      alertes.push("Pas de texte pour la carte : la vitre révèle le plan suivant.");
    }
    debutPrise = ctx.debutDe(op.auMot);
    finPrise = Math.min(ctx.dureePriseSec, debutPrise + duree);
  }

  let debutSec = ctx.versMontee(debutPrise);
  let finSec = Math.max(debutSec, ctx.versMontee(finPrise));
  const fortes = ctx.passages.filter(estForte);

  if (op.type !== "objetMain") {
    const transitions = ctx.passages.filter((p) => {
      const t = ((p as PassageMonteur).operation as { type?: string } | undefined)?.type;
      return t === "vitreBrisee" || t === "transitionEcran";
    });
    if (transitions.length >= GARDE_FOUS_EFFETS.transitionsMaxParVideo) return { ok: false, alertes: [`Effet écarté : ${GARDE_FOUS_EFFETS.transitionsMaxParVideo} transitions spectaculaires au plus par vidéo.`] };
    if (transitions.some((p) => Math.abs(p.debutSec - debutSec) < GARDE_FOUS_EFFETS.ecartTransitionsSec)) return { ok: false, alertes: ["Effet écarté : trop proche d'une autre transition (4 s d'écart au moins)."] };
    // Un autre effet fort à ce moment : la transition passe juste après, si c'est tout près.
    const gene = fortes.filter((p) => chevauche(debutSec, finSec, p.debutSec, p.finSec)).sort((a, b) => b.finSec - a.finSec)[0];
    if (gene) {
      const decalage = gene.finSec + 0.2 - debutSec;
      const duree = finSec - debutSec;
      if (decalage > GARDE_FOUS_EFFETS.decalageMaxSec || fortes.some((p) => p !== gene && chevauche(debutSec + decalage, debutSec + decalage + duree, p.debutSec, p.finSec)))
        return { ok: false, alertes: ["Effet écarté : un autre effet est déjà à ce moment (un seul à la fois)."] };
      debutSec += decalage;
      finSec += decalage;
      debutPrise += decalage;
      finPrise += decalage;
      alertes.push("Effet décalé juste après l'effet précédent (un seul à la fois).");
    }
  } else {
    const gene = fortes.find((p) => chevauche(debutSec, finSec, p.debutSec, p.finSec));
    const carte = ctx.passages.find((p) => (p.type === "carte" || ((p as PassageMonteur).operation as { type?: string } | undefined)?.type === "miseEnPage") && chevauche(debutSec, finSec, p.debutSec, p.finSec));
    if (gene) return { ok: false, alertes: ["Effet écarté : un autre effet est déjà à ce moment (un seul à la fois)."] };
    if (carte) return { ok: false, alertes: ["Effet écarté : une carte cache votre main à ce moment."] };
  }

  const passage: PassageMonteur = {
    id: ctx.nouvelId("pas"),
    type: "autre",
    debutSec: +debutSec.toFixed(3),
    finSec: +finSec.toFixed(3),
    texte: texteEffet(op),
    origine: ctx.origine,
    ...(ctx.consigneId ? { consigneId: ctx.consigneId } : {}),
    ancre: { debutPriseSec: debutPrise, finPriseSec: finPrise },
    operation: op as unknown as OperationFacecam,
  };
  return { ok: true, passage, operation: op, alertes };
}

const NOMS_OBJET: Record<ObjetMain, string> = {
  "logo-axion": "Logo Axion en 3D",
  telephone: "Téléphone en 3D",
  cube: "Cube en 3D",
  sphere: "Sphère en 3D",
  piece: "Pièce en 3D",
  etoile: "Étoile en 3D",
  coeur: "Cœur en 3D",
};

function texteEffet(op: OperationEffetSpecial): string {
  if (op.type === "objetMain") return `${NOMS_OBJET[op.objet]} dans votre main`;
  if (op.type === "vitreBrisee") return op.revele === "carte" && op.texteCarte ? `Vitre qui se brise sur « ${op.texteCarte} »` : "Vitre qui se brise";
  return op.style === "ecran-plie" ? "Écran qui se plie" : "Zoom à travers l'écran";
}

/** Résumé lisible (« Logo Axion en 3D dans votre main »). */
export function resumeEffetSpecial(op: OperationEffetSpecial): string {
  return texteEffet(op);
}

/* ------------------------------------------------------------------ */
/* Catalogue (« Que puis-je demander ? » et consigne de Claude)        */
/* ------------------------------------------------------------------ */

/** Catalogue commun de la brique monteur (mêmes entrées, même ordre), lu par le face caméra. */
export const CATALOGUE_EFFETS: EntreeCatalogue[] = CATALOGUE_EFFETS_COMMUN.map((e) => ({ ...e, exemples: [...e.exemples] }));

/* ------------------------------------------------------------------ */
/* Version simple (règles fixes, aucun appel)                          */
/* ------------------------------------------------------------------ */

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function cite(texte: string): string | null {
  const m = texte.match(/[«"“]\s*([^»"”]+?)\s*[»"”]/);
  return m ? m[1].trim() : null;
}

/** Objet demandé d'après la phrase (logo Axion par défaut). */
export function objetDemande(texte: string): ObjetMain {
  const t = sansAccents(texte);
  if (/telephone|portable|smartphone|iphone|mobile/.test(t)) return "telephone";
  if (/\bcube\b|\bboite\b/.test(t)) return "cube";
  if (/sphere|boule|\bballe\b|globe/.test(t)) return "sphere";
  if (/\bpiece\b|monnaie|jeton/.test(t)) return "piece";
  if (/etoile/.test(t)) return "etoile";
  if (/coeur|cœur/.test(t)) return "coeur";
  return "logo-axion";
}

/**
 * Reconnaît une demande d'effet spécial par mots-clés (version simple, sans Claude). Rend null si la phrase n'en
 * demande pas ; testée AVANT les autres règles (« zoom à travers l'écran » n'est pas un zoom).
 */
export function operationEffetParRegles(texte: string, debutMot: number, finMot: number): OperationEffetSpecial | null {
  const t = sansAccents(texte);
  if (/zoom (a travers|dans|au travers de) l'?ecran|traverse[rz]? l'?ecran|plonge[rz]? (dans|a travers) l'?ecran/.test(t)) return { type: "transitionEcran", auMot: debutMot, style: "zoom-traversant", dureeSec: null };
  if (/(ecran|image) (qui )?se plie|plie[rz]? l'?(ecran|image)|pliage|plier l'?ecran/.test(t)) return { type: "transitionEcran", auMot: debutMot, style: "ecran-plie", dureeSec: null };
  if (/vitre|en verre|comme du verre|(brise|casse|explose|eclate)[rz]? l'?(ecran|image)|(ecran|image) (qui )?(se )?(brise|casse|explose|eclate)/.test(t)) {
      const texteCarte = cite(texte);
      const carte = /carte|titre|revele/.test(t) && !!texteCarte;
      return { type: "vitreBrisee", auMot: debutMot, dureeSec: null, revele: carte ? "carte" : "plan-suivant", texteCarte: carte ? texteCarte : null, bruitage: !/sans (bruit|son|bruitage)/.test(t) };
  }
  const main = /(dans|sur) (ma|la|mes|sa) (main|paume)|\bpaume\b/.test(t);
  if (main && /3d|logo|appara|objet|telephone|portable|cube|sphere|boule|piece|etoile|coeur|pose|mets|fais/.test(t)) return { type: "objetMain", debutMot, finMot, objet: objetDemande(texte), description: texte.trim().slice(0, 200) };
  return null;
}

/** Le passage est-il un effet spécial ? (Pour les vues et l'intégration.) */
export function passageEffetSpecial(p: PassageFacecam): OperationEffetSpecial | null {
  const op = (p as PassageMonteur).operation as { type?: string } | undefined;
  return op?.type && estEffetSpecial(op as { type: string }) ? (op as OperationEffetSpecial) : null;
}

/**
 * Relecture tolérante d'un effet spécial mal formé (champ facultatif oublié, durée en texte) : les valeurs par
 * défaut sont posées plutôt que de perdre la demande. Null si ce n'est pas un effet ou s'il manque le mot.
 */
export function reparerEffetSpecial(brut: unknown): OperationEffetSpecial | null {
  if (!brut || typeof brut !== "object") return null;
  const x = brut as Record<string, unknown>;
  const nombre = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
  const duree = typeof x.dureeSec === "number" ? x.dureeSec : typeof x.dureeSec === "string" && !Number.isNaN(Number.parseFloat(x.dureeSec.replace(",", "."))) ? Number.parseFloat(x.dureeSec.replace(",", ".")) : null;
  const au = nombre(x.auMot) ?? nombre(x.debutMot);
  if (x.type === "objetMain") {
    const debut = nombre(x.debutMot) ?? nombre(x.auMot);
    if (debut === null) return null;
    const objet = (OBJETS_MAIN as readonly string[]).includes(x.objet as string) ? (x.objet as ObjetMain) : objetDemande(String(x.objet ?? x.description ?? ""));
    return { type: "objetMain", debutMot: debut, finMot: nombre(x.finMot) ?? debut, objet, description: typeof x.description === "string" ? x.description.slice(0, 300) : "" };
  }
  if (x.type === "vitreBrisee") {
    if (au === null) return null;
    const texteCarte = typeof x.texteCarte === "string" && x.texteCarte.trim() ? x.texteCarte.trim() : null;
    return { type: "vitreBrisee", auMot: au, dureeSec: duree, revele: x.revele === "carte" && texteCarte ? "carte" : "plan-suivant", texteCarte: x.revele === "carte" ? texteCarte : null, bruitage: x.bruitage !== false };
  }
  if (x.type === "transitionEcran") {
    if (au === null) return null;
    const style = x.style === "ecran-plie" || x.style === "zoom-traversant" ? x.style : /pli/.test(String(x.style ?? "")) ? "ecran-plie" : "zoom-traversant";
    return { type: "transitionEcran", auMot: au, style, dureeSec: duree };
  }
  return null;
}

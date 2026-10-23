/**
 * EFFET RÉALISTE PAR IA DANS LE MONTEUR FACE CAMÉRA (lot K). PUR.
 *
 * L'opération `effetRealisteIA` (brique monteur commune) n'est JAMAIS appliquée directement : c'est une option
 * payante. `preparerEffetRealiste` vérifie le moment choisi par Claude (ou le choisit : brique `effet-realiste`),
 * écrit la consigne vidéo finale (anglais, règles de préservation) et prépare les passages qui l'accompagnent :
 *  - la VITRE BRISÉE (lot F3 / I) à l'impact, avec bruitage, si l'objet est jeté sur l'écran — sortie seulement si
 *    l'effet réussit ;
 *  - l'OBJET 3D (lot I / I2) sur la paume, repli GRATUIT — sorti seulement si l'effet rate (objet connu en 3D).
 * Le tout attend « Confirmer » (service `effet-realiste-ia`) : la carte montre l'aperçu du moment.
 */
import { OBJETS_MAIN, type ObjetMain } from "@/briques/effets-speciaux";
import {
  consigneVideo,
  descriptionFrancaise,
  estDemandeEffetRealiste,
  lireDemandeEffet,
  modeleEffet,
  momentDeLEffet,
  type ConditionEffetRealiste,
  type EffetRealistePrepare,
  type ObjetConnu,
} from "@/briques/effet-realiste";
import { instantDans, motCite } from "@/briques/monteur/ancrage";
import type { OperationEffetRealisteIA } from "@/briques/monteur/effet-realiste";
import type { PassageFacecam } from "@/domaine/facecam";
import type { OperationFacecam } from "./operations";
import type { OrigineOperation, PassageMonteur } from "./appliquer";
import { appliquerEffetSpecial } from "./effets";
import type { MotMonteur } from "./temps";

export type { OperationEffetRealisteIA };

/** Un effet réaliste prêt, en attente de la réponse de Will (carte de confirmation). */
export interface EffetAConfirmer {
  effet: EffetRealistePrepare;
  /** Passages posés avec lui à la confirmation (vitre brisée si réussi, objet 3D si raté). */
  passagesLies: PassageMonteur[];
  consigneId?: string;
}

export interface ContexteEffetRealiste {
  mots: MotMonteur[];
  dureePriseSec: number;
  origine: OrigineOperation;
  consigneId?: string;
  passages: PassageFacecam[];
  versMontee: (priseSec: number) => number;
  nouvelId: (prefixe: string) => string;
  /** Part de plan large autour d'un instant de la prise (0-1) ; absente : non mesurée. */
  largeurPlan?: (priseSec: number) => number;
  /** Image de référence → clé R2 (« logo-axion », identifiant de Mes images) ; absente : FLUX sans image. */
  imageReference?: (ref: string) => string | undefined;
}

export type ResultatPreparation = { ok: true; aConfirmer: EffetAConfirmer; alertes: string[] } | { ok: false; alertes: string[] };

const FORTES = new Set(["objetMain", "vitreBrisee", "transitionEcran", "masquerPersonne", "texteDerriere", "arretImage", "effetRealisteIA"]);
const OBJET_3D: Partial<Record<ObjetConnu, ObjetMain>> = { telephone: "telephone", "logo-axion": "logo-axion" };

/** Instant de l'impact (temps livré) : la fin du passage, moins une demi-seconde (l'objet touche l'objectif). */
export const AVANCE_IMPACT_SEC = 0.5;

export function preparerEffetRealiste(op: OperationEffetRealisteIA, ctx: ContexteEffetRealiste): ResultatPreparation {
  if (ctx.origine !== "demande") return { ok: false, alertes: ["Effet réaliste écarté : il ne se fait que si vous le demandez."] };
  const lue = lireDemandeEffet(op.consigne || "");
  const objet: ObjetConnu = op.objet !== "autre" ? op.objet : lue.objet;
  const finitSurEcran = op.finitSurEcran || lue.finitSurEcran;
  const occupes = ctx.passages.filter((p) => FORTES.has(((p as PassageMonteur).operation as { type?: string } | undefined)?.type ?? "")).map((p) => ({ debutSec: p.debutSec, finSec: p.finSec }));
  const moment = momentDeLEffet(ctx.mots, {
    dureeSec: op.dureeSec,
    objet,
    ancre: op.ancre,
    motClaude: op.ancre === "bon-endroit" ? op.debutMot : null,
    raisonClaude: op.raisonMoment,
    ...(op.ancre === "mot" ? { motWill: op.debutMot } : {}),
    ...(op.ancre === "instant" && op.instantSec !== null ? { instantWill: op.instantSec } : {}),
    occupes,
    ...(ctx.largeurPlan ? { largeurPlan: ctx.largeurPlan } : {}),
  });
  if (!moment) return { ok: false, alertes: ["Effet réaliste impossible : il faut au moins 3 s de parole sans coupe."] };
  const alertes: string[] = [];
  if (moment.ajuste) alertes.push("Le moment de l'effet a été recalé pour tenir sans coupe, hors des phrases clés.");
  const imageReferenceCle = op.imageReference ? ctx.imageReference?.(op.imageReference) : objet === "logo-axion" ? ctx.imageReference?.("logo-axion") : undefined;
  const demande = { ...lue, objet, finitSurEcran };
  const id = ctx.nouvelId("pas");
  const effet: EffetRealistePrepare = {
    id,
    consigne: (op.consigne || "").slice(0, 500),
    description: descriptionFrancaise(demande),
    consigneVideo: consigneVideo({ claude: op.consigneVideo, demande, avecReference: !!imageReferenceCle }),
    ancre: op.ancre,
    debutMot: moment.debutMot,
    debutPriseSec: moment.debutPriseSec,
    finPriseSec: moment.finPriseSec,
    debutSec: moment.debutSec,
    finSec: moment.finSec,
    dureeSec: moment.dureeSec,
    modele: modeleEffet(!!imageReferenceCle),
    ...(imageReferenceCle ? { imageReferenceCle } : {}),
    objet,
    finitSurEcran,
    ...(finitSurEcran ? { impactSec: +(moment.finSec - AVANCE_IMPACT_SEC).toFixed(3) } : {}),
    ...((op.sonSuggere ?? lue.sonSuggere) ? { sonSuggere: (op.sonSuggere ?? lue.sonSuggere)! } : {}),
    phrase: moment.phrase,
    raisonMoment: moment.raison,
  };
  return { ok: true, aConfirmer: { effet, passagesLies: passagesLies(effet, ctx, alertes), ...(ctx.consigneId ? { consigneId: ctx.consigneId } : {}) }, alertes };
}

/** Index du mot gardé le plus proche d'un instant de la PRISE. */
function motProche(mots: MotMonteur[], priseSec: number): number {
  const gardes = mots.filter((m) => m.monteeSec !== null);
  let meilleur = gardes[0]?.index ?? 0;
  let ecart = Infinity;
  for (const m of gardes) {
    const e = Math.abs(m.debutPriseSec - priseSec);
    if (e < ecart) [meilleur, ecart] = [m.index, e];
  }
  return meilleur;
}

function passagesLies(effet: EffetRealistePrepare, ctx: ContexteEffetRealiste, alertes: string[]): PassageMonteur[] {
  const liste: PassageMonteur[] = [];
  const index = new Map(ctx.mots.map((m) => [m.index, m]));
  const debutDe = (i: number) => index.get(i)?.debutPriseSec ?? 0;
  const finDe = (i: number) => index.get(i)?.finPriseSec ?? ctx.dureePriseSec;
  const sans = ctx.passages; // l'effet réaliste n'est pas encore posé : ses passages liés se calent sur l'existant
  if (effet.finitSurEcran && effet.impactSec !== undefined) {
    const impactPrise = effet.finPriseSec - AVANCE_IMPACT_SEC;
    const r = appliquerEffetSpecial(
      { type: "vitreBrisee", auMot: motProche(ctx.mots, impactPrise), dureeSec: 1.2, revele: "plan-suivant", texteCarte: null, bruitage: true },
      { origine: "demande", ...(ctx.consigneId ? { consigneId: ctx.consigneId } : {}), passages: sans, debutDe: (i) => (i === motProche(ctx.mots, impactPrise) ? impactPrise : debutDe(i)), finDe, versMontee: ctx.versMontee, dureePriseSec: ctx.dureePriseSec, nouvelId: ctx.nouvelId },
    );
    if (r.ok) liste.push(avecCondition(r.passage, { effetId: effet.id, si: "reussi" }, "Vitre qui se brise à l'impact (si l'effet réaliste réussit)"));
    else alertes.push(...r.alertes);
  }
  // La vitre (si réussi) et l'objet 3D (si raté) ne sortent jamais ensemble : l'un ne gêne pas l'autre.
  const objet3D = OBJET_3D[effet.objet];
  if (objet3D && (OBJETS_MAIN as readonly string[]).includes(objet3D) && !lireDemandeEffet(effet.consigne).dansLeDecor) {
    const r = appliquerEffetSpecial(
      { type: "objetMain", debutMot: effet.debutMot, finMot: motProche(ctx.mots, effet.finPriseSec), objet: objet3D, description: `Repli gratuit en 3D : ${effet.consigne}`.slice(0, 300) },
      { origine: "demande", ...(ctx.consigneId ? { consigneId: ctx.consigneId } : {}), passages: sans, debutDe, finDe, versMontee: ctx.versMontee, dureePriseSec: ctx.dureePriseSec, nouvelId: ctx.nouvelId },
    );
    if (r.ok) liste.push(avecCondition(r.passage, { effetId: effet.id, si: "rate" }, `${r.passage.texte ?? "Objet en 3D"} (si l'effet réaliste ne réussit pas)`));
  }
  return liste;
}

function avecCondition(p: PassageMonteur, condition: ConditionEffetRealiste, texte: string): PassageMonteur {
  return { ...p, texte, conditionEffetRealiste: condition } as PassageMonteur;
}

/** Passage de l'effet réaliste posé dans la piste à la confirmation (lu par la chaîne). */
export function passageEffetRealiste(effet: EffetRealistePrepare, o: { consigneId?: string; versMontee?: (s: number) => number } = {}): PassageMonteur {
  return {
    id: effet.id,
    type: "autre",
    debutSec: effet.debutSec,
    finSec: effet.finSec,
    texte: `${effet.description.replace(/\.$/, "")} (effet réaliste par IA)`,
    origine: "demande",
    ...(o.consigneId ? { consigneId: o.consigneId } : {}),
    ancre: { debutPriseSec: effet.debutPriseSec, finPriseSec: effet.finPriseSec },
    operation: { type: "effetRealisteIA", ...effet } as unknown as OperationFacecam,
  };
}

/** L'effet réaliste porté par un passage (chaîne, vues) ; null sinon. */
export function effetDuPassage(p: PassageFacecam): EffetRealistePrepare | null {
  const op = (p as PassageMonteur).operation as (Partial<EffetRealistePrepare> & { type?: string }) | undefined;
  if (op?.type !== "effetRealisteIA" || typeof op.consigneVideo !== "string" || typeof op.debutPriseSec !== "number" || typeof op.finPriseSec !== "number" || typeof op.id !== "string") return null;
  const effet = { ...op };
  delete effet.type;
  return effet as EffetRealistePrepare;
}

/**
 * Version simple (sans Claude) : reconnaît une demande d'effet réaliste et en tire l'opération ; le code choisira le
 * bon endroit et écrira la consigne vidéo. Ancre : un instant cité, un mot cité, sinon « au bon endroit ».
 */
export function operationEffetRealisteParRegles(texte: string, debutMot: number): OperationEffetRealisteIA | null {
  if (!estDemandeEffetRealiste(texte)) return null;
  const lue = lireDemandeEffet(texte);
  const instant = instantDans(texte);
  // `debutMot` est déjà l'ancre de la consigne (mot cité repéré par `ancreConsigne`).
  const cite = instant === null && !!motCite(texte);
  return {
    type: "effetRealisteIA",
    consigne: texte.trim().slice(0, 500),
    ancre: instant !== null ? "instant" : cite ? "mot" : "bon-endroit",
    debutMot,
    instantSec: instant,
    dureeSec: lue.dureeSec ?? 5,
    consigneVideo: "",
    objet: lue.objet,
    imageReference: lue.objet === "logo-axion" ? "logo-axion" : null,
    finitSurEcran: lue.finitSurEcran,
    sonSuggere: lue.sonSuggere,
    raisonMoment: "",
  };
}

/** S-14-c1 : aperçu commun du chat (ce qui change, coût dit SANS montant, résumé, scène à l'instant). PUR, sans importeur : éteint, 0 €. */
import { porteesDe, PHRASES } from "@/briques/retouche-portee";
import type { OperationRetouche } from "@/briques/operations";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { capaciteRefaireVoix, type EstimationRefaireVoix } from "@/domaine/refaire-voix";
import { phraseImpact } from "./impact";

export interface EntreeApercuCommun {
  generateur: string;
  format: string;
  operations: readonly OperationRetouche[];
  impact: { scenes: readonly string[]; total: number; voixTouchee: boolean } | null;
  plan?: Pick<PlanValide, "scenes"> | null;
  estimationVoix?: EstimationRefaireVoix | null;
  sourceLecture?: "regles" | "claude" | "rien";
  instant?: { ms: number } | null;
}
export type FamilleCout = "gratuite" | "dans-la-limite" | "refusee" | "inconnue";
export interface ApercuCommun {
  ceQuiChange: string;
  cout: { famille: FamilleCout; phrases: string[] };
  resume: string[];
  instant: string | null;
  appliquable: boolean;
}

export const PHRASE_REFUS_PAYANT = "Payant : refusé.";
export const PHRASE_FORMAT_IMPOSSIBLE =
  "Refaire la voix n'est pas possible pour ce format : pour ce changement, il faut refaire la vidéo. Votre vidéo reste telle quelle.";
export const PHRASE_VOIX_DANS_LA_LIMITE = "La voix sera refaite : c'est payant, dans la limite prévue pour cette vidéo.";
export const PHRASE_GRATUIT = "Gratuit : rien n'est payé.";
export const PHRASE_COUT_INCONNU = "Ce que coûte cette retouche n'est pas connu pour ce format : rien n'est lancé.";
export const PHRASE_LECTURE_CLAUDE = "La lecture de votre demande a compté dans la limite prévue pour cette vidéo.";
export const PHRASE_IMPACT_NON_FOURNI = "Ce qui change n'est pas fourni pour ce format.";
export const TITRE_RESUME = "Voici ce que je vais faire :";
export const FIN_RESUME = "Rien ne sera fait tant que vous n'avez pas cliqué « Appliquer ».";
export const PHRASE_HORS_SCENE = "Le moment choisi ne tombe dans aucune scène : écrivez la scène voulue.";
const MAX_PHRASES_RESUME = 5;

const estTexte = (v: unknown): v is string => typeof v === "string";
const messageNombre = (n: number) => (n === 1 ? "Et 1 autre changement." : `Et ${n} autres changements.`);

export function sceneALInstant(plan: Pick<PlanValide, "scenes"> | null | undefined, ms: number): { sceneId: string; numero: number } | null {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0 || !Array.isArray(plan?.scenes)) return null;
  const i = plan.scenes.findIndex((s) => typeof s?.debutMs === "number" && typeof s?.finMs === "number" && s.debutMs <= ms && ms < s.finMs);
  return i < 0 ? null : { sceneId: plan.scenes[i].id, numero: i + 1 };
}

const rang = (plan: EntreeApercuCommun["plan"], id: unknown): string => {
  const i = estTexte(id) && Array.isArray(plan?.scenes) ? plan.scenes.findIndex((s) => s?.id === id) : -1;
  return i < 0 ? "Une scène" : `Scène ${i + 1}`;
};

function phraseOperation(o: OperationRetouche, plan: EntreeApercuCommun["plan"]): string | null {
  const x = o as unknown as Record<string, unknown>;
  const s = rang(plan, x.sceneId);
  switch (o?.type) {
    case "changer-mot": return `${s} : le mot « ${String(x.ancien)} » devient « ${String(x.nouveau)} ».`;
    case "ajouter-chiffre": return `${s} : un chiffre est ajouté à l'écran.`;
    case "changer-brique": case "remplacer-piece": return `${s} : l'animation change.`;
    case "ajouter-piece": return `${s} : une animation est ajoutée.`;
    case "retirer-piece": return `${s} : une animation est retirée.`;
    case "decaler-scene": return `${s} : elle commence plus ${typeof x.decalageMs === "number" && x.decalageMs < 0 ? "tôt" : "tard"}.`;
    case "changer-habillage": return "Tout le film : l'habillage change.";
    case "changer-transition": return `${x.sceneId === undefined ? "Tout le film" : s} : le mouvement change.`;
    case "ajuster-zoom": return `${s} : le mouvement change.`;
    case "ajouter-dynamisme": return `${!Array.isArray(x.sceneIds) ? "Tout le film" : x.sceneIds.length === 1 ? rang(plan, x.sceneIds[0]) : "Plusieurs scènes"} : le mouvement change.`;
    case "modifier-script": return "Le texte lu change : la voix sera refaite.";
    case "couper-mots": return "Des mots sont coupés : la suite du film se recale.";
    case "changer-sous-titre": return "Les sous-titres changent.";
    case "retirer-scene": return `${s} : elle est retirée.`;
    case "changer-son": return "Le son change.";
    case "deplacer": return `${s} : elle change de place.`;
    default: return null;
  }
}

function resumer(operations: readonly OperationRetouche[], plan: EntreeApercuCommun["plan"]): string[] {
  const phrases = operations.map((o) => phraseOperation(o, plan)).filter(estTexte);
  if (phrases.length === 0) return [];
  const reste = phrases.length - MAX_PHRASES_RESUME;
  return [TITRE_RESUME, ...phrases.slice(0, MAX_PHRASES_RESUME), ...(reste > 0 ? [messageNombre(reste)] : []), FIN_RESUME];
}

function coutDe(e: EntreeApercuCommun): ApercuCommun["cout"] {
  const portees = porteesDe("chat", e.operations);
  const payante = portees.find((p) => p === "claude" || p === "ia");
  let cout: ApercuCommun["cout"];
  if (payante !== undefined) cout = { famille: "refusee", phrases: [`${PHRASE_REFUS_PAYANT} ${PHRASES[payante as "claude" | "ia"]}`] };
  else if (!portees.includes("voix")) cout = { famille: "gratuite", phrases: [PHRASE_GRATUIT] };
  else if (capaciteRefaireVoix(e.format) === "impossible") cout = { famille: "refusee", phrases: [PHRASE_FORMAT_IMPOSSIBLE] };
  else if (e.estimationVoix == null) cout = { famille: "inconnue", phrases: [PHRASE_COUT_INCONNU] };
  else if (e.estimationVoix.ok !== true) cout = { famille: "refusee", phrases: [e.estimationVoix.phrase] };
  else cout = { famille: "dans-la-limite", phrases: [PHRASE_VOIX_DANS_LA_LIMITE] };
  if (e.sourceLecture === "claude") cout.phrases.push(PHRASE_LECTURE_CLAUDE);
  return cout;
}

export function apercuCommun(e: EntreeApercuCommun): ApercuCommun {
  const inconnu: ApercuCommun = { ceQuiChange: PHRASE_IMPACT_NON_FOURNI, cout: { famille: "inconnue", phrases: [PHRASE_COUT_INCONNU] }, resume: [], instant: null, appliquable: false };
  try {
    if (!e || !Array.isArray(e.operations)) return inconnu;
    const i = e.impact;
    const impactOk = i != null && Array.isArray(i.scenes) && typeof i.total === "number" && typeof i.voixTouchee === "boolean";
    const cout = coutDe(e);
    const ms = e.instant?.ms;
    const sceneInstant = ms === undefined || e.plan == null ? null : sceneALInstant(e.plan, ms);
    const instant = ms === undefined || e.plan == null ? null : sceneInstant === null ? PHRASE_HORS_SCENE : `À ${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}, scène ${sceneInstant.numero}.`;
    return { ceQuiChange: impactOk ? phraseImpact({ scenes: [...i.scenes], total: i.total, voixTouchee: i.voixTouchee }) : PHRASE_IMPACT_NON_FOURNI, cout, resume: resumer(e.operations, e.plan), instant, appliquable: cout.famille === "gratuite" || cout.famille === "dans-la-limite" };
  } catch {
    return inconnu;
  }
}

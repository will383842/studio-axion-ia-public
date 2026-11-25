/**
 * S-14-c1 : APERÇU COMMUN du chat de retouche (ce qui change, coût dit SANS montant, résumé, scène à l'instant).
 * PUR : aucun accès base, réseau, réglage ni argent. ÉTEINT : aucun importeur (branchement = S-14-c2, écran = S-14-c3).
 * Jamais de montant : la promesse est « dans la limite prévue pour cette vidéo ». Ne lève jamais.
 */
import type { OperationRetouche } from "@/briques/operations";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { garderPortee, PHRASES } from "@/briques/retouche-portee";
import { capaciteRefaireVoix, type EstimationRefaireVoix } from "@/domaine/refaire-voix";
import { phraseImpact } from "./impact";

export const PHRASE_PAYANT_REFUSE = "Payant : refusé.";
export const PHRASE_FORMAT_IMPOSSIBLE =
  "Refaire la voix n'est pas possible pour ce format : pour ce changement, il faut refaire la vidéo. Votre vidéo reste telle quelle.";
export const PHRASE_VOIX_DANS_LA_LIMITE = "La voix sera refaite : c'est payant, dans la limite prévue pour cette vidéo.";
export const PHRASE_GRATUIT = "Gratuit : rien n'est payé.";
export const PHRASE_COUT_INCONNU = "Ce que coûte cette retouche n'est pas connu pour ce format : rien n'est lancé.";
export const PHRASE_LECTURE = "La lecture de votre demande a compté dans la limite prévue pour cette vidéo.";
export const PHRASE_IMPACT_NON_FOURNI = "Ce qui change n'est pas fourni pour ce format.";
export const PHRASE_INSTANT_HORS_SCENE = "Le moment choisi ne tombe dans aucune scène : écrivez la scène voulue.";
export const TITRE_RESUME = "Voici ce que je vais faire :";
export const FIN_RESUME = "Rien ne sera fait tant que vous n'avez pas cliqué « Appliquer ».";
const MAX_PHRASES_RESUME = 5;

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
export interface ApercuCommun {
  ceQuiChange: string;
  cout: { famille: "gratuite" | "dans-la-limite" | "refusee" | "inconnue"; phrases: string[] };
  resume: string[];
  instant: string | null;
  appliquable: boolean;
}

type Cout = ApercuCommun["cout"];
const sceneDe = (plan: EntreeApercuCommun["plan"], id: string | undefined): string => {
  const rang = id === undefined ? -1 : (plan?.scenes ?? []).findIndex((s) => s.id === id);
  return rang >= 0 ? `Scène ${rang + 1}` : "Une scène";
};
const PLUS_ou_MOINS = (o: { decalageMs?: number }) => ((o.decalageMs ?? 0) < 0 ? "plus tôt" : "plus tard");

function phraseOperation(o: OperationRetouche, plan: EntreeApercuCommun["plan"]): string | null {
  const s = "sceneId" in o ? sceneDe(plan, o.sceneId) : "";
  switch (o?.type) {
    case "changer-mot": return `${s} : le mot « ${o.ancien} » devient « ${o.nouveau} ».`;
    case "ajouter-chiffre": return `${s} : un chiffre est ajouté à l'écran.`;
    case "changer-brique":
    case "remplacer-piece": return `${s} : l'animation change.`;
    case "ajouter-piece": return `${s} : l'animation est ajoutée.`;
    case "retirer-piece": return `${s} : l'animation est retirée.`;
    case "decaler-scene": return `${s} : elle commence ${PLUS_ou_MOINS(o)}.`;
    case "changer-habillage": return "Tout le film : l'habillage change.";
    case "changer-transition": return `${o.sceneId === undefined ? "Tout le film" : s} : le mouvement change.`;
    case "ajouter-dynamisme": return `${o.sceneIds?.length === 1 ? sceneDe(plan, o.sceneIds[0]) : "Tout le film"} : le mouvement change.`;
    case "ajuster-zoom": return `${s} : le mouvement change.`;
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
  const phrases = operations.map((o) => phraseOperation(o, plan)).filter((p): p is string => p !== null);
  if (phrases.length === 0) return [];
  const reste = phrases.length - MAX_PHRASES_RESUME;
  const fin = reste > 0 ? [reste === 1 ? "Et 1 autre changement." : `Et ${reste} autres changements.`] : [];
  return [TITRE_RESUME, ...phrases.slice(0, MAX_PHRASES_RESUME), ...fin, FIN_RESUME];
}

function coutDe(e: EntreeApercuCommun): Cout {
  const lecture = e.sourceLecture === "claude" ? [PHRASE_LECTURE] : [];
  const garde = garderPortee("chat", e.operations, { voixPermise: true });
  const refusee = garde.portees.find((p) => p === "claude" || p === "ia");
  if (refusee !== undefined) return { famille: "refusee", phrases: [`${PHRASE_PAYANT_REFUSE} ${PHRASES[refusee as "claude" | "ia"]}`, ...lecture] };
  if (!garde.portees.includes("voix")) return { famille: "gratuite", phrases: [PHRASE_GRATUIT, ...lecture] };
  if (capaciteRefaireVoix(e.format) === "impossible") return { famille: "refusee", phrases: [PHRASE_FORMAT_IMPOSSIBLE, ...lecture] };
  const est = e.estimationVoix;
  if (!est) return { famille: "inconnue", phrases: [PHRASE_COUT_INCONNU, ...lecture] };
  if (!est.ok) return { famille: "refusee", phrases: [est.phrase, ...lecture] };
  return { famille: "dans-la-limite", phrases: [PHRASE_VOIX_DANS_LA_LIMITE, ...lecture] };
}

const nombreOk = (ms: unknown): ms is number => typeof ms === "number" && Number.isFinite(ms) && ms >= 0;

export function sceneALInstant(plan: Pick<PlanValide, "scenes">, ms: number): { sceneId: string; numero: number } | null {
  if (!nombreOk(ms) || !Array.isArray(plan?.scenes)) return null;
  const rang = plan.scenes.findIndex((s) => s.debutMs <= ms && ms < s.finMs);
  return rang < 0 ? null : { sceneId: plan.scenes[rang].id, numero: rang + 1 };
}

function phraseInstant(e: EntreeApercuCommun): string | null {
  if (!e.instant) return null;
  const trouvee = e.plan ? sceneALInstant(e.plan, e.instant.ms) : null;
  if (!trouvee) return PHRASE_INSTANT_HORS_SCENE;
  const s = Math.floor(e.instant.ms / 1000);
  return `À ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}, scène ${trouvee.numero}.`;
}

const INCONNU: ApercuCommun = {
  ceQuiChange: PHRASE_IMPACT_NON_FOURNI,
  cout: { famille: "inconnue", phrases: [PHRASE_COUT_INCONNU] },
  resume: [],
  instant: null,
  appliquable: false,
};

export function apercuCommun(e: EntreeApercuCommun): ApercuCommun {
  try {
    const cout = coutDe(e);
    return {
      ceQuiChange: e.impact ? phraseImpact({ ...e.impact, scenes: [...e.impact.scenes] }) : PHRASE_IMPACT_NON_FOURNI,
      cout,
      resume: resumer(e.operations, e.plan),
      instant: phraseInstant(e),
      appliquable: cout.famille === "gratuite" || cout.famille === "dans-la-limite",
    };
  } catch {
    return { ...INCONNU, cout: { ...INCONNU.cout, phrases: [...INCONNU.cout.phrases] } };
  }
}

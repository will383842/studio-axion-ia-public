/**
 * IMAGE → VIDÉO · LOT D'IMAGES (décisions de Will, 17/10). PUR : aucun accès base, aucun réseau.
 * N images → UNE vidéo par image, fabriquées l'une après l'autre, un seul accord de prix, aucun arrêt : une vidéo
 * douteuse est mise de côté sans payer sa suite. Plan : `docs/formats/image-video/lot-images/PLAN.md`.
 */
import type { Offre } from "@/formats/cas-concret/cas";
import type { ReseauIV } from "./plafonds";

export const LOT_MAX_IV = 10;
/** Vidéos de suite arrêtées par une panne avant la pause du lot (D4). */
export const PANNES_AVANT_PAUSE_IV = 2;

export type StatutVideoLotIV = "en-attente" | "en-fabrication" | "faite" | "mise-de-cote" | "refaite";
export type PorteMiseDeCoteIV = "carte" | "script" | "arret";

export interface MiseDeCoteLotIV {
  porte: PorteMiseDeCoteIV;
  motif: string;
  phrases: string[];
  /** Code du refus de la machine (porte « arret ») : sert à reconnaître une panne. */
  code?: string;
}

export interface VideoDuLotIV {
  /** 1..N, ordre du dépôt (ordre de fabrication). */
  rang: number;
  videoId: string;
  fichierId: string;
  nom: string;
  statut: StatutVideoLotIV;
  miseDeCote?: MiseDeCoteLotIV;
  /** Nouvelle vidéo faite par Will (statut « refaite »). */
  refaiteEn?: string;
  /** ISO, posé AVANT l'appel de lancement. */
  lanceeLe?: string;
}

export type StatutLotIV = "en-cours" | "en-pause" | "termine" | "arrete";
export type RaisonPauseLotIV = "credit" | "budget" | "pannes" | "format";

export interface LotIV {
  version: "lot-iv/1";
  /** « lot-iv-<12 hex> ». */
  id: string;
  creeLe: string;
  /** sha256(fichierIds triés + réseaux + offre + accord) : un double clic donne le même lot. */
  cleIdempotence: string;
  reseaux: ReseauIV[];
  offre?: Offre;
  prixParVideoCentimes: number;
  /** Montant confirmé par Will (au moins N × prix par vidéo). */
  accordCentimes: number;
  /** N × prix par vidéo : jamais au-delà, même si l'accord est plus haut. */
  plafondCentimes: number;
  tauxUsdEur: number;
  videos: VideoDuLotIV[];
  statut: StatutLotIV;
  pause?: { raison: RaisonPauseLotIV; phrase: string };
  /** Remis à 0 à chaque vidéo faite ou mise de côté par une porte. */
  pannesDeSuite: number;
  /** Phrases simples, sans date. */
  journal: string[];
}

/** Ce que le lot lit de l'état de la machine (structure minimale : le domaine ne dépend pas du moteur). */
export interface EtatLisibleLotIV {
  etape: string;
  miseDeCote?: { porte: "carte" | "script"; motif: string; phrases: string[] };
  refus?: { code?: string; message: string; phrases?: string[] };
}

export type TravailStatutLotIV = "en_file" | "en_cours" | "termine" | "echec" | "annule" | null;

export interface IssueVideoLotIV {
  statut: StatutVideoLotIV;
  miseDeCote?: MiseDeCoteLotIV;
}

/** Codes d'arrêt qui disent « la chaîne est cassée » (pas un jugement sur l'image). */
const CODES_PANNE_IV: readonly string[] = ["IV_PANNE", "IV_NON_RELIE", "IV_RENDU", "IV_BUDGET", "IV_PLAFOND"];

export function prixDuLotIV(n: number, prixParVideoCentimes: number): number {
  return n * prixParVideoCentimes;
}

export function refusTailleLotIV(n: number): string | null {
  if (n < 2) return "Un lot demande au moins 2 images.";
  if (n > LOT_MAX_IV) return `${LOT_MAX_IV} images au plus par lot.`;
  return null;
}

const parRang = (a: VideoDuLotIV, b: VideoDuLotIV) => a.rang - b.rang;

/** La prochaine vidéo à lancer : jamais deux fabrications Image → vidéo en même temps. */
export function prochaineALancerIV(lot: LotIV, autreFabricationIVActive: boolean): VideoDuLotIV | null {
  if (lot.statut !== "en-cours" || autreFabricationIVActive) return null;
  if (lot.videos.some((v) => v.statut === "en-fabrication")) return null;
  return [...lot.videos].sort(parRang).find((v) => v.statut === "en-attente") ?? null;
}

/** Table b.2 du plan : l'état de la machine et le travail disent le statut de la vidéo dans le lot. */
export function statutDepuisEtatIV(etat: EtatLisibleLotIV | null, travailStatut: TravailStatutLotIV): IssueVideoLotIV {
  if (travailStatut === "annule") return { statut: "mise-de-cote", miseDeCote: { porte: "arret", motif: "Arrêtée.", phrases: [] } };
  if (!etat) return { statut: "en-attente" };
  if (etat.etape === "prete") return { statut: "faite" };
  if (etat.etape === "refusee") {
    const r = etat.refus;
    return { statut: "mise-de-cote", miseDeCote: { porte: "arret", motif: r?.message ?? "Arrêtée.", phrases: [...(r?.phrases ?? [])], ...(r?.code ? { code: r.code } : {}) } };
  }
  if ((etat.etape === "carte-a-valider" || etat.etape === "script-a-valider") && etat.miseDeCote) {
    const m = etat.miseDeCote;
    return { statut: "mise-de-cote", miseDeCote: { porte: m.porte, motif: m.motif, phrases: [...m.phrases] } };
  }
  return { statut: "en-fabrication" };
}

const estPanne = (m: MiseDeCoteLotIV | undefined) => m?.porte === "arret" && m.code !== undefined && CODES_PANNE_IV.includes(m.code);

/**
 * Applique le statut recalculé d'une vidéo. Idempotent : relire le même arrêt à un autre tour ne recompte pas la panne.
 * Une vidéo « refaite » garde son statut ; un lot « arrêté » reste arrêté.
 */
export function appliquerIssueIV(lot: LotIV, rang: number, issue: IssueVideoLotIV): LotIV {
  const suivant: LotIV = structuredClone(lot);
  const video = suivant.videos.find((v) => v.rang === rang);
  if (!video || video.statut === "refaite") return suivant;
  const avant = video.statut;
  video.statut = issue.statut;
  if (issue.miseDeCote) video.miseDeCote = structuredClone(issue.miseDeCote);
  else delete video.miseDeCote;

  if (issue.statut === "faite") suivant.pannesDeSuite = 0;
  else if (issue.statut === "mise-de-cote" && avant !== "mise-de-cote") {
    suivant.pannesDeSuite = estPanne(issue.miseDeCote) ? suivant.pannesDeSuite + 1 : 0;
  }

  if (suivant.statut === "arrete") return suivant;
  if (!suivant.videos.some((v) => v.statut === "en-attente" || v.statut === "en-fabrication")) {
    suivant.statut = "termine";
    delete suivant.pause;
  } else if (suivant.statut === "en-cours" && suivant.pannesDeSuite >= PANNES_AVANT_PAUSE_IV) {
    suivant.statut = "en-pause";
    suivant.pause = { raison: "pannes", phrase: "Deux vidéos de suite se sont arrêtées sur une panne : le lot est en pause, rien de plus n'est payé." };
    suivant.journal.push(suivant.pause.phrase);
  }
  return suivant;
}

export function resumeLotIV(lot: LotIV): { faites: number; misesDeCote: number; enAttente: number; enFabrication: number; refaites: number } {
  const n = (s: StatutVideoLotIV) => lot.videos.filter((v) => v.statut === s).length;
  return { faites: n("faite"), misesDeCote: n("mise-de-cote"), enAttente: n("en-attente"), enFabrication: n("en-fabrication"), refaites: n("refaite") };
}

/** Ce qu'il reste à garder en réserve pour le lot : une vidéo au prix accordé par vidéo encore en attente. */
export function restantAReserverIV(lot: LotIV): number {
  return lot.prixParVideoCentimes * lot.videos.filter((v) => v.statut === "en-attente").length;
}

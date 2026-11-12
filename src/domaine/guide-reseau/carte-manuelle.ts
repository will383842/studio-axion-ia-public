// File « À traiter » LinkedIn/TikTok : décision PURE de carte. Jamais une action d'envoi (RC-43 : ni réponse ni message automatique).
import type { CarteATraiter } from "../../services/a-traiter-types";
import { estMotOpposition } from "./opposition";

export type ReseauManuel = "linkedin_page" | "tiktok";
export interface MotDuReseau {
  mot: string;
  etat: "actif" | "pause";
  textesValides: boolean;
}
export type RaisonSansMessage =
  | "tiktok_sans_message_prive" | "textes_non_valides" | "mot_en_pause" | "mot_inconnu" | "deja_traite_pour_ce_mot";
export type PropositionCarte =
  | { action: "silence"; raison: "opposition" | "personne_opposee" | "rien" }
  | {
      action: "carte";
      motif: "mot_manuel" | "mot_inconnu";
      mot: string;
      reponseAProposer: boolean;
      message: "a_fabriquer" | "indisponible";
      raisonSansMessage: RaisonSansMessage | null;
    };

export function proposerCarte(e: {
  reseau: ReseauManuel;
  motSeul: string | null;
  motsDuReseau: readonly MotDuReseau[];
  opposee: boolean;
  dejaTraite: boolean;
}): PropositionCarte {
  // Un stop gagne partout : opposition écrite, puis personne déjà opposée, avant toute autre lecture.
  if (e.motSeul !== null && estMotOpposition(e.motSeul)) return { action: "silence", raison: "opposition" };
  if (e.opposee) return { action: "silence", raison: "personne_opposee" };
  if (e.motSeul === null) return { action: "silence", raison: "rien" };
  const mot = e.motSeul.toUpperCase();
  const connu = e.motsDuReseau.find((m) => m.mot.toUpperCase() === mot);
  const motif = connu ? "mot_manuel" : "mot_inconnu";
  const raison: RaisonSansMessage | null =
    e.reseau === "tiktok" ? "tiktok_sans_message_prive"
    : !connu ? "mot_inconnu"
    : connu.etat !== "actif" ? "mot_en_pause"
    : !connu.textesValides ? "textes_non_valides"
    : e.dejaTraite ? "deja_traite_pour_ce_mot"
    : null;
  return {
    action: "carte",
    motif,
    mot,
    reponseAProposer: !!connu && connu.etat === "actif" && connu.textesValides,
    message: raison === null ? "a_fabriquer" : "indisponible",
    raisonSansMessage: raison,
  };
}

const JOUR_MS = 24 * 3600_000;
export type DecisionCopie = { ok: true } | { ok: false; raison: "plafond_24h" };
/** Plafond de copies sur 24 h glissantes. Une date illisible compte comme une copie récente (échec fermé). */
export function decisionCopie(copiesIso: readonly string[], maintenantMs: number, plafond = 3): DecisionCopie {
  const recentes = copiesIso.filter((d) => {
    const t = typeof d === "string" ? Date.parse(d) : NaN;
    return !Number.isFinite(t) || maintenantMs - t < JOUR_MS;
  }).length;
  return recentes >= plafond ? { ok: false, raison: "plafond_24h" } : { ok: true };
}

/** Une carte déjà faite (ou déjà copiée) pour ce mot et cette personne (empreintes en commun) ? */
export function dejaTraitePourMot(cartes: readonly CarteATraiter[], empreintes: readonly string[], mot: string): boolean {
  const m = mot.toUpperCase();
  return empreintes.length > 0 && cartes.some((c) => (c.statut === "fait" || c.copieLe !== undefined) && (c.mot ?? "").toUpperCase() === m && (c.empreintes ?? []).some((x) => empreintes.includes(x)));
}

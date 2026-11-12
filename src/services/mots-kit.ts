/**
 * MOTS (PV-5) · kit à copier pour LinkedIn PROFIL (aucune automatisation). MODULE PUR.
 * Le kit n'est généré qu'à partir de textes VALIDÉS (état + empreinte inchangée) et conformes au contrôle de sortie.
 * Aucun texte n'est écrit en dur hormis les consignes de l'opérateur (non sortantes). Aucune adresse e-mail, aucun nom.
 * Le texte est rendu tel quel : l'échappement est fait à l'affichage (React) et testé.
 */
import { motsInterditsEnvoi } from "@/fournisseurs/publication/mots-interdits-envoi";
import { expressionsBannieDans } from "@/domaine/controles-visuel/texte";
import { controlerTexteSortant, type Refus } from "./mots-controle";
import { RE_MOT, textesValides, type TextesMot } from "./mots-textes";

export interface KitLinkedinProfil {
  mot: string;
  /** Texte du commentaire à épingler sous le post (texte public validé). */
  commentaireEpingle: string;
  /** Réponse type à coller sous chaque commentaire « mot seul » (texte public validé). */
  reponseType: string;
  lienGuide: string;
  /** Consignes manuelles pour l'opérateur (non sortantes). */
  instructions: readonly string[];
}

export const INSTRUCTIONS_KIT: readonly string[] = [
  "Publier le post, puis coller le commentaire épinglé et l'épingler.",
  "Pour chaque commentaire qui contient le mot seul, répondre avec la réponse type.",
  "Ne rien envoyer en message privé depuis le Studio : tout se fait à la main.",
  "Marquer le post « fait » dans la file À traiter quand c'est terminé.",
];

export type RefusKit = "textes_non_valides" | "mot_invalide" | "texte_refuse" | "lien_invalide";
export type ResultatKit = { ok: true; kit: KitLinkedinProfil } | { ok: false; code: RefusKit; refus: Refus[] };

/** Lien du guide : https seul, sans identifiants ni adresse e-mail, sans mot interdit. */
export function lienGuideValide(lien: string): boolean {
  if (typeof lien !== "string" || lien.length > 300 || /\s/.test(lien) || lien.includes("@")) return false;
  let u: URL;
  try {
    u = new URL(lien);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const decode = decodeURIComponentSure(lien);
  return motsInterditsEnvoi(decode).length === 0 && expressionsBannieDans(decode).length === 0;
}
function decodeURIComponentSure(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function construireKitLinkedinProfil(textes: TextesMot, lienGuide: string): ResultatKit {
  if (!RE_MOT.test(textes.mot)) return { ok: false, code: "mot_invalide", refus: [] };
  if (!textesValides(textes)) return { ok: false, code: "textes_non_valides", refus: [] };
  const refus = controlerTexteSortant("reponse_publique", textes.reponsePublique);
  if (refus.length) return { ok: false, code: "texte_refuse", refus };
  if (!lienGuideValide(lienGuide)) return { ok: false, code: "lien_invalide", refus: [] };
  return {
    ok: true,
    kit: { mot: textes.mot, commentaireEpingle: textes.reponsePublique, reponseType: textes.reponsePublique, lienGuide, instructions: INSTRUCTIONS_KIT },
  };
}

/* ---- File « À traiter » (légère) ---- */
export interface ElementATraiter {
  id: string;
  mot: string;
  /** Repère libre du post (titre court), jamais un nom de personne. */
  repere: string;
  creeLe: string;
  fait: boolean;
}
export const REPERE_MAX = 80;

export function ajouterElement(file: readonly ElementATraiter[], e: { id: string; mot: string; repere: string; creeLe: string }): { ok: true; file: ElementATraiter[] } | { ok: false; code: "mot_invalide" | "repere_invalide" | "doublon" } {
  if (!RE_MOT.test(e.mot)) return { ok: false, code: "mot_invalide" };
  const repere = e.repere.trim();
  if (!repere || repere.length > REPERE_MAX || repere.includes("@") || motsInterditsEnvoi(repere).length || expressionsBannieDans(repere).length) return { ok: false, code: "repere_invalide" };
  if (file.some((x) => x.id === e.id)) return { ok: false, code: "doublon" };
  return { ok: true, file: [...file, { id: e.id, mot: e.mot, repere, creeLe: e.creeLe, fait: false }] };
}
export const marquerFait = (file: readonly ElementATraiter[], id: string): ElementATraiter[] => file.map((x) => (x.id === id ? { ...x, fait: true } : x));
export const aTraiter = (file: readonly ElementATraiter[]): ElementATraiter[] => file.filter((x) => !x.fait);

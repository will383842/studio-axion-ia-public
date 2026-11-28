// Vidéos sur le site — garde pure de la reprise automatique des vidéos validées (ADR-0016, conception § 1.7). Dit si une
// vidéo peut être envoyée au site sans geste du fondateur. Rien n'est branché ici : le déclencheur viendra ensuite.
import type { EtapeEditoriale } from "@/domaine/types";
import type { EtatSite } from "./types";

export type RaisonNonReprise = "a-relire" | "retiree" | "retrait-rate" | "decochee" | "deja-en-ligne";

export type DecisionReprise = { reprendre: true } | { reprendre: false; raison: RaisonNonReprise };

/**
 * Reprise seulement si : étape validée, programmée ou publiée (jamais « à relire ») ; page non retirée (retrait
 * définitif côté site) ; pas un retrait raté (échec avec une version en ligne) ; pas décochée par le fondateur ;
 * pas déjà en ligne ni en cours. Les contrôles (SITE-01 à 18) restent bloquants plus loin.
 */
export function gardeRepriseAuto(e: { etape: EtapeEditoriale | undefined; site: EtatSite | undefined }): DecisionReprise {
  if (e.etape !== "validee" && e.etape !== "programmee" && e.etape !== "publiee") return { reprendre: false, raison: "a-relire" };
  const s = e.site;
  if (!s) return { reprendre: true };
  if (s.etat === "retiree") return { reprendre: false, raison: "retiree" };
  if (s.etat === "echec" && s.versionEnLigne !== undefined) return { reprendre: false, raison: "retrait-rate" };
  if (s.decocheeParWill === true) return { reprendre: false, raison: "decochee" };
  if (s.etat === "en-ligne" || s.etat === "envoi-en-cours" || s.etat === "retrait-en-cours") return { reprendre: false, raison: "deja-en-ligne" };
  return { reprendre: true };
}

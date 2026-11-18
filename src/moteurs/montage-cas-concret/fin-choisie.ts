/** FIX-CC-FIN-CHOIX-b1 : la fin « rendez-vous » choisie dans le formulaire (D1, DECISIONS-DELEGUEES-17-11.md point 7, Williams 17/11 22:18).
 * Table à part : jamais dans `TABLE_FINS_DIAGNOSTIC` (la rotation L3a et les tests qui figent la banque n'y voient rien).
 * Absente (`finDemandee` non posée) : aucune fin, exactement #1094. */
import type { FinTable } from "@/briques/fins";
import type { ReseauCas } from "@/formats/cas-concret";

/** D1 (17/11 22:18, délégation de Williams) : seule phrase de fin proposée au choix. */
export const VALIDATION_D1 = Object.freeze({ par: "will" as const, le: "2026-11-17", source: "validée par délégation de Williams, 17/11 22:18 (D1, DECISIONS-DELEGUEES-17-11.md point 7)" });
export const DIT_FIN_RENDEZ_VOUS = "Prenez rendez-vous pour votre diagnostic IA gratuit de 45 minutes.";
export const ECRAN_FIN_RENDEZ_VOUS = "Prenez rendez-vous";
export const TABLE_FINS_RENDEZ_VOUS: readonly FinTable[] = Object.freeze(([
  { id: "fin-if-rdv-45", groupe: "instagram-facebook", type: "rendez-vous", dit: DIT_FIN_RENDEZ_VOUS, ecran: ECRAN_FIN_RENDEZ_VOUS, validee: true, validation: VALIDATION_D1 },
  { id: "fin-ty-rdv-45", groupe: "tiktok-youtube",     type: "rendez-vous", dit: DIT_FIN_RENDEZ_VOUS, ecran: ECRAN_FIN_RENDEZ_VOUS, validee: true, validation: VALIDATION_D1 },
  { id: "fin-li-rdv-45", groupe: "linkedin",           type: "rendez-vous", dit: DIT_FIN_RENDEZ_VOUS, ecran: ECRAN_FIN_RENDEZ_VOUS, validee: true, validation: VALIDATION_D1 },
] as FinTable[]).map((l) => Object.freeze(l)));
/** Suite « rendez-vous » : la phrase D1 puis la phrase du lien du réseau DÉJÀ en banque (banque.ts:174-177). */
export const FINS_RENDEZ_VOUS: Readonly<Record<ReseauCas, readonly string[]>> = Object.freeze({
  facebook: ["fin-if-rdv-45", "fin-fb-lien-commentaire"],
  instagram: ["fin-if-rdv-45", "fin-ig-lien-profil"],
  tiktok: ["fin-ty-rdv-45", "fin-tt-lien-profil"],
  linkedin: ["fin-li-rdv-45", "fin-li-lien-commentaire"],
});
export type FinDemandee = "rendez-vous";
/** Lecture tolérante : seul "rendez-vous" exact ; tout le reste = aucune (undefined). */
export const lireFinDemandee = (v: unknown): FinDemandee | undefined => (v === "rendez-vous" ? "rendez-vous" : undefined);

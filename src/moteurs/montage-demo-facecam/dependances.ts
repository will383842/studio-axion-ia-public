/**
 * DÉPENDANCES RÉELLES DE LA DÉMO FACECAM (lot J) : les mêmes que la face caméra (`montage-facecam/dependances.ts`) —
 * `studio-aligneur` (transcription, alignement), `studio-rendu` (composition), adresses signées R2.
 * Le réel ne se prend que s'il est DEMANDÉ par la commande (`entrees.facecamAligneurReel`, comme la face caméra) ET
 * que `STUDIO_ALIGNEUR_URL` et `STUDIO_RENDU_URL` existent ; sinon `null` : la fabrication reste en pause claire.
 * Le LLM du plan de scènes est un RACCORD posé par les services (`brancherServicesDemoFacecam`) ; absent : plan simple.
 * Aucune variable d'environnement nouvelle.
 */
import type { CommandeFabrication } from "@/domaine/types";
import { resoudreFournisseur } from "@/fournisseurs";
import { fournisseurFacecam } from "@/fournisseurs/facecam";
import { obtenirServiceRendu, renduSimule } from "@/fournisseurs/rendu/client";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { aligneurReelDemande } from "../montage-facecam/dependances";
import type { DependancesDemo } from "./chaine";

const DUREE_LECTURE_SEC = 24 * 3600;
const DUREE_DEPOT_SEC = 6 * 3600;

export interface ServicesDemoFacecam {
  /** Fournisseur Claude du plan de scènes, passé par `executerRole` (pré-vol et réservation des crédits). */
  appelerPlan?: (c: CommandeFabrication, travailId: string) => AppelClaude | undefined;
}

const cleServices = Symbol.for("studio-axion-ia.demo-facecam-services");
type AvecServices = typeof globalThis & { [cleServices]?: ServicesDemoFacecam };

export function brancherServicesDemoFacecam(s: ServicesDemoFacecam): void {
  (globalThis as AvecServices)[cleServices] = { ...((globalThis as AvecServices)[cleServices] ?? {}), ...s };
}

export function servicesDemoFacecam(): ServicesDemoFacecam {
  return (globalThis as AvecServices)[cleServices] ?? {};
}

export function dependancesDemoParDefaut(c: CommandeFabrication, env: Record<string, string | undefined> = process.env, travailId = ""): DependancesDemo | null {
  if (!aligneurReelDemande(c) || renduSimule(env)) return null;
  const facecam = fournisseurFacecam({ reel: true }, env);
  if (facecam.mode !== "reel") return null;
  const stockage = resoudreFournisseur("stockage");
  const appelerPlan = servicesDemoFacecam().appelerPlan?.(c, travailId);
  return {
    facecam,
    alignement: resoudreFournisseur("alignement", "studio-aligneur"),
    rendu: obtenirServiceRendu(env),
    ...(appelerPlan ? { appelerPlan } : {}),
    urlLecture: async (cle) => (stockage.urlLectureDuree ? stockage.urlLectureDuree(cle, DUREE_LECTURE_SEC) : stockage.urlLecture(cle)),
    urlDepot: async (cle, mime) => {
      if (!stockage.urlDepotDuree) throw new Error("Stockage sans dépôt signé : la démo facecam exige R2.");
      return stockage.urlDepotDuree(cle, DUREE_DEPOT_SEC, mime);
    },
  };
}

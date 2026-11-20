"use server";

/**
 * G3-06b : création du brouillon de la démo facecam À PARTIR de deux fichiers réellement envoyés, derrière `demoFacecam.envoi`
 * (éteint par défaut, lu seulement par `demoFacecamOuverte`). Aucun prix, aucun lancement, aucune lecture de réglage ici.
 */
import type { Distribution } from "@/domaine/types";
import { essayer, type Resultat } from "@/services/_commun";
import { fichierEnvoye } from "@/services/fichiers";
import { creerDemoFacecam, demoFacecamOuverte } from "./actions";

export async function creerDemoDepuisEnvoi(e: { titre: string; entiteId: string; facecamFichierId: string; ecranFichierId?: string }): Promise<Resultat<{ videoId: string }>> {
  if (!(await demoFacecamOuverte())) return { ok: false, message: "La démo facecam n'est pas encore ouverte.", code: "DEMO_FERMEE" };
  const fichiers = await essayer(async () => {
    const facecam = await fichierEnvoye(e.facecamFichierId, "entree", e.entiteId);
    const ecran = e.ecranFichierId ? await fichierEnvoye(e.ecranFichierId, "entree", e.entiteId) : null;
    return { facecam, ecran };
  });
  if (!fichiers.ok) return fichiers;
  const { facecam, ecran } = fichiers.donnees;
  return creerDemoFacecam({
    titre: e.titre,
    // FIX-DEMO-DISTRIBUTION-v19b : la personne filmée parle, comme facecam-animee.ts:520
    distribution: [{ role: "Face caméra", source: "rush" }] satisfies Distribution[],
    demoFacecam: { facecam: { cle: facecam.cleStockage }, ...(ecran ? { ecran: { cle: ecran.cleStockage } } : {}) },
  });
}

"use server";

/**
 * Démo facecam : création du brouillon SEULE, derrière le réglage `demoFacecam.envoi` (éteint par défaut).
 * Rien n'est lancé, aucun prix n'est lu. Le lancement reste à G3-06a-b.
 */
import type { Distribution } from "@/domaine/types";
import { essayer, lireParametre, type Resultat } from "@/services/_commun";
import { nouveauBrouillonFormat } from "@/services/creation-format";
import { fabriquerEntreesDemoFacecam } from "@/services/entrees-demo-facecam";

const CLE_ENVOI_DEMO_FACECAM = "demoFacecam.envoi";

async function envoiActif(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(CLE_ENVOI_DEMO_FACECAM, false)) === true;
  } catch {
    return false;
  }
}

export async function demoFacecamOuverte(): Promise<boolean> {
  return envoiActif();
}

export async function creerDemoFacecam(formulaire: {
  titre: string;
  demoFacecam: Record<string, unknown>;
  distribution?: Distribution[];
}): Promise<Resultat<{ videoId: string }>> {
  if (!(await envoiActif())) return { ok: false, message: "La démo facecam n'est pas encore ouverte.", code: "DEMO_FERMEE" };
  return essayer(async () => {
    const entrees = await fabriquerEntreesDemoFacecam(formulaire.demoFacecam);
    const v = await nouveauBrouillonFormat({ formatId: "demo-facecam", titre: formulaire.titre, sujet: formulaire.titre, distribution: formulaire.distribution ?? [], entrees });
    return { videoId: v.id };
  });
}

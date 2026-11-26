"use server";

/**
 * R4-03-d2b : action serveur de la retouche GRATUITE v4 « Changer un extrait » (face caméra animée). Session exigée, puis le
 * service de R4-03-d1 (relecture de la demande, liaison à la version choisie, `lancerRetouche`) avec le VRAI lecteur du réglage
 * `retoucheChat.facecamAnimeeExtraits` (R4-03-c2 : seul `true` exact allume, une lecture qui lève éteint). Aucune autre logique,
 * rien d’argent ici : la garde est celle de `lancerRetouche`.
 */
import { revalidatePath } from "next/cache";
import { CLE_RETOUCHE_EXTRAITS_FA } from "@/moteurs/montage-facecam-animee";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { actualiserRetoucheExtraitsFA } from "@/services/facecam-animee-retouche";
import { demanderRetoucheExtraitV4 } from "@/services/retouche-extrait-v4-demande";

type ReponseExtraitV4 = { statut: "lancee" } | { statut: "refusee"; raison: string };

/** Le lecteur réel (R4-03-c2) : relit le réglage, puis la valeur rangée pour le moteur. */
async function extraitsV4Actifs(): Promise<boolean> {
  await actualiserRetoucheExtraitsFA();
  return (globalThis as Record<symbol, unknown>)[CLE_RETOUCHE_EXTRAITS_FA] === true;
}

export async function demanderChangementExtraitV4Action(videoId: string, demande: unknown): Promise<Resultat<ReponseExtraitV4>> {
  const r = await essayer(async (): Promise<ReponseExtraitV4> => {
    await exigerSession();
    const x = await demanderRetoucheExtraitV4(videoId, demande, { actif: extraitsV4Actifs });
    return x.statut === "lancee" ? { statut: "lancee" } : { statut: "refusee", raison: x.raison };
  });
  revalidatePath(`/videos/${videoId}`);
  return r;
}

/** Même action, sous la forme attendue par le panneau (`demander`) : un échec devient un refus lisible. */
export async function changerExtraitV4PourPanneau(videoId: string, demande: unknown): Promise<ReponseExtraitV4> {
  const r = await demanderChangementExtraitV4Action(videoId, demande);
  return r.ok ? r.donnees : { statut: "refusee", raison: r.message };
}

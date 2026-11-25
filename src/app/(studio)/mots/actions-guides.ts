"use server";

/**
 * Actions serveur de l'onglet « Guides » de /mots (lot G5). Chacune EXIGE la session avant tout, puis appelle le geste ;
 * éteint (`GUIDES_FABRIQUE_ECRAN` différent de « true »), le geste refuse sans rien lire ni écrire. Le client n'envoie que le
 * mot, la version et le texte relu : le texte envoyé au site est relu côté serveur dans la version validée.
 */
import { revalidatePath } from "next/cache";
import type { OrigineLancement } from "@/services/budget-mensuel";
import { exigerSession } from "@/services/auth";
import { fabriquerPdf, lireGuideDuMot, rattacherGuide, redigerGuide, validerGuide, type ResultatGeste, type VueGuideMot } from "@/services/guides-fabrique";

/** Seul point d'entrée où « studio » s'écrit : chaque action ci-dessous exige d'abord la session d'une personne connectée. */
const ORIGINE_GESTE_PERSONNE: OrigineLancement = "studio";
const rafraichir = () => revalidatePath("/mots");

export async function lireGuideAction(mot: string): Promise<ResultatGeste<{ vue: VueGuideMot }>> {
  await exigerSession();
  return lireGuideDuMot(String(mot));
}
export async function redigerGuideAction(mot: string): Promise<ResultatGeste<{ version: number }>> {
  await exigerSession();
  const r = await redigerGuide(String(mot), ORIGINE_GESTE_PERSONNE);
  rafraichir();
  return r;
}
export async function validerGuideAction(mot: string, version: number, contenu: unknown, toutLu: boolean): Promise<ResultatGeste<{ empreinte: string }>> {
  await exigerSession();
  const r = await validerGuide({ mot: String(mot), version: Number(version), contenu, toutLu: toutLu === true });
  rafraichir();
  return r;
}
export async function fabriquerPdfAction(mot: string): Promise<ResultatGeste<{ cheminPdf: string | null; pages: number | null }>> {
  await exigerSession();
  const r = await fabriquerPdf({ mot: String(mot) });
  rafraichir();
  return r;
}
export async function rattacherGuideAction(mot: string): Promise<ResultatGeste<object>> {
  await exigerSession();
  const r = await rattacherGuide({ mot: String(mot) });
  rafraichir();
  return r;
}

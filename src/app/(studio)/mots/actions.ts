"use server";

/**
 * Actions serveur de l'écran « Mots » (/mots). Chacune passe par `mots-gestes`, qui EXIGE la session avant tout (sans session :
 * refus, rien n'est lu ni écrit). `confirmeParOperateur` n'y est vrai que parce que la session a été exigée ; la confirmation
 * visible (fenêtre du navigateur) est demandée par l'écran avant l'appel. « Activer » et « Pause » du mot GUIDE LOCAL ne parlent
 * jamais à Zernio. Aucun interrupteur n'est allumé ici.
 */
import { revalidatePath } from "next/cache";
import { gesteActiverMotLocal, gesteValiderMotGuide, gesteValiderFormulation, gesteMettreEnPause, gesteMettreEnPauseLocal, gesteReactiver, gesteRefermerDisjoncteur, gesteReglerPlafonds } from "@/services/mots-gestes";
import type { Resultat } from "@/services/mots-service";

const rafraichir = () => revalidatePath("/mots");

export async function activerMotLocalAction(compte: string): Promise<Resultat> {
  const r = await gesteActiverMotLocal(compte);
  rafraichir();
  return r;
}
export async function mettreEnPauseLocalAction(mot: string, compte: string): Promise<Resultat> {
  const r = await gesteMettreEnPauseLocal(mot, compte);
  rafraichir();
  return r;
}
export async function mettreEnPauseAction(mot: string, compte: string): Promise<Resultat> {
  const r = await gesteMettreEnPause(mot, compte);
  rafraichir();
  return r;
}
export async function reactiverAction(mot: string, compte: string): Promise<Resultat> {
  const r = await gesteReactiver(mot, compte);
  rafraichir();
  return r;
}
export async function refermerDisjoncteurAction(): Promise<{ ok: boolean }> {
  const r = await gesteRefermerDisjoncteur();
  rafraichir();
  return r;
}
export async function reglerPlafondsAction(p: { heureCompte?: number; jourMot?: number }): Promise<unknown> {
  const r = await gesteReglerPlafonds(p);
  rafraichir();
  return r;
}
/** Aucun argument : le texte du mot GUIDE est lu côté serveur, jamais transmis par le client. */
export async function validerMotGuideAction(): Promise<{ ok: boolean; raison: string }> {
  const r = await gesteValiderMotGuide();
  rafraichir();
  return r;
}
/** Une formulation = un geste. Le client n'envoie qu'un nom de version ; le serveur la contrôle contre le dictionnaire (aucun texte transmis). */
export async function validerFormulationAction(version: string): Promise<{ ok: boolean; raison: string }> {
  const r = await gesteValiderFormulation(version);
  rafraichir();
  return r;
}

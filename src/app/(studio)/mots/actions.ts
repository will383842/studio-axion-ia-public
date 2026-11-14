"use server";

/**
 * Actions serveur de l'écran « Mots » (/mots). Chacune passe par `mots-gestes`, qui EXIGE la session avant tout (sans session :
 * refus, rien n'est lu ni écrit). `confirmeParOperateur` n'y est vrai que parce que la session a été exigée ; la confirmation
 * visible (fenêtre du navigateur) est demandée par l'écran avant l'appel. « Activer » et « Pause » du mot GUIDE LOCAL ne parlent
 * jamais à Zernio. Seule exception : les deux interrupteurs du parcours (plusieurs mots, Instagram), allumés uniquement sur geste confirmé de l'opérateur.
 */
import { revalidatePath } from "next/cache";
import { gesteActiverMot, gesteApercuTextesMot, gesteChangerCible, gesteCreerMot, gestePauseMot, gesteValiderTextesMot, type ResultatMotCible, gesteActiverMotLocal, gesteValiderMotGuide, gesteValiderFormulation, gesteMettreEnPause, gesteMettreEnPauseLocal, gesteReactiver, gesteRefermerDisjoncteur, gesteReglerPlafonds, gesteReglerParcours } from "@/services/mots-gestes";
import { phraseDuCode, versApercuVue, versResultatGeste } from "@/services/mots-cibles-vue";
import type { ApercuTextesVue, ReseauAutoVue, ResultatGesteVue, ResultatSimpleVue } from "@/domaine/guide-reseau/vue-mots-cibles";
import type { Resultat } from "@/services/mots-service";
import type { ReglageParcours, ResultatReglage } from "@/services/parcours-reglages";

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
/** Interrupteurs du parcours : le client n'envoie qu'un nom de réglage et un booléen ; Instagram refusé si plusieurs mots est éteint. */
export async function reglerParcoursAction(reglage: ReglageParcours, allume: boolean): Promise<ResultatReglage> {
  const r = await gesteReglerParcours(reglage, allume);
  rafraichir();
  return r;
}

/* R5 · mots et cibles : une action par geste, la session est exigée dans le geste, les phrases sont écrites ICI (côté serveur). */
const phraseSimple = (r: ResultatMotCible, phraseReussie: string): ResultatSimpleVue => ({ ok: r.ok, phrase: r.ok ? (r.phrase ?? phraseReussie) : (r.phrase ?? phraseDuCode(r.raison)) });

export async function creerMotAction(mot: string, codeCible: string): Promise<ResultatSimpleVue> {
  const r = await gesteCreerMot(mot, codeCible);
  rafraichir();
  return phraseSimple(r, "Mot créé en brouillon.");
}
export async function changerCibleAction(mot: string, codeCible: string): Promise<ResultatSimpleVue> {
  const r = await gesteChangerCible(mot, codeCible);
  rafraichir();
  return phraseSimple(r, "Cible changée.");
}
export async function apercuTextesMotAction(mot: string): Promise<ApercuTextesVue> {
  return versApercuVue(await gesteApercuTextesMot(mot));
}
/** Le client n'envoie que le mot, le réseau et l'empreinte qu'il a vue : aucun texte. */
export async function validerTextesMotAction(mot: string, reseau: ReseauAutoVue, empreinteVue: string): Promise<ResultatSimpleVue> {
  const r = await gesteValiderTextesMot(mot, reseau, empreinteVue);
  rafraichir();
  return { ok: r.ok, phrase: r.ok ? "Textes validés. Rien n'a été envoyé." : phraseDuCode(r.raison) };
}
export async function activerMotAction(mot: string, compte: string): Promise<ResultatGesteVue> {
  const r = await gesteActiverMot(mot, compte);
  rafraichir();
  return versResultatGeste(r, "Mot activé sur ce compte.");
}
export async function pauseMotAction(mot: string, compte: string): Promise<ResultatGesteVue> {
  const r = await gestePauseMot(mot, compte);
  rafraichir();
  return versResultatGeste(r, "Mot mis en pause sur ce compte. Rien n'est supprimé.");
}

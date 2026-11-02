/**
 * MOTS (PV-3) · gestes de l'opérateur : chaque geste exige la session, puis appelle le service. Une action serveur de l'écran
 * « Mots » n'a qu'à les appeler. `confirmeParOperateur` n'est vrai QUE parce que la session a été exigée ici.
 * Textes : saisie validée de l'opérateur ou fichier `mots/<MOT>.md` ; jamais de texte écrit en dur.
 */
import "server-only";
import { exigerSession } from "./auth";
import { chargerTextesFichier, lireVueMots, mettreEnPause, poserMot, poserStopCompte, reactiverMot, refermerDisjoncteur, reglerPlafonds, type Resultat, type VueMots } from "./mots-service";
import type { TextesMot } from "./mots-textes";

export async function gesteLireMots(): Promise<VueMots> {
  await exigerSession();
  return lireVueMots();
}
export async function gestePoserMot(compte: string, textes: TextesMot): Promise<Resultat> {
  await exigerSession();
  return poserMot({ compte, textes, confirmeParOperateur: true });
}
/** Pose depuis `mots/<MOT>.md` : fichier absent, illisible ou non validé = refus, rien n'est appelé. */
export async function gestePoserDepuisFichier(compte: string, mot: string): Promise<Resultat> {
  await exigerSession();
  const lu = await chargerTextesFichier(mot);
  if (!lu || !lu.ok) return { issue: "refuse", raison: lu ? lu.raison : "fichier_absent" };
  return poserMot({ compte, textes: lu.textes, confirmeParOperateur: true });
}
export async function gestePoserStop(compte: string): Promise<Resultat> {
  await exigerSession();
  return poserStopCompte({ compte, confirmeParOperateur: true });
}
export async function gesteMettreEnPause(mot: string, compte: string): Promise<Resultat> {
  await exigerSession();
  return mettreEnPause({ mot, compte, confirmeParOperateur: true });
}
export async function gesteReactiver(mot: string, compte: string): Promise<Resultat> {
  await exigerSession();
  return reactiverMot({ mot, compte, confirmeParOperateur: true });
}
export async function gesteRefermerDisjoncteur(): Promise<{ ok: boolean }> {
  await exigerSession();
  return refermerDisjoncteur({ confirmeParOperateur: true });
}
export async function gesteReglerPlafonds(p: { heureCompte?: number; jourMot?: number }) {
  await exigerSession();
  return reglerPlafonds(p);
}

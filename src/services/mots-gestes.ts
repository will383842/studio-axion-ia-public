/**
 * MOTS (PV-3) · gestes de l'opérateur : chaque geste exige la session, puis appelle le service. Une action serveur de l'écran
 * « Mots » n'a qu'à les appeler. `confirmeParOperateur` n'est vrai QUE parce que la session a été exigée ici.
 * Textes : saisie validée de l'opérateur ou fichier `mots/<MOT>.md` ; jamais de texte écrit en dur.
 */
import "server-only";
import { exigerSession } from "./auth";
import { activerMotLocal, chargerTextesFichier, mettreEnPauseLocal, lireVueMots, mettreEnPause, validerGuideParcours, validerAdresseRefusee, validerFormulation, poserMot, poserMotDepuisFichier, validerMot, poserStopCompte, reactiverMot, refermerDisjoncteur, reglerPlafonds, type Resultat, type VueMots } from "./mots-service";
import type { SaisieMot } from "./mots-textes";
import { comptesParcours, titreGuideParcours } from "@/domaine/guide-reseau/empreinte-guide";
import { guideFichierPresent } from "./mots-guide-source";

export async function gesteLireMots(): Promise<VueMots> {
  await exigerSession();
  return lireVueMots();
}
/** Pose d'une SAISIE (sans état ni empreinte) : refusée tant que le geste de validation n'a pas enregistré son empreinte. */
export async function gestePoserMot(compte: string, saisie: SaisieMot): Promise<Resultat> {
  await exigerSession();
  return poserMot({ compte, saisie: { mot: saisie.mot, reponsePublique: saisie.reponsePublique, messagePrive: saisie.messagePrive, relance: saisie.relance, fin: saisie.fin }, confirmeParOperateur: true });
}
/** Validation « par l'opérateur » : seule voie qui enregistre l'empreinte (session exigée). */
export async function gesteValiderMot(saisie: SaisieMot): Promise<{ ok: boolean; raison: string }> {
  await exigerSession();
  const r = await validerMot({ saisie: { mot: saisie.mot, reponsePublique: saisie.reponsePublique, messagePrive: saisie.messagePrive, relance: saisie.relance, fin: saisie.fin }, confirmeParOperateur: true });
  return { ok: r.ok, raison: r.raison };
}
/** Pose depuis `mots/<MOT>.md` : fichier absent, illisible ou non validé = refus, rien n'est appelé. */
export async function gestePoserDepuisFichier(compte: string, mot: string): Promise<Resultat> {
  await exigerSession();
  const lu = await chargerTextesFichier(mot);
  if (!lu || !lu.ok) return { issue: "refuse", raison: lu ? lu.raison : "fichier_absent" };
  return poserMotDepuisFichier({ compte, textes: lu.textes, confirmeParOperateur: true });
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
/** Activation LOCALE du mot GUIDE (session exigée) : aucun appel vers Zernio, refus fermé si une garde manque. */
export async function gesteActiverMotLocal(compte: string): Promise<Resultat> {
  await exigerSession();
  if (!comptesParcours().includes(compte)) return { issue: "refuse", raison: "compte_hors_liste" };
  return activerMotLocal({ mot: "GUIDE", compte, confirmeParOperateur: true });
}
export async function gesteMettreEnPauseLocal(mot: string, compte: string): Promise<Resultat> {
  await exigerSession();
  return mettreEnPauseLocal({ mot, compte, confirmeParOperateur: true });
}
/**
 * Validation des textes du mot GUIDE du parcours : le client ne transmet rien. Refusée si `mots/GUIDE.md` existe (le parcours
 * n'envoie pas ce fichier : la validation ne le couvrirait pas). Le titre est celui du serveur, comme pour le parcours.
 */
export async function gesteValiderMotGuide(): Promise<{ ok: boolean; raison: string }> {
  await exigerSession();
  if (await guideFichierPresent()) return { ok: false, raison: "guide_fichier_present" };
  const r = await validerGuideParcours({ titre: titreGuideParcours(process.env), confirmeParOperateur: true });
  return { ok: r.ok, raison: r.raison };
}
/** Validation du message « adresse refusée » : le client ne transmet rien, le texte est celui du dictionnaire (serveur). */
export async function gesteValiderAdresseRefusee(): Promise<{ ok: boolean; raison: string }> {
  await exigerSession();
  const r = await validerAdresseRefusee({ confirmeParOperateur: true });
  return { ok: r.ok, raison: r.raison };
}
/** Validation d'UNE formulation : le client n'envoie qu'un nom de version, contrôlé côté serveur contre le dictionnaire (jamais de texte). */
export async function gesteValiderFormulation(version: string): Promise<{ ok: boolean; raison: string }> {
  await exigerSession();
  if (typeof version !== "string") return { ok: false, raison: "formulation_inconnue" };
  return validerFormulation({ version, confirmeParOperateur: true });
}
/** Comptes du parcours de conversation (identifiants seulement) pour les boutons d'activation. */
export async function gesteComptesGuide(): Promise<string[]> {
  await exigerSession();
  return comptesParcours();
}

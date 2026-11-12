/** MOTS (PV-5) · gestes de l'opérateur pour le kit LinkedIn profil et la file « À traiter » : session exigée, puis service (inerte si éteint). */
import "server-only";
import { exigerSession } from "./auth";
import { ajouterATraiter, genererKit, lireATraiter, marquerElementFait } from "./mots-kit-service";
import type { SaisieMot } from "./mots-textes";

export async function gesteGenererKit(saisie: SaisieMot, lienGuide: string) {
  await exigerSession();
  return genererKit({ saisie, lienGuide });
}
export async function gesteLireATraiter() {
  await exigerSession();
  return lireATraiter();
}
export async function gesteAjouterATraiter(mot: string, repere: string) {
  await exigerSession();
  return ajouterATraiter({ mot, repere });
}
export async function gesteMarquerFait(id: string) {
  await exigerSession();
  return marquerElementFait({ id });
}

/** À TRAITER (PV4) · gestes de l'opérateur : session exigée en premier, puis service (inerte si éteint). */
import "server-only";
import { exigerSession } from "./auth";
import { arreterDepuisCarte, ignorerCarte, lireVueATraiter, marquerCarteFaite } from "./a-traiter";
import { copierMessageCarte, copierReponseCarte } from "./a-traiter-copie";

export async function gesteLireATraiter() {
  await exigerSession();
  return lireVueATraiter();
}
export async function gesteCarteFaite(id: string) {
  await exigerSession();
  return marquerCarteFaite(id);
}
export async function gesteCarteIgnorer(id: string) {
  await exigerSession();
  return ignorerCarte(id);
}
export async function gesteCarteStop(id: string, compte: string) {
  await exigerSession();
  return arreterDepuisCarte(id, compte);
}
export async function gesteCopierMessage(id: string) {
  await exigerSession();
  return copierMessageCarte(id);
}
export async function gesteCopierReponse(id: string) {
  await exigerSession();
  return copierReponseCarte(id);
}

/** À TRAITER (PV4) · gestes de l'opérateur : session exigée en premier, puis service (inerte si éteint). Dépôt PERSISTANT partout. */
import "server-only";
import { exigerSession } from "./auth";
import { arreterDepuisCarte, ignorerCarte, injecterDepotPersistantATraiter, lireVueATraiter, marquerCarteFaite } from "./a-traiter";
import { creerDepotParametre } from "./a-traiter-depot";
import { copierMessageCarte, copierReponseCarte } from "./a-traiter-copie";

/** Pose (une seule fois) le dépôt persistant comme dépôt courant du service ; idempotent. */
function depotPersistant() {
  const depot = creerDepotParametre();
  injecterDepotPersistantATraiter(depot);
  return depot;
}

export async function gesteLireATraiter() {
  await exigerSession();
  return lireVueATraiter({ depot: depotPersistant() });
}
export async function gesteCarteFaite(id: string) {
  await exigerSession();
  return marquerCarteFaite(id, { depot: depotPersistant() });
}
export async function gesteCarteIgnorer(id: string) {
  await exigerSession();
  return ignorerCarte(id, { depot: depotPersistant() });
}
export async function gesteCarteStop(id: string, compte: string) {
  await exigerSession();
  return arreterDepuisCarte(id, compte, { depot: depotPersistant() });
}
export async function gesteCopierMessage(id: string) {
  await exigerSession();
  return copierMessageCarte(id, { depot: depotPersistant() });
}
export async function gesteCopierReponse(id: string) {
  await exigerSession();
  return copierReponseCarte(id, { depot: depotPersistant() });
}

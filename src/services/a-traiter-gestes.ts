/** À TRAITER (PV4) · gestes de l'opérateur : session exigée en premier, puis service (inerte si éteint). Dépôt PERSISTANT partout. */
import "server-only";
import { exigerSession } from "./auth";
import { aTraiterActif, arreterDepuisCarte, ignorerCarte, injecterDepotPersistantATraiter, lireVueATraiter, marquerCarteFaite, type DepotATraiter } from "./a-traiter";
import type { CarteDejaTraitee } from "./a-traiter-onglets";
import { creerDepotParametre } from "./a-traiter-depot";
import { copierMessageCarte } from "./a-traiter-copie";

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

/** Cartes déjà traitées (fait ou ignoré), lecture seule. Éteint ou illisible : liste vide. Aucune écriture, rien n'est renvoyé. */
export async function gesteLireDejaTraitees(o: { env?: Record<string, string | undefined>; depot?: DepotATraiter } = {}): Promise<CarteDejaTraitee[]> {
  await exigerSession();
  if (!aTraiterActif(o.env ?? process.env)) return [];
  try {
    const cartes = await (o.depot ?? creerDepotParametre()).lire();
    return cartes
      .filter((c) => c.statut === "fait" || c.statut === "ignore")
      .map((c) => ({
        idEvenement: c.idEvenement,
        reseau: c.reseau,
        extrait: c.extrait,
        creeLe: c.creeLe,
        ...(c.statut === "fait" && c.faitLe ? { faitLe: c.faitLe } : {}),
        statut: c.statut as "fait" | "ignore",
      }))
      .sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  } catch {
    return [];
  }
}

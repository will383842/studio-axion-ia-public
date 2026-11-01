/**
 * NAV · constantes et gestes partagés par les parcours navigateur (simulation, aucune clé réelle).
 * Le mot de passe d'essai est FABRIQUÉ à chaque lancement (jamais écrit dans un fichier du dépôt).
 */
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export const PORT_STUDIO = Number(process.env.NAV_PORT ?? 3411);
export const PORT_FAUX = Number(process.env.NAV_FAUX_ZERNIO_PORT ?? 3921);
export const URL_FAUX = `http://127.0.0.1:${PORT_FAUX}`;

/** Dossier d'essai : fichier d'état de Migration, relu à chaque requête par le serveur. */
export const DOSSIER_NAV = process.env.NAV_DOSSIER ?? "";
export const FICHIER_MIGRATION = join(DOSSIER_NAV, "migration.json");
export const MOT_DE_PASSE_ESSAI = process.env.NAV_MDP ?? "";

/** Jetons concaténés : les mots interdits ne s'écrivent jamais en clair dans le dépôt. */
export const J = (...p: string[]): string => p.join("");
export const MOTS_INTERDITS = [J("Greno", "ble"), J("Aucun gain ", "garanti"), J("Quali", "opi"), J("certi", "fié")];
export const MOTS_ANGLAIS = ["Loading", "Error", "Retry", "Cancel", "Submit", "Settings", "Dashboard", "Schedule", "Draft", "Publish", "Failed", "Success"];

export async function regler(mode: "normal" | "vide" | "erreur" | "cle-refusee" | "lent"): Promise<void> {
  const r = await fetch(`${URL_FAUX}/__regler?mode=${mode}`);
  expect(r.ok).toBe(true);
}
export async function appelsFaux(): Promise<{ methode: string; chemin: string; ecriture: boolean }[]> {
  return (await (await fetch(`${URL_FAUX}/__appels`)).json()).appels;
}
export async function viderAppels(): Promise<void> {
  await fetch(`${URL_FAUX}/__vider`);
}

export type EtatMigrationEssai = { posts: unknown[]; comptes: unknown[] } | { lecteur: "panne" } | null;
export function ecrireMigration(etat: EtatMigrationEssai): void {
  if (etat === null) rmSync(FICHIER_MIGRATION, { force: true });
  else writeFileSync(FICHIER_MIGRATION, JSON.stringify(etat));
}

export async function seConnecter(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE_ESSAI);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 60_000 }), page.getByRole("button", { name: "Entrer" }).click()]);
}

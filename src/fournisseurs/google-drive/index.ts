/**
 * CHOIX DU FOURNISSEUR Google Drive (lot E2). Par défaut : le DOUBLE DE SIMULATION (aucun appel à Google).
 * Le vrai Drive n'est pris que si `FOURNISSEUR_GOOGLE_DRIVE=google` ET `GOOGLE_CLIENT_ID` ET `GOOGLE_CLIENT_SECRET`
 * existent. Adresse de retour : `GOOGLE_REDIRECTION`, sinon `${STUDIO_ADRESSE}/api/google-drive/retour`
 * (elle doit être inscrite telle quelle dans la console Google). Compte proposé : `GOOGLE_DRIVE_COMPTE`.
 */
import { creerDriveHttp, type ConfigDrive } from "./http";
import { creerDriveSimule, optionsDepuisEnv } from "./simulation";
import type { FournisseurDrive } from "./types";

export * from "./types";
export { creerDriveHttp } from "./http";
export { creerDriveSimule, octetEssai, VIDEOS_DRIVE_ESSAI } from "./simulation";

export function configDrive(env: Record<string, string | undefined> = process.env): ConfigDrive | null {
  if (env.FOURNISSEUR_GOOGLE_DRIVE?.trim() !== "google") return null;
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const redirection = env.GOOGLE_REDIRECTION?.trim() || `${(env.STUDIO_ADRESSE?.trim() || "https://studio.axion-ia.com").replace(/\/+$/, "")}/api/google-drive/retour`;
  if (!/^https?:\/\//.test(redirection)) return null;
  return { clientId, clientSecret, redirection, compteAttendu: env.GOOGLE_DRIVE_COMPTE?.trim() || undefined };
}

const cleDouble = Symbol.for("studio-axion-ia.drive-simule");
const cleRemplacant = Symbol.for("studio-axion-ia.drive-remplacant");
type AvecDouble = typeof globalThis & { [cleDouble]?: FournisseurDrive; [cleRemplacant]?: FournisseurDrive };

export function fournisseurDrive(env: Record<string, string | undefined> = process.env): FournisseurDrive {
  const g = globalThis as AvecDouble;
  if (g[cleRemplacant]) return g[cleRemplacant];
  const config = configDrive(env);
  if (config) return creerDriveHttp(config);
  // Un seul double par processus (ses coupures d'essai ne se répètent pas à chaque appel).
  return (g[cleDouble] ??= creerDriveSimule(optionsDepuisEnv(env)));
}

/** Remplace le fournisseur (tests seulement). `null` : retour au choix par défaut. */
export function remplacerFournisseurDrive(f: FournisseurDrive | null): void {
  (globalThis as AvecDouble)[cleRemplacant] = f ?? undefined;
}

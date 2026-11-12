/**
 * ÉTAT DES BRANCHEMENTS (L0-12). Compose l'existant sans le dupliquer : l'état du parcours Zernio (lecture seule), les
 * variables R2 (mêmes quatre que `configR2`) et le mode de stockage. Aucun réseau. Pour un secret : « présent », « absent »
 * ou « trop court », jamais la valeur. « Prêt à publier » est refusé si le stockage est simulé en production.
 */
import "server-only";
import { configR2 } from "@/fournisseurs/r2/stockage";
import { etatBranchementZernio, type EtatBranchement } from "./branchements-zernio";

type Env = Record<string, string | undefined>;
export type StatutSecret = "present" | "absent" | "trop_court";

export const LONGUEUR_MINI_SECRET = 8;
export const VARIABLES_R2 = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;
export const SECRETS_SURVEILLES = ["ZERNIO_API_KEY", "SITE_GUIDES_RESEAU_SECRET", "STUDIO_EMPREINTE_SECRET", "R2_SECRET_ACCESS_KEY"] as const;
export const MESSAGE_STOCKAGE_SIMULE =
  "Le stockage des vidéos est en simulation (le stockage R2 n'est pas relié) : en production, rien ne peut être déclaré prêt à publier ni envoyé. Reliez le stockage R2, puis réessayez.";

/** Présent, absent ou trop court : jamais la valeur. */
export function statutSecret(valeur: string | undefined, minimum = LONGUEUR_MINI_SECRET): StatutSecret {
  const v = valeur?.trim() ?? "";
  if (v === "") return "absent";
  return v.length < minimum ? "trop_court" : "present";
}

export interface EtatStockage {
  simule: boolean;
  production: boolean;
  /** Noms des variables manquantes (jamais de valeur). */
  manque: string[];
  pretAPublier: boolean;
  message: string | null;
}

/**
 * Le stockage est réel seulement si les quatre variables R2 sont posées (`configR2`, une seule définition) ET si le
 * fournisseur choisi est « r2 » : le réglage en base `fournisseur.stockage` (`valeurEnBase`), sinon FOURNISSEUR_STOCKAGE,
 * comme `choixFournisseur`. Sinon la simulation reste en place, même avec les quatre variables.
 */
export function etatStockage(env: Env = process.env, valeurEnBase?: string | null): EtatStockage {
  const manque = VARIABLES_R2.filter((n) => (env[n]?.trim() ?? "") === "") as string[];
  const choisi = valeurEnBase || env.FOURNISSEUR_STOCKAGE || "simulation";
  const simule = configR2(env) === null || choisi !== "r2";
  const production = env.NODE_ENV === "production";
  const pretAPublier = !(simule && production);
  return { simule, production, manque, pretAPublier, message: pretAPublier ? null : MESSAGE_STOCKAGE_SIMULE };
}

export interface EtatBranchements {
  stockage: EtatStockage;
  secrets: Record<(typeof SECRETS_SURVEILLES)[number], StatutSecret>;
  zernio: EtatBranchement | null;
  pretAPublier: boolean;
}

export function etatBranchements(env: Env = process.env, zernio: EtatBranchement | null = etatBranchementZernio(), stockageEnBase?: string | null): EtatBranchements {
  const stockage = etatStockage(env, stockageEnBase);
  const secrets = Object.fromEntries(SECRETS_SURVEILLES.map((n) => [n, statutSecret(env[n])])) as EtatBranchements["secrets"];
  return { stockage, secrets, zernio, pretAPublier: stockage.pretAPublier };
}

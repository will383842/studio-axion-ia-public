/**
 * INSCRIPTION DES FOURNISSEURS HEYGEN RÉELS (posée par l'architecte le 02/10, `docs/BRANCHEMENTS-EXECUTION.md`).
 * Le registre (`fournisseurs/index.ts`) appelle ces fonctions : chaque lot les remplit sans toucher au registre.
 *  - `voixHeygen()` : lot A1 (M0b) — renvoie `{ heygen: FournisseurVoix }` si `HEYGEN_API_KEY` existe. Une voix reliée
 *    (`Voix.fournisseur = "heygen"`) l'utilise directement ; `FOURNISSEUR_VOIX=heygen` (ou le réglage `fournisseur.voix`)
 *    en fait la voix par défaut des nouvelles copies ;
 *  - `visagesHeygen()` : lot B1 (décors réalistes, Looks) — renvoie `{ heygen: FournisseurVisage }` si la clé existe ET
 *    `FOURNISSEUR_VISAGE=heygen` (Looks écrits et éteints par défaut).
 * Sans clé : rien n'est inscrit, la simulation reste le défaut.
 */
import type { FournisseurVisage, FournisseurVoix, StockageFichiers } from "../types";
import { creerClientHeygen } from "./client";
import { creerFournisseurVisageHeygen } from "./visage";
import { creerFournisseurVoixHeygen } from "./voix";
import { plafondVideoHeygen } from "./telechargement";
import { creerVideosHeygen, type VideosHeygen } from "./videos-compte";

/** Stockage choisi par le registre (R2 si relié) ; import tardif : le registre importe ce fichier. */
async function stockageDuRegistre(): Promise<StockageFichiers> {
  const { resoudreFournisseur } = await import("../index");
  return resoudreFournisseur("stockage");
}

/** Réglage « Votre avatar parle dans le studio » (import tardif : la couche fournisseur ne lit pas les dépôts). */
async function reglageLooksAllumes(): Promise<boolean> {
  const { looksStudioAllumes } = await import("@/services/rendu-double");
  return looksStudioAllumes();
}

async function reglageRenduAllume(): Promise<boolean> {
  const { renduDoubleAllume } = await import("@/services/rendu-double");
  return renduDoubleAllume();
}

/** Lot A1 (M0b). */
export function voixHeygen(env: Record<string, string | undefined> = process.env): Record<string, FournisseurVoix> {
  const cle = env.HEYGEN_API_KEY?.trim();
  if (!cle) return {};
  return { heygen: creerFournisseurVoixHeygen({ client: creerClientHeygen({ cle }), stockage: stockageDuRegistre }) };
}

/**
 * Lot B1 (Looks HeyGen des décors réalistes ; le rendu du visage réel reste au lot M6). ÉCRIT ET ÉTEINT : inscrit
 * seulement si `HEYGEN_API_KEY` ET `FOURNISSEUR_VISAGE=heygen` (le même interrupteur l'active ensuite dans le
 * registre). Sans les deux : rien, la simulation reste le défaut et aucun look n'est jamais payé.
 */
export function visagesHeygen(env: Record<string, string | undefined> = process.env): Record<string, FournisseurVisage> {
  const cle = env.HEYGEN_API_KEY?.trim();
  if (!cle || env.FOURNISSEUR_VISAGE?.trim() !== "heygen") return {};
  // Lot R7 : le stockage du registre sert à signer le son des rendus et à garder le webm rendu.
  // Lot R7e : le réglage de Will (éteint par défaut) est relu avant chaque envoi payant.
  return { heygen: creerFournisseurVisageHeygen(creerClientHeygen({ cle }), { stockage: stockageDuRegistre, renduAllume: reglageRenduAllume, looksAllumes: reglageLooksAllumes }) };
}

/**
 * Lot R7 (décision de Will du 03/10) : LECTURE des vidéos faites dans l'application HeyGen (liste, détail,
 * téléchargement), toutes gratuites. Seule la clé est exigée ; sans clé : null (l'écran propose le dépôt manuel).
 */
export function videosHeygen(env: Record<string, string | undefined> = process.env): VideosHeygen | null {
  const cle = env.HEYGEN_API_KEY?.trim();
  if (!cle) return null;
  return creerVideosHeygen(creerClientHeygen({ cle }), fetch, { plafond: plafondVideoHeygen(env) });
}

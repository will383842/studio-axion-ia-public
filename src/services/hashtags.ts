/**
 * « VOS HASHTAGS » (Réglages › Mes réseaux, équipe 7) : la famille de mots-dièse de chaque réseau, gardée dans le
 * paramètre `hashtags.parReseau`. TikTok est prérempli ; un réseau absent reste libre. Les règles sont dans
 * `reseaux/hashtags.ts` (PUR).
 */
import "server-only";
import type { IdReseau } from "@/domaine/types";
import { obtenirReseau } from "@/reseaux";
import { HASHTAGS_PAR_DEFAUT, validerFamille, type FamillesHashtags } from "@/reseaux/hashtags";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";

const CLE = "hashtags.parReseau";

/** Familles de tous les réseaux (le défaut de TikTok tant que Will ne l'a pas changé). */
export async function lireFamilles(): Promise<FamillesHashtags> {
  return { ...HASHTAGS_PAR_DEFAUT, ...(await lireParametre<FamillesHashtags>(CLE, {})) };
}

/** Enregistre la famille d'un réseau (nettoyée) ; un mot-dièse fourre-tout est refusé avec une phrase claire. */
export async function definirFamille(reseau: IdReseau, saisie: string[]): Promise<string[]> {
  await exigerSession();
  const def = obtenirReseau(reseau);
  const r = validerFamille(reseau, Array.isArray(saisie) ? saisie.map(String) : []);
  if (!r.ok) throw new ErreurStudio("HASHTAG_REFUSE", r.message);
  const actuelles = await lireParametre<FamillesHashtags>(CLE, {});
  await ecrireParametre(CLE, { ...actuelles, [reseau]: r.liste });
  await journaliser("publication", r.liste.length ? `Vos hashtags ${def.nom} : ${r.liste.join(" ")}` : `Vos hashtags ${def.nom} : libres`);
  return r.liste;
}

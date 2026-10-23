/**
 * LOT R7e — « Votre avatar parle dans le studio » (Réglages › Connexions › Double). Décision de Will du 03/10 (« oui pour
 * le A ») : il crée son avatar dans l'application HeyGen ; le studio le fait parler, sur un texte validé, avec sa voix
 * clonée HeyGen (payant, porte-monnaie de l'API). ÉTEINT PAR DÉFAUT : seul Will l'allume, ici, d'un geste consigné au
 * journal. Le réglage est figé dans chaque commande au lancement et relu par le fournisseur avant chaque envoi.
 */
import { CENTIMES_USD_PAR_SECONDE_AVATAR_V, LOOKS_HEYGEN_PAR_LE_STUDIO, RENDU_DOUBLE_PAR_DEFAUT, type ReglageRenduDouble } from "@/fournisseurs/heygen/rendus";
import { centimes, TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import type { Montant } from "@/domaine/types";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";

const CLE = "double.rendu";

/** Le réglage tel qu'enregistré (toute valeur inattendue = éteint, sans fond). */
export async function lireRenduDouble(): Promise<ReglageRenduDouble> {
  const v = await lireParametre<Partial<ReglageRenduDouble> | null>(CLE, null);
  return { allume: v?.allume === true, fond: v?.fond === "uni" ? "uni" : RENDU_DOUBLE_PAR_DEFAUT.fond };
}

/** Lu par le fournisseur juste avant chaque envoi payant (`inscription.ts`). */
export async function renduDoubleAllume(): Promise<boolean> {
  return (await lireRenduDouble()).allume;
}

export async function definirRenduDouble(r: Partial<ReglageRenduDouble>): Promise<ReglageRenduDouble> {
  await exigerSession();
  if (r.allume !== undefined && typeof r.allume !== "boolean") throw new ErreurStudio("REGLAGE_INVALIDE", "Ce réglage n'est pas valable.");
  if (r.fond !== undefined && r.fond !== "sans-fond" && r.fond !== "uni") throw new ErreurStudio("REGLAGE_INVALIDE", "Ce réglage n'est pas valable.");
  const avant = await lireRenduDouble();
  const apres: ReglageRenduDouble = { allume: r.allume ?? avant.allume, fond: r.fond ?? avant.fond };
  await ecrireParametre(CLE, apres);
  if (avant.allume !== apres.allume) await journaliser("connexion", apres.allume ? "Votre avatar parle dans le studio : allumé" : "Votre avatar parle dans le studio : éteint");
  if (avant.fond !== apres.fond) await journaliser("connexion", apres.fond === "uni" ? "Fond de votre avatar : fond uni" : "Fond de votre avatar : sans fond, posé sur vos décors");
  return apres;
}

/* --- Correcteur réel 2 (F1) : « Créer vos décors avec HeyGen » (looks par consigne), éteint par défaut --- */

const CLE_LOOKS = "double.looks";

/** Le studio peut-il créer des looks HeyGen (payants) ? Lu avant chaque création ; toute valeur inattendue = non. */
export async function looksStudioAllumes(): Promise<boolean> {
  const v = await lireParametre<{ allume?: boolean } | null>(CLE_LOOKS, null);
  return v?.allume === true || (v === null && LOOKS_HEYGEN_PAR_LE_STUDIO);
}

export async function definirLooksStudio(allume: boolean): Promise<boolean> {
  await exigerSession();
  if (typeof allume !== "boolean") throw new ErreurStudio("REGLAGE_INVALIDE", "Ce réglage n'est pas valable.");
  const avant = await looksStudioAllumes();
  await ecrireParametre(CLE_LOOKS, { allume });
  if (avant !== allume) await journaliser("connexion", allume ? "Créer vos décors avec HeyGen : allumé" : "Créer vos décors avec HeyGen : éteint");
  return allume;
}

/** Ce que montre Réglages › Connexions › Double : le réglage et le prix d'une minute (taux du studio). */
export async function vueRenduDouble(): Promise<ReglageRenduDouble & { prixMinute: Montant; looks: boolean }> {
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  return { ...(await lireRenduDouble()), prixMinute: centimes(CENTIMES_USD_PAR_SECONDE_AVATAR_V * 60 * taux), looks: await looksStudioAllumes() };
}

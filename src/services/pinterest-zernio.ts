/**
 * Pinterest par Zernio : interrupteur `zernio.pinterest_actif` (FERMÉ par défaut : seul le booléen `true` ouvre), lu et écrit
 * depuis Réglages › Pinterest, comme YouTube Shorts. Aucun appel au diffuseur. Le tour général du calendrier est ouvert
 * (constante `PINTEREST_TOUR_GENERAL`) : l'interrupteur reste la seule protection, fermé = aucune épingle ne part.
 */
import "server-only";
import { PINTEREST_TOUR_GENERAL } from "@/domaine/reseaux-visuel-envoi";
import { BASE_PUBLIQUE } from "@/domaine/site-videos/contrat";
import { etatComptePinterest, type VuePinterest } from "@/domaine/chaine-pinterest";
import { CLE_PINTEREST_ACTIF } from "@/fournisseurs/publication/zernio";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { canauxZernioEnregistres } from "./comptes-envoi-zernio";

/** Seul `true` ouvre ; lecture en panne : fermé. */
export async function pinterestZernioActif(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(CLE_PINTEREST_ACTIF, false)) === true;
  } catch {
    return false;
  }
}

async function domaineDuSite(): Promise<string> {
  try {
    const v = await lireParametre<unknown>("site.domaine", new URL(BASE_PUBLIQUE).host);
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

/** Ouvre ou ferme l'envoi Pinterest. Fermer est toujours possible. Ouvrir exige un compte Pinterest relié (dernier « Tester ») et un domaine du site. */
export async function definirPinterestActif(allume: boolean): Promise<void> {
  await exigerSession();
  if (allume === true) {
    const compte = await canauxZernioEnregistres().then(etatComptePinterest, () => etatComptePinterest(null));
    if (compte.etat !== "relie") {
      const raison = compte.etat === "absent" ? "aucun tableau Pinterest n'est relié" : compte.etat === "deconnecte" ? "le compte Pinterest est déconnecté" : "l'état du compte Pinterest n'est pas connu (utilisez « Tester » dans « Vos comptes de publication »)";
      throw new ErreurStudio("PINTEREST_COMPTE", `Pinterest : impossible d'ouvrir, ${raison} : rien n'a été ouvert.`);
    }
    if (!(await domaineDuSite())) throw new ErreurStudio("PINTEREST_DOMAINE", "Pinterest : le domaine du site est vide, aucun lien d'épingle ne serait accepté : rien n'a été ouvert.");
  }
  await ecrireParametre(CLE_PINTEREST_ACTIF, allume === true);
  await journaliser("reglages", `Pinterest : envoi ${allume === true ? "ouvert" : "fermé"}`);
}

/** Ce que la carte Réglages affiche : tout est lu en base (aucun appel réseau). Lecture en panne : fermé, inconnu. */
export async function vuePinterestZernio(): Promise<VuePinterest> {
  const compte = await canauxZernioEnregistres().then(etatComptePinterest, () => etatComptePinterest(null));
  return { actif: await pinterestZernioActif(), compte, domaine: await domaineDuSite(), tourGeneral: PINTEREST_TOUR_GENERAL };
}

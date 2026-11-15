/**
 * YouTube Shorts par Zernio (lot B) : interrupteur et réglages, lus en base. Rien ne part tant que l'interrupteur
 * `zernio.youtube_actif` n'est pas le booléen `true` ET que les réglages `zernio.youtube_reglages` ne sont pas enregistrés.
 * Aucun écran dans ce lot : les propositions (`PROPOSITION_YOUTUBE`) sont ré-exportées pour un écran futur, jamais lues ici.
 */
import "server-only";
import { CLE_REGLAGES_YOUTUBE, CLE_YOUTUBE_ACTIF, lireReglagesYoutube, PROPOSITION_YOUTUBE, youtubeActifBrut, type ReglagesYoutube } from "@/fournisseurs/publication/zernio-youtube";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { etatChaineYoutube, type VueYoutube } from "@/domaine/chaine-youtube";
import { comptesZernioEnregistres } from "./zernio";

export { PROPOSITION_YOUTUBE };

/** L'envoi des YouTube Shorts est-il allumé ? Seul `true` allume ; lecture en panne : faux. */
export async function youtubeZernioActif(): Promise<boolean> {
  try {
    return youtubeActifBrut(await lireParametre<unknown>(CLE_YOUTUBE_ACTIF, false));
  } catch {
    return false;
  }
}

/** Réglages enregistrés, ou `null` (absents, invalides, lecture en panne). Jamais complétés par les propositions. */
export async function reglagesYoutubeEnBase(): Promise<ReglagesYoutube | null> {
  try {
    return lireReglagesYoutube(await lireParametre<unknown>(CLE_REGLAGES_YOUTUBE, null));
  } catch {
    return null;
  }
}

/** Porte du service : refus net AVANT toute réservation d'envoi. */
export async function exigerYoutubeZernioPret(): Promise<void> {
  if (!(await youtubeZernioActif())) throw new ErreurStudio("YOUTUBE_ETEINT", "YouTube Shorts : l'envoi est éteint (réglage à allumer) : rien n'est parti.");
  if (!(await reglagesYoutubeEnBase())) throw new ErreurStudio("YOUTUBE_REGLAGES", "YouTube : choisissez d'abord la visibilité, la catégorie et les mentions : rien n'est parti.");
}

/** Enregistre les réglages choisis par le fondateur (valeurs exactes, sinon refus et rien d'écrit). */
export async function definirReglagesYoutube(r: unknown): Promise<void> {
  await exigerSession();
  const lus = lireReglagesYoutube(r);
  if (!lus) throw new ErreurStudio("REGLAGES_INVALIDES", "Les réglages YouTube sont incomplets ou invalides : rien n'a été enregistré.");
  await ecrireParametre(CLE_REGLAGES_YOUTUBE, lus);
  await journaliser("reglages", `Réglages YouTube choisis par le fondateur : visibilité ${lus.visibilite}, catégorie ${lus.categorieId}, synthétique ${lus.synthetique}, enfants ${lus.pourEnfants ? "oui" : "non"}, titre ${lus.titre}`);
}

/**
 * Allume ou éteint l'envoi. Éteindre est toujours possible. Allumer exige, côté serveur : des réglages valides enregistrés,
 * une chaîne YouTube « reliée » (au moins une chaîne active dans les comptes enregistrés), et, si la visibilité enregistrée
 * est « public », une confirmation explicite (`confirmerPublic === true`).
 */
export async function definirYoutubeActif(allume: boolean, confirmerPublic: boolean = false): Promise<void> {
  await exigerSession();
  if (allume === true) {
    const reglages = await reglagesYoutubeEnBase();
    if (!reglages) throw new ErreurStudio("YOUTUBE_REGLAGES", "YouTube : choisissez d'abord la visibilité, la catégorie et les mentions : rien n'a été allumé.");
    const chaine = await comptesZernioEnregistres().then(etatChaineYoutube, () => etatChaineYoutube(null));
    if (chaine.etat !== "relie") {
      const raison = chaine.etat === "absent" ? "aucune chaîne YouTube n'est reliée" : chaine.etat === "deconnecte" ? "la chaîne YouTube est déconnectée" : "l'état de la chaîne YouTube n'est pas connu (utilisez « Tester » dans « Vos comptes de publication »)";
      throw new ErreurStudio("YOUTUBE_CHAINE", `YouTube : impossible d'allumer, ${raison} : rien n'a été allumé.`);
    }
    if (reglages.visibilite === "public" && confirmerPublic !== true) throw new ErreurStudio("YOUTUBE_PUBLIC", "YouTube : la visibilité enregistrée est « public » ; confirmez que les prochains Shorts seront publics tout de suite : rien n'a été allumé.");
  }
  await ecrireParametre(CLE_YOUTUBE_ACTIF, allume === true);
  await journaliser("reglages", `YouTube Shorts : envoi ${allume === true ? "allumé" : "éteint"}`);
}

/** Ce que la carte Réglages affiche : tout est lu en base (aucun appel réseau). Lecture en panne : éteint, rien, inconnu. */
export async function vueYoutubeZernio(): Promise<VueYoutube> {
  const chaine = await comptesZernioEnregistres().then(etatChaineYoutube, () => etatChaineYoutube(null));
  return { actif: await youtubeZernioActif(), reglages: await reglagesYoutubeEnBase(), chaine };
}

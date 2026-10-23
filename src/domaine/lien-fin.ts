/**
 * LIEN D'UNE FIN « RENDEZ-VOUS » (L2-10, ADR 0002 de l'Usine). La base 7 ne porte qu'un GABARIT de lien (la page visée) ;
 * le lien réel se résout à la fabrication de chaque version, avec le code de la vidéo, par le constructeur unique
 * (`construireLienSuivi`). Jamais de lien écrit à la main, jamais le repère « en-tête du site » pour une vidéo.
 *
 * Interprétation à confirmer par Will (consigne L2-10) : le lien COMPLET va en description ou en premier commentaire ;
 * l'écran n'affiche que la forme courte (`court`, sans requête).
 */
import type { AppelBanque } from "@/briques/fins/banque";
import type { ReseauFin } from "@/briques/fins/types";
import { PAGES_LIEN, construireLienSuivi, type ActiviteLien } from "./mesures";

export interface LienDeFin {
  /** Lien suivi complet, tel que le construit `construireLienSuivi`. */
  complet: string;
  /** Forme courte pour l'écran : domaine et page, sans paramètre. */
  court: string;
}

const HOTE = "axion-ia.com";

/**
 * Lien de la fin `appel` pour une version de vidéo, ou `null` si la ligne de la base n'en porte pas. Refuse (erreur) un
 * réseau que la ligne ne couvre pas, un gabarit hors du site ou d'une page non permise, et un code de version absent ou
 * invalide (le code doit exister avant la composition du texte de fin).
 */
export function lienDeFin(appel: AppelBanque, version: { reseau: ReseauFin; codeVersion: string | undefined; activite: ActiviteLien }): LienDeFin | null {
  if (appel.lien === "") return null;
  if (!appel.reseaux.includes(version.reseau)) throw new Error(`La fin « ${appel.code} » ne couvre pas le réseau ${version.reseau}.`);
  if (!version.codeVersion) throw new Error(`Le code de version est introuvable : le lien de la fin « ${appel.code} » ne peut pas être posé.`);
  let page: string;
  try {
    const u = new URL(appel.lien);
    if (u.protocol !== "https:" || u.hostname !== HOTE) throw new Error("hôte");
    page = u.pathname.replace(/\/+$/, "");
  } catch {
    throw new Error(`Le gabarit de lien de la fin « ${appel.code} » n'est pas une page de ${HOTE}.`);
  }
  if (!(PAGES_LIEN as readonly string[]).includes(page)) throw new Error(`Page non permise pour la fin « ${appel.code} » : « ${page} ».`);
  const complet = construireLienSuivi({ typeLien: "video", reseau: version.reseau, code: version.codeVersion, activite: version.activite, page });
  return { complet, court: `${HOTE}${page}` };
}

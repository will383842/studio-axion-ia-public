/**
 * LIENS DU PROFIL SUIVIS PAR RÉSEAU (L8-14). PUR : aucun réseau, aucune écriture vers un réseau.
 *
 * Un lien suivi par compte et par réseau, de nature « profil », à coller À LA MAIN dans « lien dans mon profil ».
 * Le lien vient de l'unique constructeur (`construireLienSuivi`) : aucun second constructeur ici. Le code est
 * `mot-<compte>-<réseau>` : unique par compte et par réseau, lu ensuite au tableau de bord.
 */
import { ErreurLienSuivi, construireLienSuivi, type ActiviteLien, type EntreeLienSuivi } from "./mesures";

export const RESEAUX_LIEN_PROFIL = ["linkedin", "instagram", "facebook", "tiktok", "youtube"] as const;
export type ReseauLienProfil = (typeof RESEAUX_LIEN_PROFIL)[number];

export interface EntreeLienProfil {
  /** Identifiant court du compte (lettres, chiffres, tirets). */
  compte: string;
  reseau: string;
  activite: ActiviteLien | string;
  page: string;
}

/** Code unique par compte et par réseau, ramené en minuscules. Un compte vide ou illisible est refusé. */
export function codeLienProfil(compte: string, reseau: string): string {
  const c = compte.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(c)) throw new ErreurLienSuivi("caractere_interdit", "Le compte ne contient que des lettres, des chiffres et des tirets.");
  return `mot-${c}-${reseau.trim().toLowerCase()}`;
}

export function lienProfil(e: EntreeLienProfil): string {
  const entree: EntreeLienSuivi = { typeLien: "profil", reseau: e.reseau, code: codeLienProfil(e.compte, e.reseau), activite: e.activite, page: e.page };
  return construireLienSuivi(entree);
}

export interface LienProfilReseau {
  reseau: ReseauLienProfil;
  code: string;
  lien: string;
}

/** Un lien par réseau pour un compte, dans l'ordre fixe de `RESEAUX_LIEN_PROFIL`. */
export function liensProfilParReseau(e: Omit<EntreeLienProfil, "reseau">): LienProfilReseau[] {
  return RESEAUX_LIEN_PROFIL.map((reseau) => ({ reseau, code: codeLienProfil(e.compte, reseau), lien: lienProfil({ ...e, reseau }) }));
}

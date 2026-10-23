/**
 * TEST-UI-REEL U1 (CORRECTEUR FINAL A) : le personnage « Moi » de Will. Le personnage d'EXEMPLE (« p-will »,
 * `estDemo`) n'est jamais « vous » : il ne bloque pas la création du vrai « Moi » et passe toujours après lui. Pur.
 */
import type { Personnage } from "./types";

/** Le vrai « Moi » de Will (jamais un personnage d'exemple). */
export function estMoiReel(p: Pick<Personnage, "nature" | "estDemo">): boolean {
  return p.nature === "moi" && !p.estDemo;
}

/**
 * « Moi » parmi une liste : le vrai d'abord (le principal en tête), sinon, seulement si les exemples sont affichés,
 * celui d'exemple (vidéos d'exemple, découverte du studio). Exemples masqués : jamais celui d'exemple.
 */
export function choisirMoi<T>(liste: T[], personnage: (x: T) => Pick<Personnage, "nature" | "estDemo" | "principal">, exemplesAffiches: boolean): T | undefined {
  const moi = liste.filter((x) => personnage(x).nature === "moi" && (exemplesAffiches || !personnage(x).estDemo));
  return moi.sort((a, b) => Number(!!personnage(a).estDemo) - Number(!!personnage(b).estDemo) || Number(personnage(b).principal) - Number(personnage(a).principal))[0];
}

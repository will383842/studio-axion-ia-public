/**
 * Données du calque « récit » (lot REC) : la forme que pose l'axe moteur `src/moteurs/montage-image-video/variete/axes/
 * recit.ts` dans `variete.donnees.recit` (recopiée ici : une composition n'importe jamais `src/moteurs/**` ; un test
 * vérifie que `lireDonneesRecit` accepte ce que l'axe produit). Heures en secondes, relatives au début du bloc.
 * PUR : aucun JSX, aucun calcul au chargement.
 */

export type FondRecit = { t: number; fond: "sombre" | "ivoire" };
export interface CarteAppointRecit {
  icone: string;
  couleur: "orange" | "noir" | "vert";
  coche: boolean;
}

export type DonneesRecit = { fonds: FondRecit[] } & (
  | { code: "REC-B"; role: "resultat"; appoint: CarteAppointRecit[] }
  | { code: "REC-B"; role: "comment"; resultat: string; jusqua: number; appoint: CarteAppointRecit[] }
  | { code: "REC-C"; role: "suivi"; libelle: string | null; depart: string; noeuds: string[]; reponse: number | null; masques: { debut: number; fin: number }[] }
  | { code: "REC-D"; role: "etapes"; changements: { t: number; numero: number }[]; total: number; etapes: CarteAppointRecit[]; place: "toile" | "haut"; masques: { debut: number; fin: number }[] }
);

const ROLES: Record<string, string> = { "REC-B": "resultat|comment", "REC-C": "suivi", "REC-D": "etapes" };

/** Lit les données du récit d'un bloc ; `null` si absentes ou d'une autre forme (le calque rend alors son contenu tel quel). */
export function lireDonneesRecit(x: unknown): DonneesRecit | null {
  if (!x || typeof x !== "object") return null;
  const d = x as { code?: unknown; role?: unknown; fonds?: unknown };
  if (typeof d.code !== "string" || typeof d.role !== "string" || !Array.isArray(d.fonds)) return null;
  return (ROLES[d.code] ?? "").split("|").includes(d.role) ? (x as DonneesRecit) : null;
}

/** Fond de la scène à l'instant `t`. */
export function fondA(fonds: readonly FondRecit[], t: number): FondRecit["fond"] {
  let f: FondRecit["fond"] = fonds[0]?.fond ?? "ivoire";
  for (const x of fonds) if (t >= x.t) f = x.fond;
  return f;
}

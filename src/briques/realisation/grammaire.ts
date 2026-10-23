/**
 * GRAMMAIRE DE MONTAGE (plan facecam v4 n° 19) — constante du code. PURE.
 *
 * Elle s'impose à la réalisation automatique, aux cartes sur mesure et à l'agent monteur : toute proposition passe
 * par `verifierGrammaire`, qui rend la liste des écarts (vide = conforme).
 */

export const GRAMMAIRE_MONTAGE = {
  /** Part minimale des raccords en coupe franche (le punch-in instantané en est une). */
  coupeFranchePctMin: 90,
  /** Le punch-in est instantané : aucune durée de transition. */
  punchInImages: 0,
  /** Zoom flou : 2 au plus par vidéo. */
  zoomFlouMaxParVideo: 2,
  /** Entrée de l'écran partagé : 8 à 10 images, avec une courbe unique. */
  entreeEcranPartageImages: [8, 10] as [number, number],
  courbeUnique: "cubic-bezier(0.22, 1, 0.36, 1)",
  /** Jamais de fondu sur le visage. */
  fonduSurVisage: false,
  /** Zoom lent : 3 % de taille par seconde au plus. */
  zoomLentPctParSecMax: 3,
  /** Écart de taille minimal entre deux plans de part et d'autre d'une coupe de nettoyage (v4 n° 18). */
  ecartTaillePctMin: 12,
  /** Même cadre de part et d'autre d'une coupe : toléré une fois sur 4, si la tête bouge de moins de 3 %. */
  memeCadreUneFoisSur: 4,
  memeCadreMouvementTetePctMax: 3,
  imagesParSec: 25,
} as const;

export type TypeRaccord = "franche" | "punch-in" | "zoom-flou" | "fondu" | "entree-ecran-partage";

export interface Raccord {
  /** Instant du raccord (temps du montage). */
  tSec: number;
  type: TypeRaccord;
  /** Durée de la transition, en images (entrée d'écran partagé, fondu). */
  dureeImages?: number;
  courbe?: string;
  /** Le raccord touche le visage de Will (fondu interdit). */
  surVisage?: boolean;
}

/** Zoom lent continu sur un plan (taille en %). */
export interface MouvementCamera {
  debutSec: number;
  finSec: number;
  deTaillePct: number;
  aTaillePct: number;
}

export interface EcartGrammaire {
  code: "coupes-franches" | "zoom-flou" | "entree-ecran-partage" | "fondu-visage" | "zoom-lent" | "ecart-taille";
  message: string;
  tSec?: number;
}

/** Écart relatif entre deux tailles de plan, en % de la plus petite (100 → 115 : 15 % ; 115 → 130 : 13 %). */
export function ecartTaillePct(a: number, b: number): number {
  return (Math.abs(a - b) / Math.min(a, b)) * 100;
}

export function verifierGrammaire(p: { raccords: Raccord[]; mouvements?: MouvementCamera[] }): EcartGrammaire[] {
  const g = GRAMMAIRE_MONTAGE;
  const ecarts: EcartGrammaire[] = [];
  const raccords = p.raccords;
  if (raccords.length) {
    const francs = raccords.filter((r) => r.type === "franche" || r.type === "punch-in").length;
    const pct = (francs / raccords.length) * 100;
    if (pct < g.coupeFranchePctMin) ecarts.push({ code: "coupes-franches", message: `Coupes franches : ${Math.round(pct)} % des raccords (au moins ${g.coupeFranchePctMin} %).` });
  }
  const flous = raccords.filter((r) => r.type === "zoom-flou");
  if (flous.length > g.zoomFlouMaxParVideo) ecarts.push({ code: "zoom-flou", message: `${flous.length} zooms flous (${g.zoomFlouMaxParVideo} au plus par vidéo).`, tSec: flous[g.zoomFlouMaxParVideo].tSec });
  for (const r of raccords) {
    if (r.type === "entree-ecran-partage") {
      const [min, max] = g.entreeEcranPartageImages;
      if (r.dureeImages === undefined || r.dureeImages < min || r.dureeImages > max || (r.courbe !== undefined && r.courbe !== g.courbeUnique)) {
        ecarts.push({ code: "entree-ecran-partage", message: `Entrée d'écran partagé en ${min} à ${max} images, courbe unique.`, tSec: r.tSec });
      }
    }
    if (r.type === "fondu" && r.surVisage) ecarts.push({ code: "fondu-visage", message: "Jamais de fondu sur le visage.", tSec: r.tSec });
  }
  for (const m of p.mouvements ?? []) {
    const duree = m.finSec - m.debutSec;
    const vitesse = duree > 0 ? Math.abs(m.aTaillePct - m.deTaillePct) / duree : Infinity;
    if (vitesse > g.zoomLentPctParSecMax + 1e-9) ecarts.push({ code: "zoom-lent", message: `Zoom lent à ${vitesse.toFixed(1)} %/s (${g.zoomLentPctParSecMax} %/s au plus).`, tSec: m.debutSec });
  }
  return ecarts;
}

/**
 * CADRAGE PAR FORMAT (lot F1). PUR. Chaque plan du montage 9:16 (brique `realisation` : bornes, taille 100 / 115 /
 * 130 %, ouverture) reçoit, pour chaque déclinaison, SA fenêtre dans la source 4K, recalculée depuis la piste du
 * visage (médiane du visage sur le plan, comme le 9:16 : cadre fixe, jamais de suivi qui flotte) :
 *  - même taille de plan et mêmes bornes que le 9:16 (les coupes et les punch-ins tombent aux mêmes images) ;
 *  - yeux à 30-38 % de la hauteur de l'image (34 % visé) ; quand la source ne le permet pas à cette taille (16:9 :
 *    la fenêtre est presque toute la source), la fenêtre se resserre juste assez, sans jamais agrandir l'image
 *    au-delà de ce que le 9:16 s'autorise ;
 *  - visage centré en largeur, borné à la source ;
 *  - jamais dans les 4 % du bord de la source (bord de la vitre du téléprompteur, coins assombris) ;
 *  - un visage qui a bougé de moins de 3 % garde le cadre précédent de la même taille (zone morte du 9:16).
 * La bande de la passe image (une seule passe 10 bits, partagée par tous les formats) couvre l'union des fenêtres.
 */
import { echantillonsEntre, mediane, YEUX_HAUTEUR, type CadreSource, type PisteVisage, type PlanCamera } from "@/briques/realisation";
import { DIMENSIONS_FACECAM, rapportRatio, type RatioFacecam } from "./ratios";

export const CADRAGE_FORMATS = {
  yeux: YEUX_HAUTEUR,
  /** Part de la source jamais montrée, sur chaque bord (vitre du téléprompteur). */
  margeVitre: 0.04,
  /** Agrandissement le plus fort accepté (fenêtre plus petite que la sortie) : celui du 9:16 serré (2160 / 1.3 → 1920). */
  agrandissementMax: 1.16,
  /** Zone morte : un visage qui a bougé de moins de 3 % garde le cadre précédent de la même taille. */
  zoneMorte: 0.03,
  /** Visage supposé quand la piste manque : hauteur de l'ovale ≈ 27 % de la hauteur de la source. */
  hauteurVisageParDefaut: 0.27,
  /** Bouche et menton sous les yeux, en part de la hauteur de l'ovale (moyennes MediaPipe). */
  boucheSousYeux: 0.36,
  mentonSousYeux: 0.58,
  frontAuDessusDesYeux: 0.42,
} as const;

/** Visage dans la source (0-1) : yeux et ovale. */
export interface VisageSource {
  yeuxX: number;
  yeuxY: number;
  /** Ovale : x, y, largeur, hauteur (0-1 de la source). */
  boite: [number, number, number, number];
}

/** Un plan du montage dans une déclinaison : la fenêtre recalculée et où tombe le visage dans l'image finale (0-1). */
export interface PlanFormat extends PlanCamera {
  ratio: RatioFacecam;
  /** Yeux dans l'image finale (0-1). */
  yeuxLargeur: number;
  /** Ovale du visage dans l'image finale (0-1) : x, y, largeur, hauteur. */
  visage: [number, number, number, number];
  /** Agrandissement de l'image (> 1 : la fenêtre est plus petite que la sortie). */
  agrandissement: number;
}

const pair = (x: number) => 2 * Math.round(x / 2);
const borne = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
const arrondi = (x: number, n = 3) => +x.toFixed(n);

/** Partie de la source utilisable (sans le bord de la vitre), en px. */
export function sourceUtile(source: { largeur: number; hauteur: number }, marge: number = CADRAGE_FORMATS.margeVitre): CadreSource {
  const x = pair(source.largeur * marge);
  const y = pair(source.hauteur * marge);
  return { x, y, largeur: source.largeur - 2 * x, hauteur: source.hauteur - 2 * y };
}

/** Visage d'un plan : médiane de la piste sur le plan ; sans piste, déduit du cadre 9:16 (yeux et ovale supposé). */
export function visageDuPlan(plan: PlanCamera, source: { largeur: number; hauteur: number }, piste?: PisteVisage | null): VisageSource {
  const ech = piste ? echantillonsEntre(piste, plan.priseDebutSec, plan.priseFinSec) : [];
  if (ech.length) {
    const b = [0, 1, 2, 3].map((i) => mediane(ech.map((e) => e.boite[i]))) as [number, number, number, number];
    return { yeuxX: mediane(ech.map((e) => e.yeuxX)), yeuxY: mediane(ech.map((e) => e.yeuxY)), boite: b };
  }
  const yeuxX = (plan.cadre.x + plan.cadre.largeur / 2) / source.largeur;
  const yeuxY = (plan.cadre.y + plan.yeuxHauteur * plan.cadre.hauteur) / source.hauteur;
  return visageSuppose(yeuxX, yeuxY, source);
}

/** Ovale supposé autour des yeux (piste absente). */
export function visageSuppose(yeuxX: number, yeuxY: number, source: { largeur: number; hauteur: number }): VisageSource {
  const h = CADRAGE_FORMATS.hauteurVisageParDefaut;
  const l = (h * 0.76 * source.hauteur) / source.largeur;
  return { yeuxX, yeuxY, boite: [yeuxX - l / 2, yeuxY - CADRAGE_FORMATS.frontAuDessusDesYeux * h, l, h] };
}

/**
 * Fenêtre d'un format pour une taille de plan et un visage : yeux à 34 % visés (30-38 % admis), centrés en largeur,
 * dans la source utile ; resserrée juste assez quand la source ne permet pas les yeux dans la bande.
 */
export function fenetreFormat(ratio: RatioFacecam, taille: number, visage: Pick<VisageSource, "yeuxX" | "yeuxY">, source: { largeur: number; hauteur: number }): { cadre: CadreSource; yeuxHauteur: number; agrandissement: number } {
  const utile = sourceUtile(source);
  const r = rapportRatio(ratio);
  const sortie = DIMENSIONS_FACECAM[ratio];
  const base = utile.largeur / utile.hauteur > r ? { largeur: utile.hauteur * r, hauteur: utile.hauteur } : { largeur: utile.largeur, hauteur: utile.largeur / r };
  const eX = visage.yeuxX * source.largeur;
  const eY = visage.yeuxY * source.hauteur;
  const hauteurMin = sortie.hauteur / CADRAGE_FORMATS.agrandissementMax;
  const { min, vise, max } = CADRAGE_FORMATS.yeux;
  let resserre = 1;
  let meilleur: { cadre: CadreSource; yeuxHauteur: number; agrandissement: number } | null = null;
  const cible = hauteurDeTaille(base.hauteur, taille, hauteurMin);
  for (let essai = 0; essai < 200; essai++) {
    const plancher = Math.min(cible, hauteurMin);
    const hauteur = Math.max(plancher, cible / resserre);
    const largeur = hauteur * r;
    const x = borne(eX - largeur / 2, utile.x, utile.x + utile.largeur - largeur);
    const y = borne(eY - vise * hauteur, utile.y, utile.y + utile.hauteur - hauteur);
    const cadre = { x: pair(x), y: pair(y), largeur: pair(largeur), hauteur: pair(hauteur) };
    const yeuxHauteur = arrondi((eY - cadre.y) / cadre.hauteur);
    const candidat = { cadre, yeuxHauteur, agrandissement: arrondi(sortie.hauteur / cadre.hauteur) };
    // Le plus proche de 34 % (le premier trouvé dans la bande gagne : resserrer le moins possible).
    if (!meilleur || Math.abs(yeuxHauteur - vise) < Math.abs(meilleur.yeuxHauteur - vise)) meilleur = candidat;
    if (yeuxHauteur >= min - 1e-3 && yeuxHauteur <= max + 1e-3) return candidat;
    if (hauteur <= plancher + 1e-6) break;
    resserre += 0.01;
  }
  return meilleur!;
}

/** Écart gardé entre deux tailles voisines (grammaire : ≥ 12 % à chaque changement de taille), avec la marge des pixels pairs. */
const ECART_TAILLES = 1.125;

/**
 * Hauteur de la fenêtre d'une taille de plan (100 / 115 / 130 %) : la plus grande fenêtre du format divisée par la
 * taille, jamais sous le plancher d'agrandissement… sauf s'il effaçait l'écart avec la taille voisine (Vérif V2,
 * 10/10 : prise portrait d'iPhone → en 16:9, 100 = 115 = 130 % ; en 4:5 et 1:1, 6,5 % : chaque coupe était une
 * saute). L'écart de la grammaire passe alors avant le plancher, comme le 9:16 qui s'agrandit lui aussi sur une telle
 * source. Source 4K paysage : rien ne change (le plancher n'y mord jamais).
 */
export function hauteurDeTaille(base: number, taille: number, hauteurMin: number): number {
  if (taille <= 100) return base;
  const h115 = Math.min(Math.max(hauteurMin, base / 1.15), base / ECART_TAILLES);
  if (taille <= 115) return h115;
  return Math.min(Math.max(hauteurMin, base / (taille / 100)), h115 / ECART_TAILLES);
}

/** Ovale du visage dans l'image finale (0-1) d'après la fenêtre. */
function visageDansImage(v: VisageSource, cadre: CadreSource, source: { largeur: number; hauteur: number }): { yeuxLargeur: number; visage: [number, number, number, number] } {
  const fx = (x: number) => (x * source.largeur - cadre.x) / cadre.largeur;
  const fy = (y: number) => (y * source.hauteur - cadre.y) / cadre.hauteur;
  return {
    yeuxLargeur: arrondi(fx(v.yeuxX)),
    visage: [arrondi(fx(v.boite[0])), arrondi(fy(v.boite[1])), arrondi((v.boite[2] * source.largeur) / cadre.largeur), arrondi((v.boite[3] * source.hauteur) / cadre.hauteur)],
  };
}

/**
 * Plans d'une déclinaison, depuis les plans du 9:16 : mêmes bornes, mêmes tailles, mêmes ouvertures ; fenêtre et
 * visage recalculés pour le format. Le 9:16 n'est jamais recalculé ici (ses plans font foi).
 */
export function plansDuFormat(ratio: RatioFacecam, plans916: PlanCamera[], source: { largeur: number; hauteur: number }, piste?: PisteVisage | null): PlanFormat[] {
  const derniers = new Map<number, VisageSource>();
  return plans916.map((p) => {
    let v = visageDuPlan(p, source, piste);
    const dernier = derniers.get(p.taille);
    if (dernier && Math.abs(dernier.yeuxX - v.yeuxX) < CADRAGE_FORMATS.zoneMorte && Math.abs(dernier.yeuxY - v.yeuxY) < CADRAGE_FORMATS.zoneMorte) v = dernier;
    else derniers.set(p.taille, v);
    const f = fenetreFormat(ratio, p.taille, v, source);
    return { ...p, ratio, cadre: f.cadre, yeuxHauteur: f.yeuxHauteur, agrandissement: f.agrandissement, ...visageDansImage(v, f.cadre, source) };
  });
}

/** Bande de la passe image (colonne de la source) couvrant toutes ces fenêtres, avec une marge, en pixels pairs. */
export function bandeDesFenetres(cadres: CadreSource[], source: { largeur: number; hauteur: number }, marge = 32): { x: number; largeur: number } | null {
  if (!cadres.length) return null;
  const x0 = Math.max(0, Math.min(...cadres.map((c) => c.x)) - marge);
  const x1 = Math.min(source.largeur, Math.max(...cadres.map((c) => c.x + c.largeur)) + marge);
  const x = 2 * Math.floor(x0 / 2);
  return { x, largeur: 2 * Math.floor((x1 - x) / 2) };
}

/** La bande d'une passe déjà faite couvre-t-elle ces fenêtres ? (sinon, une passe élargie, UNE fois pour tous). */
export function bandeCouvre(bande: { x: number; largeur: number } | undefined, cadres: CadreSource[]): boolean {
  if (!bande) return false;
  return cadres.every((c) => c.x >= bande.x && c.x + c.largeur <= bande.x + bande.largeur);
}

/** Les plans en pixels de l'image finale : yeux (px) et ovale (px), pour l'habillage et le contrôle. */
export function visagePx(p: Pick<PlanFormat, "ratio" | "yeuxLargeur" | "yeuxHauteur" | "visage">): { yeuxX: number; yeuxY: number; x: number; y: number; largeur: number; hauteur: number } {
  const { largeur: W, hauteur: H } = DIMENSIONS_FACECAM[p.ratio];
  return { yeuxX: p.yeuxLargeur * W, yeuxY: p.yeuxHauteur * H, x: p.visage[0] * W, y: p.visage[1] * H, largeur: p.visage[2] * W, hauteur: p.visage[3] * H };
}

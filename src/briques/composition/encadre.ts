/**
 * ENCADRÉ DE TITRE et boîtes des sous-titres DESSINÉS — brique commune « composition » (née au lot M4, B.2).
 * PUR. L'encadré se place sous les sous-titres réellement dessinés (≥ `ecartSousSousTitresPx`), au-dessus de la zone
 * protégée du bas ; sa forme (taille, lignes, instants, largeur) vient de `EncadreOuverture` (format, profil de rendu
 * ou habillage). Police : Inter Bold, métriques réelles (`metriques-inter.ts`).
 */
import { estMotOutil } from "@/briques/sous-titres";
import { zoneDe } from "@/briques/sous-titres/largeur";
import { largeurElement, sceneAuTemps, type DonneesCalque, type ElementDessine } from "@/briques/sous-titres/scene";
import type { AlerteQualite, IdReseau } from "@/domaine/types";
import type { EncadreOuverture } from "@/formats/types";
import { CARACTERES_INTER, INTER_BOLD } from "./metriques-inter";
import { DIMENSIONS_SCENE, type BoitePx, type EncadreScene, type RatioScene } from "./scene";

/** Taille de référence des sous-titres (gabarit Karaoké, px à 1080) pour placer l'encadré dessous. */
export const TAILLE_SOUS_TITRES_REFERENCE_PX = 70;

const INDEX_INTER = new Map<string, number>();
for (let i = 0; i < CARACTERES_INTER.length; i++) if (!INDEX_INTER.has(CARACTERES_INTER[i])) INDEX_INTER.set(CARACTERES_INTER[i], i);

/** Largeur d'un texte en Inter Bold, en px (métriques réelles de la police). */
export function largeurInter(texte: string, taillePx: number): number {
  let total = 0;
  for (const ch of texte) total += INTER_BOLD.largeurs[INDEX_INTER.get(ch) ?? INDEX_INTER.get(ch.normalize("NFD")[0]) ?? INDEX_INTER.get("n")!];
  return (total / INTER_BOLD.unitesParEm) * taillePx;
}

/**
 * Équipe 7 : le thème (titre de série) tient-il sur SA ligne de l'encadré, à la plus petite taille (54 px à 1080) et
 * dans la largeur permise (70 % moins les marges) ? Sert à refuser un nom de série qui ne se lirait pas à l'écran.
 */
export function themeTientDansEncadre(theme: string, forme: Pick<EncadreOuverture, "largeurMaxPct" | "taillePx"> = { largeurMaxPct: 70, taillePx: [54, 58] }): boolean {
  const largeurMax = (forme.largeurMaxPct / 100) * 1080 - 2 * 36;
  return largeurInter(`${theme.replace(/\s+/g, " ").trim()} :`, forme.taillePx[0]) <= largeurMax;
}

/** Thème et accroche d'un titre « Thème : accroche » (sans deux-points : l'accroche seule). */
export function partiesTitre(texte: string): { theme?: string; accroche: string } {
  const propre = texte.replace(/ /g, " ").replace(/\s+/g, " ").trim();
  const i = propre.indexOf(":");
  if (i > 0 && i < propre.length - 1) return { theme: propre.slice(0, i).trim(), accroche: propre.slice(i + 1).trim() };
  return { accroche: propre };
}

/**
 * Coupe un texte en lignes qui tiennent dans `largeurMax` (mots entiers). Sur deux lignes, la coupe est ÉQUILIBRÉE
 * (la plus longue ligne la plus courte possible) et ne laisse jamais un mot outil (« le », « de »…) en fin de ligne.
 */
function couper(texte: string, taillePx: number, largeurMax: number): string[] {
  const mots = texte.split(" ").filter(Boolean);
  if (largeurInter(mots.join(" "), taillePx) <= largeurMax) return [mots.join(" ")];
  let meilleure: { lignes: string[]; score: number } | null = null;
  for (let i = 1; i < mots.length; i++) {
    const l1 = mots.slice(0, i).join(" ");
    const l2 = mots.slice(i).join(" ");
    const largeur = Math.max(largeurInter(l1, taillePx), largeurInter(l2, taillePx));
    if (largeur > largeurMax) continue;
    const score = largeur + (estMotOutil(mots[i - 1]) ? 10_000 : 0);
    if (!meilleure || score < meilleure.score) meilleure = { lignes: [l1, l2], score };
  }
  if (meilleure) return meilleure.lignes;
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (largeurInter(essai, taillePx) <= largeurMax || !courante) courante = essai;
    else {
      lignes.push(courante);
      courante = mot;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

/**
 * Encadré de 0 à 3 s (B.2) : cartouche blanc, Inter Bold 54-58 px, thème suivi de « : » puis l'accroche en
 * MAJUSCULES sur 2 lignes au plus (la ligne du thème en plus, comme la référence), largeur ≤ 70 %. Son haut est au moins 80 px sous les sous-titres, son bas au-dessus
 * de la limite basse des zones protégées ; s'il ne tient pas, la taille descend à 54 px puis l'encadré est signalé.
 */
export function placerEncadre(
  texte: string,
  ratio: RatioScene,
  reseaux: IdReseau[],
  options: {
    /** Forme de l'encadré (format, profil de rendu ou habillage ; la recette donne le défaut). */
    encadre: EncadreOuverture;
    sousTitresCentrePct?: number;
    tailleSousTitresPx?: number;
    /**
     * Bas RÉEL des sous-titres pendant l'encadré (px), mesuré sur les groupes dessinés (`basSousTitres`) : taille du
     * groupe (accent agrandi compris), contour, ombre, rebond et position du plan poitrine. Prime sur l'estimation
     * depuis `sousTitresCentrePct` et `tailleSousTitresPx`. Absent ou null (aucun sous-titre à ce moment) : estimation.
     */
    sousTitresBasPx?: number | null;
  },
): { encadre: EncadreScene; alertes: AlerteQualite[]; manquePx: number } {
  const e = options.encadre;
  const { largeur: W, hauteur: H } = DIMENSIONS_SCENE[ratio];
  const k = W / 1080;
  const alertes: AlerteQualite[] = [];
  const { theme, accroche } = partiesTitre(texte);
  const mots = (theme ? `${theme} ${accroche}` : accroche).split(" ").filter(Boolean).length;
  const caracteres = (theme ? `${theme} : ${accroche}` : accroche).length;
  if (mots > e.motsMax || caracteres > e.caracteresAlerte) {
    alertes.push({ code: "chevauchement", gravite: "info", message: `Le titre d'ouverture est long (${mots} mots, ${caracteres} caractères) : ${e.motsMax} mots et ${e.caracteresAlerte} caractères au plus se lisent en 3 s.` });
  }
  const margeX = 36 * k;
  const margeY = 26 * k;
  const largeurMax = (e.largeurMaxPct / 100) * W - 2 * margeX;
  const [tailleMin, tailleMax] = e.taillePx;
  const ACCROCHE = accroche.toLocaleUpperCase("fr-FR");
  let taille = tailleMax * k;
  let lignes: string[] = [];
  // Taille de départ (58), puis 54 ; au-delà, l'encadré est réduit pour tenir et signalé.
  // L'accroche tient sur `lignesMax` lignes, sous la ligne du thème (référence mesurée : « Contrôle Routier : » puis
  // « L'ERREUR QUE / TOUT LE MONDE FAIT », 3 lignes en tout).
  let lignesAccroche: string[] = [];
  for (const t of [tailleMax * k, tailleMin * k]) {
    taille = t;
    lignesAccroche = couper(ACCROCHE, t, largeurMax);
    lignes = theme ? [`${theme} :`, ...lignesAccroche] : lignesAccroche;
    if (lignesAccroche.length <= e.lignesMax && lignes.every((l) => largeurInter(l, t) <= largeurMax)) break;
  }
  if (lignesAccroche.length > e.lignesMax || lignes.some((l) => largeurInter(l, taille) > largeurMax)) {
    alertes.push({ code: "chevauchement", gravite: "attention", message: "Le titre d'ouverture ne tient pas dans l'encadré : raccourcissez-le." });
    const plusLarge = Math.max(...lignes.map((l) => largeurInter(l, taille)));
    if (plusLarge > largeurMax) taille = Math.floor((taille * largeurMax) / plusLarge);
  }
  const interligne = 1.18;
  // Sous les sous-titres (≥ 80 px), au-dessus de la limite basse de la zone protégée. Si la place manque, la taille
  // descend à 54 px (B.2) ; `manquePx` dit ce qui manque encore (le placement relève alors la ligne, `placerOuverture`).
  const zone = zoneDe(ratio, reseaux);
  const sousTitresBas = options.sousTitresBasPx ?? ((options.sousTitresCentrePct ?? 48) / 100) * H + ((options.tailleSousTitresPx ?? TAILLE_SOUS_TITRES_REFERENCE_PX) * k * 1.1) / 2;
  const hautMin = sousTitresBas + e.ecartSousSousTitresPx * k;
  const basMax = ((100 - zone.bas) / 100) * H;
  const hauteurDe = (n: number, t: number) => n * t * interligne + 2 * margeY;
  if (hautMin + hauteurDe(lignes.length, taille) > basMax && taille > tailleMin * k) {
    const t = tailleMin * k;
    const essai = theme ? [`${theme} :`, ...couper(ACCROCHE, t, largeurMax)] : couper(ACCROCHE, t, largeurMax);
    if (essai.length <= lignes.length && essai.every((l) => largeurInter(l, t) <= largeurMax)) {
      taille = t;
      lignes = essai;
    }
  }
  const hauteurCarte = hauteurDe(lignes.length, taille);
  let centre = Math.max((e.centrePct / 100) * H, hautMin + hauteurCarte / 2);
  if (centre + hauteurCarte / 2 > basMax) centre = basMax - hauteurCarte / 2;
  const manquePx = Math.max(0, hautMin - (centre - hauteurCarte / 2));
  if (manquePx > 0.5) alertes.push({ code: "chevauchement", gravite: "info", message: "Le titre d'ouverture est trop près des sous-titres." });
  return {
    encadre: { lignes, deSec: e.de, aSec: e.a, centreYPx: Math.round(centre), taillePx: Math.round(taille), rayonPx: Math.round(((e.rayonPx[0] + e.rayonPx[1]) / 2) * k), margeXPx: Math.round(margeX), margeYPx: Math.round(margeY) },
    alertes,
    manquePx,
  };
}

/** Boîte de l'encadré dessiné (px) : la carte blanche, marges comprises. */
export function boiteEncadre(e: EncadreScene, largeurImage: number): BoitePx {
  const largeur = Math.max(...e.lignes.map((l) => largeurInter(l, e.taillePx))) + 2 * e.margeXPx;
  const hauteur = e.lignes.length * e.taillePx * 1.18 + 2 * e.margeYPx;
  return { gauche: (largeurImage - largeur) / 2, haut: e.centreYPx - hauteur / 2, largeur, hauteur };
}

/**
 * Boîte d'un groupe de sous-titres DESSINÉ (px), comme le navigateur le peint : ligne de 1,1 × la taille, contour
 * (moitié à l'extérieur), ombre (décalage + flou), inclinaison d'un accent, échelle du rebond, glissement d'entrée.
 */
export function boiteGroupe(el: ElementDessine, largeurImage: number): BoitePx {
  const k = largeurImage / 1080;
  const g = el.gabarit;
  const largeur = largeurElement(el);
  const hauteurLigne = el.fond ? el.taillePx + 2 * el.fond.margeYPx : el.taillePx * 1.1;
  const angle = (Math.abs(el.rotationDeg) * Math.PI) / 180;
  const l = (largeur * Math.cos(angle) + hauteurLigne * Math.sin(angle)) * el.echelle;
  const h = (hauteurLigne * Math.cos(angle) + largeur * Math.sin(angle)) * el.echelle;
  const debord = ((g.contourPx || 0) / 2) * k;
  const ombreBas = g.ombre.opacite > 0 ? (g.ombre.decalagePx + g.ombre.flouPx) * k : 0;
  const centre = el.yPx + el.decalageYPx;
  return { gauche: (largeurImage - l) / 2 - debord, haut: centre - h / 2 - debord, largeur: l + 2 * debord, hauteur: h + 2 * debord + ombreBas };
}

/**
 * Bas le plus bas des sous-titres DESSINÉS entre `de` et `a` (une mesure par image, px), ou null s'il n'y en a aucun.
 * Sert à placer l'encadré d'ouverture au moins 80 px dessous (B.2), sur les vraies boîtes et non une estimation.
 */
export function basSousTitres(d: DonneesCalque, de: number, a: number, fps: number): number | null {
  let bas: number | null = null;
  for (let i = Math.ceil(de * fps - 1e-6); i / fps < a - 1e-6; i++) {
    const el = sceneAuTemps(d, i / fps);
    if (!el) continue;
    const b = boiteGroupe(el, d.largeur);
    bas = Math.max(bas ?? -Infinity, b.haut + b.hauteur);
  }
  return bas;
}

/**
 * COUVERTURE DE SÉRIE (TB-16, plan § 7) : gabarit « la douleur en gros » — 8 mots au plus, page ivoire, mot-clé en
 * noir souligné d'orange, nom de la série en petit, JAMAIS de numéro d'épisode. Deux formats : 9:16 et 1:1.
 * PUR, sans React, sans alias « @/ » (lu par le studio et par le conteneur de rendu). `Miniature.tsx` n'est pas touché.
 * Couleurs, polices et tailles : seulement `charte-video/1`. Déterministe.
 * Valeurs supposées [à régler sur la première couverture] : taille maximale de la douleur, marges.
 */
import { EPAISSEURS_VIDEO, TAILLES_VIDEO } from "../../../../src/briques/habillage/charte-video";
import { APPROCHE_EM, INTERLIGNE } from "../../../../src/briques/motion/jetons";
import { largeurEcrite, motsEcrits } from "../../../../src/briques/stylo/mesure-ecriture";

export const VERSION_COUVERTURE = "couverture-serie/1";
export const RATIOS_COUVERTURE = ["9:16", "1:1"] as const;
export type RatioCouverture = (typeof RATIOS_COUVERTURE)[number];
export const MOTS_DOULEUR_MAX = 8;

export type ProprietesCouverture = {
  version: typeof VERSION_COUVERTURE;
  ratio: RatioCouverture;
  /** La douleur, en gros (8 mots au plus). */
  douleur: string;
  /** Mot de la douleur mis en valeur (noir, souligné d'orange). */
  motCle: string;
  /** Nom de la série, en petit (sans numéro d'épisode). */
  serie: string;
};

export interface RectPx {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export function dimensionsCouverture(ratio: RatioCouverture): { largeur: number; hauteur: number } {
  return ratio === "1:1" ? { largeur: 1080, hauteur: 1080 } : { largeur: 1080, hauteur: 1920 };
}

/**
 * Zone où poser le contenu. 9:16 : la grille 3:4 d'un profil (y 285 → 1635, comme `Miniature`), marges de 80 px ;
 * 1:1 : marges de 80 px.
 */
export function zoneCouverture(ratio: RatioCouverture): RectPx {
  if (ratio === "1:1") return { x: 80, y: 80, largeur: 920, hauteur: 920 };
  return { x: 80, y: 285 + 70, largeur: 920, hauteur: 1350 - 140 };
}

/** Numéro d'épisode : « ép. 3 », « épisode 12 », « ep3 », « #4 », « n° 5 », « partie 2 », « 3/10 », « saison 1 ». */
const NUMERO_EPISODE = /(?:(?<![\p{L}\p{N}])(?:ép|ep|épisode|episode|saison|partie|part|volet|n°|no|numéro)(?![\p{L}\p{N}])\.?\s*\d+|#\s*\d+|(?<![\p{L}\p{N}])\d+\s*\/\s*\d+(?![\p{L}\p{N}]))/iu;
const MOT_EPISODE = /(?<![\p{L}\p{N}])(?:épisode|episode)(?![\p{L}\p{N}])/iu;

export const compterMots = (t: string): number => t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;

export const cleMot = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Contrôle des textes : liste des problèmes (vide = valide). */
export function controlerCouverture(p: ProprietesCouverture): string[] {
  const pb: string[] = [];
  const nom = "Couverture de série";
  if (p.version !== VERSION_COUVERTURE) pb.push(`${nom} · version « ${p.version} » inconnue (attendue : ${VERSION_COUVERTURE}).`);
  if (!(RATIOS_COUVERTURE as readonly string[]).includes(p.ratio)) pb.push(`${nom} · format « ${p.ratio} » non géré (9:16 ou 1:1).`);
  const n = compterMots(p.douleur);
  if (n === 0) pb.push(`${nom} · la douleur est vide.`);
  if (n > MOTS_DOULEUR_MAX) pb.push(`${nom} · la douleur compte ${n} mots (${MOTS_DOULEUR_MAX} au plus) : raccourcissez-la.`);
  if (!p.serie.trim()) pb.push(`${nom} · le nom de la série est vide.`);
  for (const [champ, texte] of [["la douleur", p.douleur], ["le nom de la série", p.serie]] as const) {
    if (NUMERO_EPISODE.test(texte) || MOT_EPISODE.test(texte)) pb.push(`${nom} · ${champ} ne doit jamais porter de numéro d'épisode (« ${texte} »).`);
  }
  const cles = p.douleur.split(/\s+/).map(cleMot).filter(Boolean);
  const cle = cleMot(p.motCle);
  if (!cle || !cles.includes(cle)) pb.push(`${nom} · le mot-clé « ${p.motCle} » n'est pas un mot de la douleur.`);
  return pb;
}

export interface MotCouverture {
  texte: string;
  x: number;
  largeur: number;
  cle: boolean;
}

export interface LigneCouverture {
  texte: string;
  px: RectPx;
  /** Mots de la ligne, avec leur position (px depuis le bord gauche de l'image) et leur rôle. */
  mots: MotCouverture[];
}

export interface PlanCouverture {
  largeur: number;
  hauteur: number;
  zone: RectPx;
  taille: number;
  lignes: LigneCouverture[];
  /** Soulignements d'orange (un par mot-clé), px de l'image. */
  traits: RectPx[];
  serie: { texte: string; px: RectPx; taille: number };
}

/** Coupe en lignes qui tiennent dans `largeur` (glouton) ; null si un mot seul déborde. */
function couper(mots: string[], taille: number, largeur: number): string[] | null {
  const lignes: string[] = [];
  let courante = "";
  for (const m of mots) {
    const essai = courante ? `${courante} ${m}` : m;
    if (largeurEcrite(essai, "titre", taille, APPROCHE_EM.titre) <= largeur) courante = essai;
    else if (!courante) return null;
    else {
      lignes.push(courante);
      courante = m;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

/** Plan de la couverture. Lève une erreur claire si les textes sont refusés ou ne tiennent pas. */
export function planifierCouverture(p: ProprietesCouverture): PlanCouverture {
  const pb = controlerCouverture(p);
  if (pb.length) throw new Error(pb.join(" "));
  const { largeur, hauteur } = dimensionsCouverture(p.ratio);
  const zone = zoneCouverture(p.ratio);
  const tailleSerie = Math.round(TAILLES_VIDEO.legende * hauteur);
  const hauteurSerie = Math.round(tailleSerie * INTERLIGNE.legende);
  const espace = Math.round(hauteur * 0.04);
  const espaceTexte = zone.hauteur - hauteurSerie - espace;
  const mots = p.douleur.split(/\s+/).filter(Boolean);
  const maxi = Math.round((p.ratio === "1:1" ? 0.15 : 0.09) * hauteur);
  const mini = Math.round(TAILLES_VIDEO.corps * hauteur);
  let taille = maxi;
  let lignes: string[] | null = null;
  for (; taille >= mini; taille -= 2) {
    const l = couper(mots, taille, zone.largeur);
    if (l && l.length * Math.round(taille * INTERLIGNE.titre) <= espaceTexte) {
      lignes = l;
      break;
    }
  }
  if (!lignes) throw new Error(`Couverture de série · la douleur « ${p.douleur} » ne tient pas dans la couverture ${p.ratio}.`);
  const pas = Math.round(taille * INTERLIGNE.titre);
  const haut = zone.y + Math.round((espaceTexte - lignes.length * pas) / 2);
  const cle = cleMot(p.motCle);
  const epaisseur = Math.max(2, Math.round(EPAISSEURS_VIDEO.soulignement * largeur));
  const traits: RectPx[] = [];
  const posees: LigneCouverture[] = lignes.map((texte, i) => {
    const y = haut + i * pas;
    const mm = motsEcrits(texte, "titre", taille, APPROCHE_EM.titre).map((m) => ({ texte: m.texte, x: zone.x + m.x, largeur: m.largeur, cle: cleMot(m.texte) === cle }));
    for (const m of mm) if (m.cle) traits.push({ x: m.x, y: Math.round(y + pas * 1.04 - epaisseur / 2), largeur: Math.round(m.largeur), hauteur: epaisseur });
    return { texte, px: { x: zone.x, y, largeur: Math.ceil(largeurEcrite(texte, "titre", taille, APPROCHE_EM.titre)), hauteur: pas }, mots: mm };
  });
  return {
    largeur,
    hauteur,
    zone,
    taille,
    lignes: posees,
    traits,
    serie: { texte: p.serie.trim(), px: { x: zone.x, y: zone.y + zone.hauteur - hauteurSerie, largeur: zone.largeur, hauteur: hauteurSerie }, taille: tailleSerie },
  };
}

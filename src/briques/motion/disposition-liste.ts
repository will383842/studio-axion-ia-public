/**
 * MISE EN PAGE ADAPTATIVE DE LA LISTE (brique `motion`, finitions du 10/10). Constat sur IMG_7747 v3 : en moitié haute
 * (écran partagé), la liste « Chez Axion-IA » de 4 éléments sortait du panneau (« Automatise » coupé par le bas), comme
 * le 3e point de la liste numérotée et « Les chiffres qui arrivent trop tard ». Le bloc était centré à taille fixe :
 * ce qui ne tenait pas débordait en haut et en bas.
 *
 * `disposerListe` calcule, AVANT le rendu et avec la chasse réelle de Poppins (`mesure.ts`), la boîte de chaque élément
 * et choisit la première mise en page qui tient dans la zone sûre : taille d'origine, puis espacements et pastilles
 * resserrés, texte réduit (jamais sous le plancher de 3 % de la hauteur), puis deux colonnes (seulement si chaque mot
 * tient dans sa colonne). Rien ne tient (6 longs points) : `tient` est faux, le moteur pose la carte en plein écran.
 * La composition `MotionListe` dessine exactement ces boîtes ; le contrôle (tests) les vérifie. PUR, sans alias « @/ ».
 */
import { APPROCHE_EM, INTERLIGNE, TAILLE_TEXTE_MIN, taillePx, ZONES_SURES, type RatioMotion } from "./jetons";
import { couperLignes, largeurMotMotion, sansBalises } from "./mesure";
import { facteurTaille, placementDe, ZONES_PLEIN } from "./style";
import type { MiseEnPageCarte } from "./types";

export interface Boite {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface DispositionListe {
  colonnes: 1 | 2;
  /** Taille du texte des points (px). */
  tailleTexte: number;
  tailleTitre: number;
  pastille: number;
  /** Écart vertical entre deux points, et entre les colonnes (px). */
  ecart: number;
  ecartColonnes: number;
  /** Marges intérieures d'un point : haut / bas, gauche, droite ; écart pastille → texte (px). */
  marge: { v: number; gauche: number; droite: number; interne: number };
  /** Hauteur réservée au titre (titre, trait et espace dessous), 0 sans titre. */
  hauteurTitre: number;
  /** Boîtes des points, dans la zone (origine : coin haut gauche de la zone), dans l'ordre des points. */
  boites: Boite[];
  /** Boîte du titre (même repère), si titre. */
  boiteTitre?: Boite;
  /** Largeur du texte d'un point (px). */
  largeurTexte: number;
  /** Lignes de chaque point. */
  lignes: number[];
  /** Vrai si tout tient dans la zone (agrandissement du point actif compris). */
  tient: boolean;
}

/** Agrandissement du point dit (`scale(1.025)`, ancré à gauche) : la boîte grandit d'autant à droite, en haut et en bas. */
export const AGRANDISSEMENT_ACTIF = 0.025;
const GRAISSE_TEXTE = 600;
const GRAISSE_TITRE = 800;

/** Zone utile de la carte, comme la composition la calcule (`zonesCarte` du noyau). */
export function zoneListe(mp: Pick<MiseEnPageCarte, "ratio" | "largeur" | "hauteur" | "hauteurVideo" | "disposition" | "placement">): Boite {
  const z = placementDe(mp) === "plein" ? ZONES_PLEIN[mp.ratio] : ZONES_SURES[mp.ratio as RatioMotion];
  const hv = mp.hauteurVideo;
  const haut = z.haut * hv;
  const bas = mp.disposition === "moitie-haute" ? mp.hauteur - 0.035 * hv : mp.hauteur - z.bas * hv;
  const gauche = Math.max(z.gauche, 0.075) * mp.largeur;
  const droite = z.droite * mp.largeur;
  return { x: gauche, y: haut, largeur: mp.largeur - gauche - droite, hauteur: bas - haut };
}

/** Hauteur d'un bloc coupé comme `TexteCinetique` (interligne + écart de rangées du rendu). */
function hauteurBloc(lignes: number, taille: number, niveau: "corps" | "titre"): number {
  const n = Math.max(1, lignes);
  return n * taille * INTERLIGNE[niveau] + (n - 1) * (taille * (INTERLIGNE[niveau] - 1) + taille * 0.04);
}

interface Essai {
  colonnes: 1 | 2;
  texte: number;
  titre: number;
  pastille: number;
  ecart: number;
  v: number;
  gauche: number;
  droite: number;
  interne: number;
}

/**
 * Mise en page d'une liste : la première qui tient parmi des essais de plus en plus serrés. Le premier essai reproduit
 * exactement le rendu d'origine (une liste qui tenait déjà ne bouge pas).
 */
export function disposerListe(e: { titre?: string; textes: string[]; mp: Pick<MiseEnPageCarte, "ratio" | "largeur" | "hauteur" | "hauteurVideo" | "disposition" | "placement"> }): DispositionListe {
  const zone = zoneListe(e.mp);
  const u = e.mp.largeur / 1080;
  const moitie = e.mp.disposition === "moitie-haute";
  const placement = placementDe(e.mp);
  const corps = Math.round(taillePx("corps", e.mp.hauteurVideo) * facteurTaille(placement, "corps"));
  const titre = Math.round(taillePx("titre", e.mp.hauteurVideo) * facteurTaille(placement, "titre"));
  const plancher = Math.ceil(TAILLE_TEXTE_MIN * e.mp.hauteurVideo);
  const essais: Essai[] = [];
  const base = { v: 22 * u, gauche: 24 * u, droite: 30 * u, interne: 30 * u, ecart: (moitie ? 18 : 30) * u };
  // 1. Une colonne : d'abord la taille d'origine, puis espacements, pastille et texte resserrés pas à pas.
  const serrages = [
    { k: 1, p: 1.75, s: 1 },
    { k: 1, p: 1.5, s: 0.7 },
    { k: 0.94, p: 1.4, s: 0.55 },
    { k: 0.9, p: 1.3, s: 0.45 },
    { k: 0, p: 1.25, s: 0.4 },
    { k: 0, p: 1.1, s: 0.25 },
  ];
  for (const colonnes of [1, 2] as const)
    for (const { k, p, s } of serrages) {
      const texte = Math.max(plancher, Math.round(k ? corps * k : plancher));
      // Titre : resserré avec le texte, au plus serré à 1,2 fois le plancher (il reste au-dessus des points).
      const tailleTitre = k ? Math.round(titre * Math.max(0.8, k)) : s >= 0.4 ? Math.round(titre * 0.8) : Math.round(plancher * 1.2);
      essais.push({ colonnes, texte, titre: Math.max(plancher, tailleTitre), pastille: Math.round(texte * p), ecart: base.ecart * s, v: base.v * Math.max(0.4, s), gauche: base.gauche * Math.max(0.5, s), droite: base.droite * Math.max(0.5, s), interne: base.interne * Math.max(0.5, s) });
    }
  let derniere: DispositionListe | null = null;
  for (const essai of essais) {
    const d = mesurer(essai, e.titre, e.textes, zone, u);
    if (!d) continue;
    if (d.tient) return d;
    if (essai.colonnes === 1) derniere = d;
  }
  return derniere!;
}

function mesurer(s: Essai, titre: string | undefined, textes: string[], zone: Boite, u: number): DispositionListe | null {
  const n = textes.length;
  const ecartColonnes = Math.round(24 * u);
  const largeurColonne = s.colonnes === 1 ? zone.largeur : (zone.largeur - ecartColonnes) / 2;
  // Le point dit grandit de 2,5 % vers la droite : la boîte de base doit laisser cette place.
  const largeurPoint = largeurColonne / (1 + AGRANDISSEMENT_ACTIF);
  const largeurTexte = largeurPoint - s.gauche - s.droite - s.pastille - s.interne;
  if (largeurTexte <= 0) return null;
  // En deux colonnes, un mot plus large que sa colonne déborderait : essai refusé.
  if (s.colonnes === 2 && textes.some((t) => sansBalises(t).split(/\s+/).some((m) => largeurMotMotion(m, s.texte, GRAISSE_TEXTE, APPROCHE_EM.corps) > largeurTexte))) return null;
  const lignes = textes.map((t) => couperLignes(t, s.texte, GRAISSE_TEXTE, largeurTexte, APPROCHE_EM.corps).length);
  const hauteurs = lignes.map((l) => Math.max(s.pastille, hauteurBloc(l, s.texte, "corps")) + 2 * s.v);
  // Titre : son bloc, le trait (18u + épaisseur) et l'espace dessous (0,6 écart + écart du flux).
  let hauteurTitre = 0;
  let boiteTitre: Boite | undefined;
  if (titre) {
    const l = couperLignes(titre, s.titre, GRAISSE_TITRE, zone.largeur, APPROCHE_EM.titre).length;
    const bloc = hauteurBloc(l, s.titre, "titre") + 18 * u + Math.max(4, 7 * u);
    hauteurTitre = bloc + s.ecart * 0.6 + s.ecart;
    boiteTitre = { x: 0, y: 0, largeur: zone.largeur, hauteur: bloc };
  }
  const parColonne = s.colonnes === 1 ? n : Math.ceil(n / 2);
  const rangees = Array.from({ length: parColonne }, (_, r) => Math.max(hauteurs[r] ?? 0, s.colonnes === 2 ? (hauteurs[r + parColonne] ?? 0) : 0));
  const hauteurPoints = rangees.reduce((a, h) => a + h, 0) + (parColonne - 1) * s.ecart;
  const total = hauteurTitre + hauteurPoints;
  // Bloc centré verticalement dans la zone (comme le rendu).
  const y0 = (zone.hauteur - total) / 2;
  if (boiteTitre) boiteTitre.y = y0;
  const boites: Boite[] = textes.map((_, i) => {
    const col = s.colonnes === 1 ? 0 : Math.floor(i / parColonne);
    const r = s.colonnes === 1 ? i : i % parColonne;
    const y = y0 + hauteurTitre + rangees.slice(0, r).reduce((a, h) => a + h, 0) + r * s.ecart;
    return { x: col * (largeurColonne + ecartColonnes), y, largeur: largeurPoint, hauteur: rangees[r] };
  });
  const dedans = (b: Boite) => {
    const marge = (b.hauteur * AGRANDISSEMENT_ACTIF) / 2;
    return b.x >= -0.5 && b.y - marge >= -0.5 && b.x + b.largeur * (1 + AGRANDISSEMENT_ACTIF) <= zone.largeur + 0.5 && b.y + b.hauteur + marge <= zone.hauteur + 0.5;
  };
  const tient = boites.every(dedans) && (!boiteTitre || (boiteTitre.y >= -0.5 && boiteTitre.y + boiteTitre.hauteur <= zone.hauteur + 0.5));
  return { colonnes: s.colonnes, tailleTexte: s.texte, tailleTitre: s.titre, pastille: s.pastille, ecart: s.ecart, ecartColonnes, marge: { v: s.v, gauche: s.gauche, droite: s.droite, interne: s.interne }, hauteurTitre, boites, ...(boiteTitre ? { boiteTitre } : {}), largeurTexte, lignes, tient };
}

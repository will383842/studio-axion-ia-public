/**
 * C8-L05 : pastille « logo + nom d'outil », géométrie PURE (2 variantes : `ligne`, `autonome`) avec repli en texte seul.
 * Ajout pur, éteint de fait : rien ne l'importe, aucune constante d'allumage (le branchement futur, C8-L12, lira
 * `logosOutils.actif` par `lireParametre`). Aucun alias d'application, aucun réseau, aucun vrai logo : la table des
 * dessins est passée en argument. Le dessin lui-même est l'affaire de C8-L06 ; ici : rectangles, couleurs, instants.
 * Pas d'ombre, de contour ni de rotation sur le logo ; l'ombre douce reste celle de la pastille (`./pastille`).
 */
import { PALETTE, autoriserTexte } from "../charte/axion-2026";
import { progres } from "../motion/courbes";
import type { DessinLogo } from "../motion/logos-outils/types";
import { resoudreLogo } from "../motion/logos-outils/resoudre";
import { hauteurCapitales, largeurMot } from "./mesure";
import { NOMS_OUTILS } from "./noms-outils";

type Rect = { x: number; y: number; w: number; h: number };

export type VariantePastilleLogo = "ligne" | "autonome";
export type FondPastille = "ivoire" | "noir";

export interface DemandePastilleLogo {
  variante: VariantePastilleLogo;
  outilId: string;
  /** Figé par le Studio au lancement (C8-L12). */
  logoId?: string;
  /** Fonds où la charte du logo l'autorise (figé au lancement). Défaut : ivoire seul. */
  fondsPermis?: readonly FondPastille[];
  /** Défaut : ivoire. */
  fondVoulu?: FondPastille;
  largeurImage: number;
  hauteurImage: number;
  tailleTextePx: number;
  /** `ligne` : position du mot dans la ligne. */
  xCentre?: number;
  yCentre?: number;
  /** `autonome` : haut ou bas de l'image (défaut bas). */
  zone?: "haut" | "bas";
}

export interface GeometriePastilleLogo {
  variante: VariantePastilleLogo;
  outilId: string;
  nom: string;
  avecLogo: boolean;
  raisonTexteSeul?: "logo-absent" | "outil-inconnu" | "fond-interdit" | "trop-petit";
  fond: FondPastille;
  couleurTexte: string;
  pastille: Rect & { rayon: number };
  logo: (Rect & { dessin: DessinLogo }) | null;
  texte: Rect & { taillePx: number };
  garde: number;
}

/**
 * Valeurs de S5 § 3.3. Garde = quart de la hauteur du logo de chaque côté ; minimum 28 px à 1 080 de large (suit la
 * largeur de l'image) ; marges et espace en em du texte ; entrée 280 ms sans rebond, sortie 160 ms.
 */
export const PASTILLE_LOGO = { zoneGardeRatio: 0.25, tailleMinLogoPx: 28, hauteurLigneEm: 1, margeXEm: 0.35, espaceLogoTexteEm: 0.3, nomMax: 24, entreeMs: 280, sortieMs: 160, monteeEntreePx: 12, echelleEntree: 0.96 } as const;

const BORD_AUTONOME = 0.06;
const POLICE = "Manrope Bold" as const;
const bornePos = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function geometriePastilleLogo(d: DemandePastilleLogo, table: Readonly<Record<string, DessinLogo>>): GeometriePastilleLogo | null {
  const outil = NOMS_OUTILS.find((o) => o.id === d.outilId);
  if (!outil) return null;
  const nom = outil.affiche.slice(0, PASTILLE_LOGO.nomMax);
  const taille = d.tailleTextePx;
  const { largeurImage: W, hauteurImage: H } = d;
  if (!(taille > 0) || !(W > 0) || !(H > 0)) return null;

  // Fond : le voulu s'il est permis, sinon l'autre fond Axion s'il l'est, sinon texte seul (fond interdit).
  const voulu: FondPastille = d.fondVoulu ?? "ivoire";
  const permis = d.fondsPermis ?? ["ivoire"];
  const autre: FondPastille = voulu === "ivoire" ? "noir" : "ivoire";
  const fond = permis.includes(voulu) ? voulu : permis.includes(autre) ? autre : voulu;
  const fondInterdit = !permis.includes(fond);
  const couleurTexte = fond === "ivoire" ? PALETTE.noir : PALETTE.ivoire;
  if (!autoriserTexte(couleurTexte, PALETTE[fond])) return null;

  const hPast = PASTILLE_LOGO.hauteurLigneEm * taille;
  const marge = PASTILLE_LOGO.margeXEm * taille;
  const wNom = largeurMot(nom, POLICE, taille);

  // Logo : jamais plus grand que le nom (≤ 1,2 × capitales), garde de chaque côté comprise dans la hauteur.
  const dessin = resoudreLogo(d.logoId, table);
  const k = PASTILLE_LOGO.zoneGardeRatio;
  let raison: GeometriePastilleLogo["raisonTexteSeul"];
  let logoH = 0;
  let logoW = 0;
  if (!dessin) raison = "logo-absent";
  else if (fondInterdit) raison = "fond-interdit";
  else {
    logoH = Math.min(hauteurCapitales(POLICE, taille) * 1.2, hPast / (1 + 2 * k));
    logoW = (logoH * dessin.vue[2]) / dessin.vue[3];
    if (!(logoW > 0) || logoH < (PASTILLE_LOGO.tailleMinLogoPx * W) / 1080) raison = "trop-petit";
  }
  const avecLogo = raison === undefined && dessin !== null;
  const garde = avecLogo ? k * logoH : 0;
  const wPast = 2 * marge + (avecLogo ? logoW + garde + PASTILLE_LOGO.espaceLogoTexteEm * taille : 0) + wNom;
  if (wPast > W || hPast > H) return null;

  let x: number;
  let y: number;
  if (d.variante === "ligne") {
    x = bornePos((d.xCentre ?? W / 2) - wPast / 2, 0, W - wPast);
    y = bornePos((d.yCentre ?? H / 2) - hPast / 2, 0, H - hPast);
  } else {
    const bas = (d.zone ?? "bas") === "bas";
    const min = bas ? Math.max((2 * H) / 3, BORD_AUTONOME * H) : BORD_AUTONOME * H;
    const max = bas ? (1 - BORD_AUTONOME) * H : H / 3;
    if (max - min < hPast) return null;
    x = (W - wPast) / 2;
    y = bornePos((bas ? (5 * H) / 6 : H / 6) - hPast / 2, min, max - hPast);
  }

  const xTexte = x + marge + (avecLogo ? logoW + garde + PASTILLE_LOGO.espaceLogoTexteEm * taille : 0);
  return {
    variante: d.variante,
    outilId: outil.id,
    nom,
    avecLogo,
    ...(raison ? { raisonTexteSeul: raison } : {}),
    fond,
    couleurTexte,
    pastille: { x, y, w: wPast, h: hPast, rayon: hPast / 2 },
    logo: avecLogo && dessin ? { x: x + marge, y: y + (hPast - logoH) / 2, w: logoW, h: logoH, dessin } : null,
    texte: { x: xTexte, y, w: wNom, h: hPast, taillePx: taille },
    garde,
  };
}

export interface EtatPastilleLogo {
  visible: boolean;
  opacite: number;
  monteePx: number;
  echelle: number;
}

/** Entrée (fondu, montée de 12 px, échelle 0,96 → 1, courbe signature, sans rebond) puis sortie en fondu (courbe sortie). */
export function etatPastilleLogo(t: number, debutSec: number, finSec: number): EtatPastilleLogo {
  const sortieSec = PASTILLE_LOGO.sortieMs / 1000;
  if (t < debutSec || t >= finSec + sortieSec) return { visible: false, opacite: 0, monteePx: PASTILLE_LOGO.monteeEntreePx, echelle: PASTILLE_LOGO.echelleEntree };
  const e = progres(t, debutSec, PASTILLE_LOGO.entreeMs / 1000, "signature");
  const s = progres(t, finSec, sortieSec, "sortie");
  return { visible: true, opacite: e * (1 - s), monteePx: PASTILLE_LOGO.monteeEntreePx * (1 - e), echelle: PASTILLE_LOGO.echelleEntree + (1 - PASTILLE_LOGO.echelleEntree) * e };
}

const r = (v: number, n: number) => +v.toFixed(n);
const rect = (q: Rect) => [r(q.x, 2), r(q.y, 2), r(q.w, 2), r(q.h, 2)];

/** Chaîne stable pour `empreinteTexte` (C8-L12, seulement si le champ est présent) ; `""` si rien à dessiner. */
export function empreintePastilleLogo(g: GeometriePastilleLogo | null, etat: EtatPastilleLogo): string {
  if (!g || !etat.visible) return "";
  return JSON.stringify({ o: g.outilId, l: g.avecLogo, f: g.fond, p: rect(g.pastille), g: g.logo ? rect(g.logo) : null, t: rect(g.texte), op: r(etat.opacite, 4), ec: r(etat.echelle, 4), m: r(etat.monteePx, 2) });
}

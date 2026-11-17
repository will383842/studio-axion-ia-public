/**
 * BANDEAU « NOM ET FONCTION » (C2-U10) : pièce pure de la brique des sous-titres, NON branchée (aucun générateur ne
 * remplit `DonneesCalque.bandeauNom` ; C2-U11 le fera pour l'avocat). Lue par le rendu Remotion : ni React, ni
 * Remotion, ni `@/` (importe seulement des voisins, la charte et les courbes de la brique motion, tous copiés au rendu).
 * Neuf en Manrope ; couleurs de la PALETTE seulement (le terracotta sert de filet, jamais de texte).
 */
import { PALETTE } from "../charte/axion-2026";
import { progres } from "../motion/courbes";
import { largeurLigne, tailleQuiTient } from "./mesure";
import type { Css } from "./scene";

export interface BandeauNomRendu {
  nom: string;
  fonction: string;
  debutSec: number;
  finSec: number;
  rect: { x: number; y: number; largeur: number; hauteur: number };
  tailleNomPx: number;
  tailleFonctionPx: number;
}

/** Réglages du bandeau (secondes et caractères ; tailles en px à 1 080 de large). */
export const BANDEAU_NOM = {
  /** Tenue d'un bandeau : assez pour lire un nom et une fonction (≈ 5 mots), pas assez pour gêner. */
  dureeSec: 3,
  /** Pas avant 0,8 s : le spectateur a vu l'image avant qu'un texte arrive. */
  debutMinSec: 0.8,
  /** Respiration après l'encadré d'ouverture. */
  apresEncadreSec: 0.2,
  /** En dessous, une vidéo est trop courte pour un bandeau. */
  videoMinSec: 6,
  nomMax: 32,
  fonctionMax: 48,
  /** Plancher de lisibilité sur mobile, proportionnel à largeur / 1 080. */
  tailleMinPx: 36,
  entreeSec: 0.3,
  sortieSec: 0.25,
} as const;

const NOM_BASE_PX = 60;
const FONCTION_BASE_PX = 42;
/** Marges internes, filet et distance au-dessus des sous-titres du bas, en px à 1 080 de large. */
const MARGE_X = 24;
const MARGE_Y = 14;
const FILET = 8;
const AU_DESSUS = 24;

export interface EtatBandeau {
  visible: boolean;
  opacite: number;
  decalageXPx: number;
}

export function poserBandeauNom(o: { nom: string; fonction: string; dureeVideoSec: number; encadreFinSec?: number; largeur: number; hauteur: number; zone: { haut: number; droite: number; bas: number; gauche: number }; basPct: number }): BandeauNomRendu | null {
  const nom = o.nom.trim();
  const fonction = o.fonction.trim();
  if (!nom || !fonction || nom.length > BANDEAU_NOM.nomMax || fonction.length > BANDEAU_NOM.fonctionMax) return null;
  if (o.dureeVideoSec < BANDEAU_NOM.videoMinSec) return null;
  const debutSec = Math.max(BANDEAU_NOM.debutMinSec, (o.encadreFinSec ?? -Infinity) + BANDEAU_NOM.apresEncadreSec);
  const finSec = Math.min(debutSec + BANDEAU_NOM.dureeSec, o.dureeVideoSec);
  if (finSec < debutSec + 1) return null;

  const e = o.largeur / 1080;
  const x = (o.zone.gauche / 100) * o.largeur;
  const libre = ((100 - o.zone.droite - o.zone.gauche) / 100) * o.largeur - (2 * MARGE_X + FILET) * e;
  const minimum = BANDEAU_NOM.tailleMinPx * e;
  const tailleNomPx = tailleQuiTient([nom], "Manrope ExtraBold", NOM_BASE_PX * e, libre);
  const tailleFonctionPx = tailleQuiTient([fonction], "Manrope SemiBold", FONCTION_BASE_PX * e, libre);
  if (tailleNomPx < minimum || tailleFonctionPx < minimum) return null;

  const largeur = Math.ceil(libreUtilisee(nom, fonction, tailleNomPx, tailleFonctionPx) + (2 * MARGE_X + FILET) * e);
  const hauteur = Math.ceil(1.2 * tailleNomPx + 1.2 * tailleFonctionPx + 4 * MARGE_Y * e);
  const bas = (o.basPct / 100) * o.hauteur - AU_DESSUS * e;
  const y = bas - hauteur;
  if (y < (o.zone.haut / 100) * o.hauteur || x + largeur > o.largeur * (1 - o.zone.droite / 100) + 1e-6) return null;
  return { nom, fonction, debutSec, finSec, rect: { x, y, largeur, hauteur }, tailleNomPx, tailleFonctionPx };
}

function libreUtilisee(nom: string, fonction: string, tn: number, tf: number): number {
  return Math.max(largeurLigne([nom], "Manrope ExtraBold", tn), largeurLigne([fonction], "Manrope SemiBold", tf));
}

export function bandeauAuTemps(b: BandeauNomRendu, t: number): EtatBandeau {
  if (t < b.debutSec || t >= b.finSec) return { visible: false, opacite: 0, decalageXPx: 0 };
  const entree = progres(t, b.debutSec, BANDEAU_NOM.entreeSec, "signature");
  const sortie = progres(t, b.finSec - BANDEAU_NOM.sortieSec, BANDEAU_NOM.sortieSec, "sortie");
  const opacite = Math.min(entree, 1 - sortie);
  const decalage = -(1 - entree) * (b.rect.x + b.rect.largeur);
  return { visible: true, opacite, decalageXPx: decalage === 0 ? 0 : decalage };
}

export function bandeauActif(b: BandeauNomRendu | undefined, t: number): boolean {
  return !!b && t >= b.debutSec && t < b.finSec;
}

export function cssBandeauNom(b: BandeauNomRendu, etat: EtatBandeau, familles: { nom: string; fonction: string }): { conteneur: Css; nom: Css; fonction: Css; filet: Css } {
  const e = b.tailleNomPx / NOM_BASE_PX;
  const marge = MARGE_X * e;
  const ligne: Css = { position: "absolute", left: 0, whiteSpace: "nowrap", boxSizing: "border-box", width: "100%", paddingLeft: FILET * e + marge, paddingRight: marge, display: "flex", alignItems: "center" };
  return {
    conteneur: { position: "absolute", left: b.rect.x, top: b.rect.y, width: b.rect.largeur, height: b.rect.hauteur, opacity: etat.opacite, transform: `translateX(${etat.decalageXPx}px)` },
    nom: { ...ligne, top: 0, height: "50%", fontFamily: `"${familles.nom}"`, fontSize: b.tailleNomPx, lineHeight: 1.2, color: PALETTE.ivoire, background: PALETTE.noir },
    fonction: { ...ligne, bottom: 0, height: "50%", fontFamily: `"${familles.fonction}"`, fontSize: b.tailleFonctionPx, lineHeight: 1.2, color: PALETTE.noir, background: PALETTE.ivoire },
    filet: { position: "absolute", left: 0, top: 0, width: FILET * e, height: "100%", background: PALETTE.terracotta },
  };
}

/** C2-U11 : clé de l'entrée de commande (figée au lancement par `src/services/bandeau-nom.ts`). */
export const ENTREE_BANDEAU_NOM = "bandeauNom";

/**
 * Contrôle pur de l'entrée `bandeauNom` d'une commande : `{ nom, fonction }` en texte non vide (rognés), sinon `null`.
 * Ne déduit ni n'invente rien : la fonction est celle qui a été saisie.
 */
export function lireEntreeBandeau(entrees: unknown): { nom: string; fonction: string } | null {
  const brut = (entrees as Record<string, unknown> | null | undefined)?.[ENTREE_BANDEAU_NOM];
  if (!brut || typeof brut !== "object") return null;
  const { nom, fonction } = brut as { nom?: unknown; fonction?: unknown };
  if (typeof nom !== "string" || typeof fonction !== "string") return null;
  return nom.trim() && fonction.trim() ? { nom: nom.trim(), fonction: fonction.trim() } : null;
}

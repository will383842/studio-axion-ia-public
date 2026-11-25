/**
 * FIX-OBJETS-CC-PLACE-v21u (C9-42) : les petits objets du cas concret (pièces `objet-*` du plan de scènes) ne recouvrent
 * JAMAIS un texte de l'écran. Le titre se pose dans la moitié HAUTE de la zone utile, l'objet dans la moitié BASSE, laissée
 * libre exprès. Si ce n'est pas possible (mise en page spéciale, place trop petite, écran qui refuse), l'objet n'est PAS posé.
 * PUR : ni Remotion, ni React, ni `server-only` (le script du clip l'importe dans Node sans `--conditions=react-server`).
 * (Le fichier `zone-objets.ts` existe déjà : ce module porte un autre nom, sur décision du pilote du 25/11.)
 */
import { controlerProprietes, disposer, type ProprietesEcran } from "@/briques/ecrans-motion";
import type { PlanZoneObjets } from "@/briques/plan-scenes/rendu";
import type { IdPiece } from "@/briques/plan-scenes/catalogue";
import { TOILES } from "@/briques/plan-scenes/toiles";
import type { Rectangle } from "@/briques/plan-scenes/zones";

/** Part haute de la zone utile laissée aux textes. */
export const PART_TEXTES = 0.5;
/** Écart (× hauteur de l'image) entre le bas du dernier texte et l'objet. */
export const MARGE_OBJETS = 0.03;
/** Hauteur minimale (× hauteur de l'image) de la zone des objets : en dessous, l'objet n'est pas posé. */
export const HAUTEUR_MIN_OBJETS = 0.15;

const estObjet = (piece: string): boolean => piece.startsWith("objet-");

/** La boîte RÉELLEMENT dessinée d'une pièce dans `boite` : toile centrée, proportions gardées (même calcul que `Piece` de `rendu.tsx`). */
export function boiteDessinee(piece: IdPiece, boite: Rectangle): Rectangle {
  const toile = TOILES[piece];
  const echelle = Math.min(boite.largeur / toile.largeur, boite.hauteur / toile.hauteur);
  const largeur = toile.largeur * echelle;
  const hauteur = toile.hauteur * echelle;
  return { x: boite.x + (boite.largeur - largeur) / 2, y: boite.y + (boite.hauteur - hauteur) / 2, largeur, hauteur };
}

/** Le même écran sans ses scènes `objet-*` (la tranche disparaît s'il n'en reste aucune). */
function sansObjets(p: ProprietesEcran): ProprietesEcran {
  const plan = p.planScenes;
  if (!plan) return p;
  const scenes = plan.scenes.filter((s) => !(s.niveau === 1 && estObjet(s.piece)));
  const { planScenes: _retiree, ...reste } = p;
  void _retiree;
  return (scenes.length ? { ...reste, planScenes: { ...plan, scenes } } : reste) as ProprietesEcran;
}

/**
 * Réserve la zone des objets : textes en moitié haute, `zoneObjets` (px de l'image) dessous, bas de la zone utile D'ORIGINE
 * (la bande des sous-titres reste libre). Sans scène `objet-*` : renvoie `p` lui-même. Dans le doute : objets retirés.
 */
export function reserverZoneObjets(p: ProprietesEcran): ProprietesEcran {
  const plan = p.planScenes;
  if (!plan || !plan.scenes.some((s) => s.niveau === 1 && estObjet(s.piece))) return p;
  if (p.jeu?.miseEnPage) return sansObjets(p);
  const q: ProprietesEcran = { ...p, zone: { ...p.zone, hauteur: p.zone.hauteur * PART_TEXTES } };
  let dispo: ReturnType<typeof disposer>;
  try {
    if (controlerProprietes(q).length > 0) return sansObjets(p);
    dispo = disposer(q);
  } catch {
    return sansObjets(p);
  }
  const bas = Math.max(...dispo.textes.map((t) => t.boite.y + t.boite.hauteur), ...dispo.boites.objets.map((o) => o.boite.y + o.boite.hauteur));
  if (!Number.isFinite(bas)) return sansObjets(p);
  const y = bas + MARGE_OBJETS * p.hauteur;
  const zoneObjets: Rectangle = { x: p.zone.x, y, largeur: p.zone.largeur, hauteur: p.zone.y + p.zone.hauteur - y };
  if (!(zoneObjets.hauteur >= HAUTEUR_MIN_OBJETS * p.hauteur)) return sansObjets(p);
  return { ...q, planScenes: { ...plan, zoneObjets } as PlanZoneObjets } as ProprietesEcran;
}
